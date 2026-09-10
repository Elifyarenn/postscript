/**
 * User management and the writer promotion flow (§6).
 *
 * Only an admin can change a role, the prerequisites are checked here on the
 * server, and no role ever changes without a `role_changes` row.
 */
import "server-only";
import { and, desc, eq, ilike, isNull, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { users, type Role, type User } from "@/db/schema";
import { isAdult, MINIMUM_WRITER_AGE, parseIsoDate } from "@/lib/age";
import { normalisePhone } from "@/lib/phone";
import { recordRoleChange, writeAudit } from "@/lib/audit";
import { canManageUsers, type Actor } from "@/lib/auth/rbac";
import { clearEditorAreas } from "./editor-categories";
import { revokeAllSessions } from "@/lib/auth/session";
import { badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import { env } from "@/lib/env";
import { sendMail } from "@/lib/mail/transport";
import { slugify } from "@/lib/slug";
import * as templates from "@emails/templates";
import type { RequestMeta } from "./auth";

/* ------------------------------------------------------------------ */
/* Writer eligibility (§6)                                             */
/* ------------------------------------------------------------------ */

export type EligibilityProblem =
  | "email_not_verified"
  | "birth_date_missing"
  | "under_age"
  | "banned";

const PROBLEM_LABELS: Record<EligibilityProblem, string> = {
  email_not_verified: "E-posta adresi doğrulanmamış.",
  birth_date_missing: "Doğum tarihi girilmemiş.",
  under_age: `Kullanıcı ${MINIMUM_WRITER_AGE} yaşından küçük.`,
  banned: "Kullanıcı yasaklı.",
};

export type Eligibility = {
  eligible: boolean;
  problems: EligibilityProblem[];
  /** Human readable version of the same list, for the admin screen. */
  messages: string[];
};

/**
 * The preconditions that can be judged from the user row alone, in one place so
 * the screen and the mutation cannot drift apart. `at` is injectable so the age
 * rule is testable. KVKK consent and a published contract are not required for
 * now: they will be handled outside the panel later (D-050).
 */
export function checkWriterEligibility(user: User, at: Date = new Date()): Eligibility {
  const problems: EligibilityProblem[] = [];

  if (!user.emailVerifiedAt) problems.push("email_not_verified");

  if (!user.birthDate) {
    problems.push("birth_date_missing");
  } else if (!isAdult(user.birthDate, at)) {
    problems.push("under_age");
  }

  if (user.isBanned) problems.push("banned");

  return {
    eligible: problems.length === 0,
    problems,
    messages: problems.map((problem) => PROBLEM_LABELS[problem]),
  };
}

/* ------------------------------------------------------------------ */
/* Lookups                                                             */
/* ------------------------------------------------------------------ */

export async function findUserById(userId: string): Promise<User> {
  const rows = await db
    .select()
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1);
  const user = rows[0];
  if (!user) throw notFound("Kullanıcı bulunamadı.");
  return user;
}

export type UserListFilters = {
  query?: string;
  role?: Role;
  limit?: number;
  offset?: number;
};

export async function listUsers(actor: Actor, filters: UserListFilters = {}) {
  if (!canManageUsers(actor)) throw forbidden();

  const conditions: SQL[] = [isNull(users.deletedAt)];
  if (filters.role) conditions.push(eq(users.role, filters.role));
  if (filters.query) {
    const pattern = `%${filters.query.trim()}%`;
    const match = or(
      ilike(users.email, pattern),
      ilike(users.displayName, pattern),
      ilike(users.penName, pattern),
    );
    if (match) conditions.push(match);
  }

  return db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      penName: users.penName,
      role: users.role,
      writerStatus: users.writerStatus,
      editorStatus: users.editorStatus,
      emailVerifiedAt: users.emailVerifiedAt,
      birthDate: users.birthDate,
      isBanned: users.isBanned,
      writerArea: users.writerArea,
      writerArea2: users.writerArea2,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(and(...conditions))
    .orderBy(desc(users.createdAt))
    .limit(filters.limit ?? 50)
    .offset(filters.offset ?? 0);
}

/* ------------------------------------------------------------------ */
/* Promotion and demotion (§6)                                         */
/* ------------------------------------------------------------------ */

/**
 * The full precondition check for a promotion. The contract is not part of it
 * for now (D-050): a published contract is no longer a prerequisite, so a fresh
 * system with no contract can still promote writers.
 */
export async function checkPromotionReadiness(
  user: User,
  at: Date = new Date(),
): Promise<Eligibility> {
  return checkWriterEligibility(user, at);
}

export async function promoteToWriter(
  actor: Actor,
  targetUserId: string,
  meta: RequestMeta,
  note?: string,
): Promise<User> {
  if (!canManageUsers(actor)) throw forbidden("Rol değiştirme yalnızca admin yetkisidir.");

  const target = await findUserById(targetUserId);
  if (target.role !== "user") throw conflict("Bu kullanıcı zaten yazar veya üzeri bir role sahip.");

  const eligibility = await checkPromotionReadiness(target);
  if (!eligibility.eligible) {
    // The admin screen shows exactly what is missing rather than a bare refusal
    throw conflict("Yazar terfisi için ön koşullar sağlanmıyor.", {
      requirements: eligibility.messages,
    });
  }

  const [updated] = await db
    .update(users)
    .set({ role: "writer", writerStatus: "active", updatedAt: new Date() })
    .where(eq(users.id, target.id))
    .returning();

  await recordRoleChange({
    userId: target.id,
    oldRole: target.role,
    newRole: "writer",
    changedBy: actor.id,
    note: note ?? null,
    ip: meta.ip,
  });

  const url = `${env().APP_URL}/writer`;
  const message = templates.promotedToWriter({ displayName: target.displayName, url });
  await sendMail({ to: target.email, subject: message.subject, text: message.text });

  return updated!;
}

/**
 * The auto-approval of a writer-registration candidate (D-049). Runs once the
 * candidate's e-mail address is verified: the address proof stands in for the
 * editorial review the old application pipeline needed. The same eligibility
 * an admin promotion checks is enforced here — an underage or unverified
 * candidate stays a reader, and the audit trail records why. The account
 * becomes an active writer right away; the contract is handled outside the
 * panel for now (D-050).
 */
export async function autoApproveWriterCandidate(
  userId: string,
  meta: RequestMeta,
): Promise<User> {
  const user = await findUserById(userId);
  if (user.writerIntentAt === null || user.role !== "user") return user;

  const eligibility = await checkPromotionReadiness(user);
  if (!eligibility.eligible) {
    await writeAudit({
      actorId: user.id,
      action: "writer_auto_approval_skipped",
      entityType: "users",
      entityId: user.id,
      after: { requirements: eligibility.messages },
      ip: meta.ip,
    });
    return user;
  }

  const now = new Date();
  const [updated] = await db
    .update(users)
    .set({ role: "writer", writerStatus: "active", updatedAt: now })
    .where(eq(users.id, user.id))
    .returning();

  // No role ever changes without its role_changes row
  await recordRoleChange({
    userId: user.id,
    oldRole: "user",
    newRole: "writer",
    changedBy: user.id,
    note: "Yazar kaydı e-posta doğrulamasıyla otomatik onaylandı",
    ip: meta.ip,
  });

  await writeAudit({
    actorId: user.id,
    action: "writer_auto_approved",
    entityType: "users",
    entityId: user.id,
    after: { role: "writer", writerStatus: "active" },
    ip: meta.ip,
  });

  const url = `${env().APP_URL}/writer`;
  const message = templates.promotedToWriter({ displayName: user.displayName, url });
  await sendMail({ to: user.email, subject: message.subject, text: message.text });

  return updated!;
}

/** Any role change other than the writer promotion, including making an admin. */
export async function changeRole(
  actor: Actor,
  targetUserId: string,
  newRole: Role,
  meta: RequestMeta,
  note?: string,
): Promise<User> {
  if (!canManageUsers(actor)) throw forbidden("Rol değiştirme yalnızca admin yetkisidir.");
  if (actor.id === targetUserId) throw badRequest("Kendi rolünüzü değiştiremezsiniz.");

  const target = await findUserById(targetUserId);
  if (target.role === newRole) throw conflict("Kullanıcı zaten bu role sahip.");

  // Anything at or above writer must clear the same bar as a writer promotion
  if (newRole !== "user") {
    const eligibility = await checkPromotionReadiness(target);
    if (!eligibility.eligible) {
      throw conflict("Bu rol için ön koşullar sağlanmıyor.", {
        requirements: eligibility.messages,
      });
    }
  }

  const writerStatus =
    newRole === "user"
      ? null
      : newRole === "writer"
        ? (target.writerStatus ?? "active")
        : target.writerStatus;

  // Leaving the editor duty drops its scope: area assignments and the main
  // editor flag belong to editors only (D-059). The editor_status freeze is
  // harmless to keep — it is only read while the role is `editor`.
  if (newRole !== "editor") {
    await clearEditorAreas(target.id);
  }

  const [updated] = await db
    .update(users)
    .set({
      role: newRole,
      writerStatus,
      isMainEditor: newRole === "editor" ? target.isMainEditor : false,
      updatedAt: new Date(),
    })
    .where(eq(users.id, target.id))
    .returning();

  await recordRoleChange({
    userId: target.id,
    oldRole: target.role,
    newRole,
    changedBy: actor.id,
    note: note ?? null,
    ip: meta.ip,
  });

  // Dropping privileges must take effect now, not when the session expires
  if (newRole === "user") await revokeAllSessions(target.id);

  return updated!;
}

/** Suspends a writer: the panel closes, signed rights grants stay untouched (§6). */
export async function setWriterStatus(
  actor: Actor,
  targetUserId: string,
  status: "active" | "suspended" | "pending_agreement",
  meta: RequestMeta,
): Promise<User> {
  if (!canManageUsers(actor)) throw forbidden();

  const target = await findUserById(targetUserId);
  if (target.role === "user") throw conflict("Bu kullanıcı yazar değil.");

  const [updated] = await db
    .update(users)
    .set({ writerStatus: status, updatedAt: new Date() })
    .where(eq(users.id, target.id))
    .returning();

  await writeAudit({
    actorId: actor.id,
    action: "user.writer_status_changed",
    entityType: "users",
    entityId: target.id,
    before: { writerStatus: target.writerStatus },
    after: { writerStatus: status },
    ip: meta.ip,
  });

  return updated!;
}

/**
 * Freezes or reactivates an editor's duty. The editor keeps the role and all
 * records; only the panel closes (and opens again). Editors have no
 * `writer_status`, so their duty state lives in `editor_status` (D-039).
 */
export async function setEditorStatus(
  actor: Actor,
  targetUserId: string,
  status: "active" | "suspended",
  meta: RequestMeta,
): Promise<User> {
  if (!canManageUsers(actor)) throw forbidden();

  const target = await findUserById(targetUserId);
  if (target.role !== "editor") throw conflict("Bu kullanıcı editör değil.");

  const [updated] = await db
    .update(users)
    .set({ editorStatus: status, updatedAt: new Date() })
    .where(eq(users.id, target.id))
    .returning();

  await writeAudit({
    actorId: actor.id,
    action: "user.editor_status_changed",
    entityType: "users",
    entityId: target.id,
    before: { editorStatus: target.editorStatus },
    after: { editorStatus: status },
    ip: meta.ip,
  });

  return updated!;
}

/**
 * Makes an editor a hybrid ("Editor & Yazar", D-060) or takes that back.
 *
 * A hybrid editor holds `role = editor` and `writer_status = active` at once,
 * so they can switch between the writer and the editor panel. The role itself
 * never changes — only the writer duty is toggled — so no `role_changes` row
 * is written; the audit log records the effective capability change.
 */
export async function setHybridWriterRole(
  actor: Actor,
  targetUserId: string,
  enabled: boolean,
  meta: RequestMeta,
): Promise<User> {
  if (!canManageUsers(actor)) throw forbidden();

  const target = await findUserById(targetUserId);
  if (target.role !== "editor") {
    throw conflict("Yalnızca editör rolü bir yazarlıkla birleştirilebilir.");
  }

  const nextStatus = enabled ? "active" : null;
  if (target.writerStatus === nextStatus) {
    throw conflict(enabled ? "Bu editör zaten yazar." : "Bu editör zaten yazar değil.");
  }

  const [updated] = await db
    .update(users)
    .set({ writerStatus: nextStatus, updatedAt: new Date() })
    .where(eq(users.id, target.id))
    .returning();

  await writeAudit({
    actorId: actor.id,
    action: "user.hybrid_writer_toggled",
    entityType: "users",
    entityId: target.id,
    before: { writerStatus: target.writerStatus },
    after: { writerStatus: nextStatus },
    ip: meta.ip,
  });

  return updated!;
}

/**
 * A writer or editor freezes their own duty from the account page. The legal
 * records (signed rights grants, acceptances) stay untouched; the panel locks
 * until an admin reactivates the duty. A plain reader has no duty to freeze.
 */
export async function selfFreezeDuty(actor: Actor, meta: RequestMeta): Promise<User> {
  const user = await findUserById(actor.id);

  if (user.role === "user") {
    throw conflict("Dondurulacak bir göreviniz yok.");
  }
  if (user.role === "admin") {
    throw conflict("Yönetici görevi bu yolla dondurulamaz; başka bir yöneticiye başvurun.");
  }

  const before = user.role === "writer" ? user.writerStatus : user.editorStatus;
  const [updated] = await db
    .update(users)
    .set(
      user.role === "writer"
        ? { writerStatus: "suspended", updatedAt: new Date() }
        : { editorStatus: "suspended", updatedAt: new Date() },
    )
    .where(eq(users.id, user.id))
    .returning();

  await writeAudit({
    actorId: user.id,
    action: "user.duty_frozen",
    entityType: "users",
    entityId: user.id,
    before: user.role === "writer" ? { writerStatus: before } : { editorStatus: before },
    after:
      user.role === "writer"
        ? { writerStatus: "suspended" }
        : { editorStatus: "suspended" },
    ip: meta.ip,
  });

  return updated!;
}

/* ------------------------------------------------------------------ */
/* Bans                                                                */
/* ------------------------------------------------------------------ */

export async function setBanned(
  actor: Actor,
  targetUserId: string,
  banned: boolean,
  reason: string | null,
  meta: RequestMeta,
): Promise<User> {
  if (!canManageUsers(actor)) throw forbidden();
  if (actor.id === targetUserId) throw badRequest("Kendi hesabınızı yasaklayamazsınız.");
  if (banned && !reason?.trim()) throw badRequest("Yasaklama gerekçesi zorunludur.");

  const target = await findUserById(targetUserId);

  const [updated] = await db
    .update(users)
    .set({ isBanned: banned, bannedReason: banned ? reason : null, updatedAt: new Date() })
    .where(eq(users.id, target.id))
    .returning();

  if (banned) await revokeAllSessions(target.id);

  await writeAudit({
    actorId: actor.id,
    action: banned ? "user.banned" : "user.unbanned",
    entityType: "users",
    entityId: target.id,
    before: { isBanned: target.isBanned },
    after: { isBanned: banned, reason },
    ip: meta.ip,
  });

  return updated!;
}

/* ------------------------------------------------------------------ */
/* Profile (§5.4)                                                      */
/* ------------------------------------------------------------------ */

export const profileSchema = z.strictObject({
  displayName: z.string().trim().min(2).max(80),
  penName: z.string().trim().max(80).optional().nullable(),
  bio: z.string().trim().max(2000).optional().nullable(),
  phone: z
    .string()
    .trim()
    .max(20, "Telefon numarası geçersiz.")
    .regex(/^\+?[0-9\s()-]*$/, "Telefon numarası yalnızca rakam içerebilir.")
    .optional()
    .nullable(),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih YYYY-AA-GG biçiminde olmalı.")
    .optional()
    .nullable(),
  socialLinks: z
    .strictObject({
      x: z.url().optional(),
      instagram: z.url().optional(),
      tiktok: z.url().optional(),
      substack: z.url().optional(),
    })
    .optional(),
});

/**
 * The gate an account has to be through before it can act on itself (D-034).
 * Kept here rather than only in `requireAuth` so a script or a future caller
 * cannot walk around it.
 */
function assertAccountUsable(actor: Actor): void {
  if (actor.isBanned) throw forbidden("Hesabınız askıya alınmış.");
  if (actor.emailVerifiedAt === null) {
    throw forbidden("Önce e-posta adresinizi doğrulamanız gerekiyor.");
  }
}

export async function updateProfile(
  actor: Actor,
  rawInput: unknown,
  meta: RequestMeta,
): Promise<User> {
  assertAccountUsable(actor);

  const parsed = profileSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw badRequest("Profil bilgileri geçersiz.", z.flattenError(parsed.error).fieldErrors);
  }
  const input = parsed.data;
  const current = await findUserById(actor.id);

  // §5.4: once a birth date exists only an admin may change it
  let birthDate = current.birthDate;
  if (input.birthDate !== undefined && input.birthDate !== null) {
    if (current.birthDate && current.birthDate !== input.birthDate) {
      throw forbidden("Doğum tarihi kaydedildikten sonra yalnızca yönetici değiştirebilir.");
    }
    if (!parseIsoDate(input.birthDate)) throw badRequest("Doğum tarihi geçersiz.");
    birthDate = input.birthDate;
  }

  const penName = input.penName?.trim() || null;

  const phone =
    input.phone !== undefined && input.phone !== null
      ? normalisePhone(input.phone.trim()) || null
      : current.phone;

  const [updated] = await db
    .update(users)
    .set({
      displayName: input.displayName,
      penName,
      penNameSlug: penName ? slugify(penName) : null,
      bio: input.bio ?? null,
      phone,
      birthDate,
      socialLinks: input.socialLinks ?? current.socialLinks,
      updatedAt: new Date(),
    })
    .where(eq(users.id, actor.id))
    .returning();

  await writeAudit({
    actorId: actor.id,
    action: "user.profile_updated",
    entityType: "users",
    entityId: actor.id,
    before: { displayName: current.displayName, penName: current.penName, phone: current.phone },
    after: { displayName: input.displayName, penName, phone },
    ip: meta.ip,
  });

  return updated!;
}

/** An admin correcting a birth date, which the user is not allowed to touch. */
export async function setBirthDateAsAdmin(
  actor: Actor,
  targetUserId: string,
  birthDate: string,
  meta: RequestMeta,
): Promise<User> {
  if (!canManageUsers(actor)) throw forbidden();
  if (!parseIsoDate(birthDate)) throw badRequest("Doğum tarihi geçersiz.");

  const target = await findUserById(targetUserId);
  const [updated] = await db
    .update(users)
    .set({ birthDate, updatedAt: new Date() })
    .where(eq(users.id, target.id))
    .returning();

  await writeAudit({
    actorId: actor.id,
    action: "user.birth_date_changed",
    entityType: "users",
    entityId: target.id,
    before: { birthDate: target.birthDate },
    after: { birthDate },
    ip: meta.ip,
  });

  return updated!;
}

/* ------------------------------------------------------------------ */
/* Account deletion (§5.4)                                             */
/* ------------------------------------------------------------------ */

export async function requestAccountDeletion(actor: Actor, meta: RequestMeta): Promise<void> {
  assertAccountUsable(actor);

  await db
    .update(users)
    .set({ deletionRequestedAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, actor.id));

  await writeAudit({
    actorId: actor.id,
    action: "user.deletion_requested",
    entityType: "users",
    entityId: actor.id,
    ip: meta.ip,
  });
}

export async function cancelAccountDeletion(actor: Actor): Promise<void> {
  assertAccountUsable(actor);

  await db
    .update(users)
    .set({ deletionRequestedAt: null, updatedAt: new Date() })
    .where(eq(users.id, actor.id));
}

/**
 * The shared deletion core: personal data is replaced, the account is soft
 * deleted, and every session dies. Signed rights grants and role changes are
 * kept — they are the proof that the magazine may publish the work, which is
 * a lawful basis to retain them (§5.4). Used by the 30 day self-service
 * completion and by the admin deletion.
 */
async function anonymise(user: User): Promise<void> {
  await db
    .update(users)
    .set({
      email: `deleted+${user.id}@invalid.local`,
      displayName: "Silinmiş kullanıcı",
      penName: user.penName, // the pen name stays on published work
      bio: null,
      socialLinks: null,
      birthDate: null,
      avatarMediaId: null,
      passwordHash: "disabled",
      anonymizedAt: new Date(),
      deletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  await revokeAllSessions(user.id);
}

/**
 * Runs 30 days after the request (cron). Personal data is replaced, but signed
 * rights grants and their signature evidence are kept: they are the proof that
 * the magazine may publish the work, and that is a lawful basis to retain.
 */
export async function anonymiseUser(userId: string): Promise<void> {
  const user = await findUserById(userId);
  await anonymise(user);

  await writeAudit({
    actorId: null,
    action: "user.anonymised",
    entityType: "users",
    entityId: userId,
    ip: null,
  });
}

/**
 * Admin-initiated deletion. The same legal treatment as the self-service
 * path applies — the account is anonymised and soft deleted, signed grants
 * stay — but the acting admin and the reason land in the audit trail.
 */
export async function deleteUserAsAdmin(
  actor: Actor,
  targetUserId: string,
  reason: string,
  meta: RequestMeta,
): Promise<void> {
  if (!canManageUsers(actor)) throw forbidden();
  if (actor.id === targetUserId) throw badRequest("Kendi hesabınızı silemezsiniz.");
  if (!reason.trim()) throw badRequest("Silme gerekçesi zorunludur.");

  const target = await findUserById(targetUserId);
  await anonymise(target);

  await writeAudit({
    actorId: actor.id,
    action: "user.deleted_by_admin",
    entityType: "users",
    entityId: target.id,
    before: { role: target.role, isBanned: target.isBanned },
    after: { deleted: true, reason: reason.trim() },
    ip: meta.ip,
  });
}

/** KVKK data portability: everything the panel holds about one user, as JSON. */
export async function exportUserData(actor: Actor, targetUserId: string) {
  if (!canManageUsers(actor) && actor.id !== targetUserId) throw forbidden();

  const user = await findUserById(targetUserId);
  const rows = await db.execute(sql`
    select 'agreement_acceptances' as source, row_to_json(a) as data
      from agreement_acceptances a where a.user_id = ${targetUserId}
    union all
    select 'rights_grants', row_to_json(g) from rights_grants g where g.grantor_id = ${targetUserId}
    union all
    select 'articles', row_to_json(x) from articles x where x.author_id = ${targetUserId}
    union all
    select 'role_changes', row_to_json(r) from role_changes r where r.user_id = ${targetUserId}
  `);

  return {
    exportedAt: new Date().toISOString(),
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      penName: user.penName,
      bio: user.bio,
      birthDate: user.birthDate,
      role: user.role,
      writerStatus: user.writerStatus,
      kvkkConsentAt: user.kvkkConsentAt,
      kvkkConsentVersion: user.kvkkConsentVersion,
      createdAt: user.createdAt,
    },
    related: rows,
  };
}
