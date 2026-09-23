import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, count, desc, eq, inArray, isNull, ne, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { teamAvatars, users, type TeamAvatar } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import {
  canCreateTeamAvatar,
  canManageTeamAvatars,
  type Actor,
  type DutyMarks,
} from "@/lib/auth/rbac";
import { badRequest, forbidden, notFound } from "@/lib/errors";
import {
  AVATAR_CONFIG_VERSION,
  avatarConfigSchema,
  avatarFileName,
  parseStoredConfig,
  teamAvatarDetailsSchema,
  type AvatarConfig,
} from "@/lib/avatar/registry";
import { renderAvatarPng } from "@/lib/avatar/png";
import { getStorage } from "@/lib/storage";
import { uniqueEntryNames, type ZipEntry } from "@/lib/zip";
import { MOTTO_MAX, ZODIAC_IDS } from "@/lib/zodiac";
import type { RequestMeta } from "./auth";

/**
 * Team avatars (D-194): a team member draws their avatar in the builder, the
 * server keeps the chosen parts and a transparent PNG drawn from them, and the
 * admin panel lists, previews and downloads them.
 *
 * The PNG is always rendered here from a validated configuration, never taken
 * from the browser, so the file an admin downloads can only ever be an avatar.
 */

const PNG_MIME = "image/png";

/** The duty marks that open the builder to an account with no staff role. */
async function dutyMarks(userId: string): Promise<Required<DutyMarks>> {
  const rows = await db
    .select({
      isIllustrator: users.isIllustrator,
      isLegalAdvisor: users.isLegalAdvisor,
      isAssistant: users.isAssistant,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return {
    isIllustrator: rows[0]?.isIllustrator ?? false,
    isLegalAdvisor: rows[0]?.isLegalAdvisor ?? false,
    isAssistant: rows[0]?.isAssistant ?? false,
  };
}

/** Whether the builder is open to this account; the page and every action ask. */
export async function isTeamMember(actor: Actor): Promise<boolean> {
  return canCreateTeamAvatar(actor, await dutyMarks(actor.id));
}

async function assertTeamMember(actor: Actor): Promise<void> {
  if (!(await isTeamMember(actor))) {
    throw forbidden("Avatar oluşturucu yalnızca dergi ekibine açık.");
  }
}

function assertAdmin(actor: Actor): void {
  if (!canManageTeamAvatars(actor)) throw forbidden();
}

export type OwnTeamAvatar = {
  displayName: string;
  teamRole: string;
  config: AvatarConfig;
  updatedAt: Date;
};

/** The member's saved avatar, loaded back into the builder for editing. */
export async function getOwnTeamAvatar(actor: Actor): Promise<OwnTeamAvatar | null> {
  await assertTeamMember(actor);
  const rows = await db.select().from(teamAvatars).where(eq(teamAvatars.userId, actor.id)).limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    displayName: row.displayName,
    teamRole: row.teamRole,
    config: parseStoredConfig(row.config),
    updatedAt: row.updatedAt,
  };
}

/* ------------------------------------------------------------------ */
/* The team form (D-226)                                               */
/* ------------------------------------------------------------------ */

export type OwnTeamForm = {
  /** Null when the avatar exists but the form has not been answered. */
  answered: Date | null;
  motto: string | null;
  teamByline: "real_name" | "pen_name" | null;
  zodiac: string | null;
};

export const teamFormSchema = z.strictObject({
  motto: z
    .string()
    .trim()
    .min(1, "Bir söz yazın.")
    .max(MOTTO_MAX, `En çok ${MOTTO_MAX} karakter.`),
  teamByline: z.enum(["real_name", "pen_name"], "Adınız mı mahlasınız mı yazsın, seçin."),
  zodiac: z.enum(ZODIAC_IDS, "Burcunuzu seçin."),
});

/**
 * The form is only open to a member who has already made and sent an avatar:
 * the answers belong to that record, and there is nothing to attach them to
 * without one.
 */
export async function getOwnTeamForm(actor: Actor): Promise<OwnTeamForm | null> {
  await assertTeamMember(actor);
  const rows = await db
    .select({
      answered: teamAvatars.teamFormAt,
      motto: teamAvatars.motto,
      teamByline: teamAvatars.teamByline,
      zodiac: teamAvatars.zodiac,
    })
    .from(teamAvatars)
    .where(eq(teamAvatars.userId, actor.id))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * What the form's suggestions are picked by (D-227): the account role and the
 * illustrator mark, which is where "what this person does" is actually
 * recorded. The team role on the avatar is free text and cannot be matched on.
 */
export async function teamDutyOf(
  actor: Actor,
): Promise<{ role: string } & Required<DutyMarks>> {
  await assertTeamMember(actor);
  return { role: actor.role, ...(await dutyMarks(actor.id)) };
}

/** How far the team form has got, for the admin overview (D-226). */
export async function countTeamForms(actor: Actor): Promise<{ total: number; answered: number }> {
  assertAdmin(actor);
  const [totals] = await db
    .select({
      total: count(),
      answered: count(teamAvatars.teamFormAt),
    })
    .from(teamAvatars);
  return { total: totals?.total ?? 0, answered: totals?.answered ?? 0 };
}

export type MissingTeamMember = {
  id: string;
  displayName: string;
  penName: string | null;
  role: string;
  isIllustrator: boolean;
  /** As the member typed it at registration; null when none was given (D-231). */
  phone: string | null;
  /** False when the avatar is what is missing; true when only the form is. */
  hasAvatar: boolean;
};

/**
 * Who on the team still owes an avatar or the form (D-230).
 *
 * Administrators are left out on the product owner's instruction — there are
 * two of them and she follows those up herself — so the screen says as much
 * rather than leaving a reader to wonder who is missing from the list.
 */
export async function listTeamMembersMissing(actor: Actor): Promise<MissingTeamMember[]> {
  assertAdmin(actor);
  const rows = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      penName: users.penName,
      role: users.role,
      isIllustrator: users.isIllustrator,
      phone: users.phone,
      avatarId: teamAvatars.id,
      answered: teamAvatars.teamFormAt,
    })
    .from(users)
    .leftJoin(teamAvatars, eq(teamAvatars.userId, users.id))
    .where(
      and(
        // Who the builder is open to, the same rule as `canCreateTeamAvatar`
        or(
          inArray(users.role, ["writer", "editor", "admin"]),
          eq(users.isIllustrator, true),
          eq(users.isLegalAdvisor, true),
          eq(users.isAssistant, true),
        ),
        ne(users.role, "admin"),
        isNull(users.deletedAt),
        eq(users.isBanned, false),
        // Nothing owed once both are in
        or(isNull(teamAvatars.id), isNull(teamAvatars.teamFormAt)),
      ),
    )
    .orderBy(asc(users.displayName));

  return rows.map((row) => ({
    id: row.id,
    displayName: row.displayName,
    penName: row.penName,
    role: row.role,
    isIllustrator: row.isIllustrator,
    phone: row.phone,
    hasAvatar: row.avatarId !== null,
  }));
}

export type TeamFormPrompt = {
  /** Whether the panels should nudge this member at all. */
  show: boolean;
  /** True when the avatar is the missing step, not the answers. */
  needsAvatar: boolean;
};

/** What the panel overviews ask before nudging someone about the form (D-226). */
export async function teamFormPrompt(actor: Actor): Promise<TeamFormPrompt> {
  if (!(await isTeamMember(actor))) return { show: false, needsAvatar: false };
  const rows = await db
    .select({ answered: teamAvatars.teamFormAt })
    .from(teamAvatars)
    .where(eq(teamAvatars.userId, actor.id))
    .limit(1);
  const row = rows[0];
  if (!row) return { show: true, needsAvatar: true };
  return { show: row.answered === null, needsAvatar: false };
}

export async function saveTeamForm(actor: Actor, rawInput: unknown, meta: RequestMeta): Promise<void> {
  await assertTeamMember(actor);

  const parsed = teamFormSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw badRequest("Formu kontrol edin.", z.flattenError(parsed.error).fieldErrors);
  }

  const now = new Date();
  const updated = await db
    .update(teamAvatars)
    .set({ ...parsed.data, teamFormAt: now, updatedAt: now })
    .where(eq(teamAvatars.userId, actor.id))
    .returning({ id: teamAvatars.id });

  const row = updated[0];
  // No avatar, nothing to attach the answers to; the page says so first, but
  // the rule lives here, where every caller passes
  if (!row) throw badRequest("Önce ekip avatarınızı oluşturup gönderin.");

  await writeAudit({
    actorId: actor.id,
    action: "team_avatar.form_saved",
    entityType: "team_avatars",
    entityId: row.id,
    // The answers themselves are the member's own words and choices; the log
    // records that they were given, not what they said
    after: { answered: now.toISOString() },
    ip: meta.ip,
  });
}

const saveSchema = teamAvatarDetailsSchema.extend({ config: avatarConfigSchema });

/**
 * Saves (or replaces) the member's avatar: validates, draws the PNG, stores it
 * and only then points the record at it. The previous PNG is removed after
 * the record moved on, so a failure midway never leaves a record without a file.
 */
export async function saveTeamAvatar(actor: Actor, rawInput: unknown, meta: RequestMeta): Promise<void> {
  await assertTeamMember(actor);

  const parsed = saveSchema.safeParse(rawInput);
  if (!parsed.success) {
    const fields = z.flattenError(parsed.error).fieldErrors;
    const configBroken = parsed.error.issues.some((issue) => issue.path[0] === "config");
    throw badRequest(
      configBroken ? "Avatar seçimleri geçersiz. Sayfayı yenileyip tekrar deneyin." : "Bilgileri kontrol edin.",
      fields,
    );
  }
  const { displayName, teamRole, config } = parsed.data;

  const png = await renderAvatarPng(config);
  const pngStorageKey = `team-avatars/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.png`;
  await getStorage().put({ bucket: "media", key: pngStorageKey, body: png, mime: PNG_MIME });

  const now = new Date();
  const existing = await db
    .select({ id: teamAvatars.id, pngStorageKey: teamAvatars.pngStorageKey })
    .from(teamAvatars)
    .where(eq(teamAvatars.userId, actor.id))
    .limit(1);
  const previous = existing[0];

  // Select-then-write rather than an upsert: the unique index still stops a
  // double submit from creating two rows, and no driver-specific SQL is needed (D-078)
  let avatarId = previous?.id;
  if (previous) {
    await db
      .update(teamAvatars)
      .set({ displayName, teamRole, config, configVersion: AVATAR_CONFIG_VERSION, pngStorageKey, updatedAt: now })
      .where(eq(teamAvatars.id, previous.id));
  } else {
    const [created] = await db.insert(teamAvatars).values({
      userId: actor.id,
      displayName,
      teamRole,
      config,
      configVersion: AVATAR_CONFIG_VERSION,
      pngStorageKey,
    }).returning({ id: teamAvatars.id });
    avatarId = created!.id;
  }

  if (previous?.pngStorageKey) await removeObject(previous.pngStorageKey);

  await writeAudit({
    actorId: actor.id,
    action: previous ? "team_avatar.updated" : "team_avatar.created",
    entityType: "team_avatars",
    entityId: avatarId,
    after: { displayName, teamRole, configVersion: AVATAR_CONFIG_VERSION, size: png.length },
    ip: meta.ip,
  });
}

/** A missing object is not worth failing a deletion over; the record is what matters. */
async function removeObject(key: string): Promise<void> {
  try {
    await getStorage().remove({ bucket: "media", key });
  } catch (error) {
    console.error("Team avatar file could not be removed:", error instanceof Error ? error.message : error);
  }
}

async function deleteRow(row: { id: string; pngStorageKey: string | null }): Promise<void> {
  await db.delete(teamAvatars).where(eq(teamAvatars.id, row.id));
  if (row.pngStorageKey) await removeObject(row.pngStorageKey);
}

export async function deleteOwnTeamAvatar(actor: Actor, meta: RequestMeta): Promise<void> {
  await assertTeamMember(actor);
  const rows = await db.select().from(teamAvatars).where(eq(teamAvatars.userId, actor.id)).limit(1);
  const row = rows[0];
  if (!row) throw notFound("Kayıtlı bir avatarınız yok.");

  await deleteRow(row);
  await writeAudit({
    actorId: actor.id,
    action: "team_avatar.deleted",
    entityType: "team_avatars",
    entityId: row.id,
    ip: meta.ip,
  });
}

/** Goes with the account (anonymisation); no audit entry of its own, the deletion has one. */
export async function removeTeamAvatarOf(userId: string): Promise<void> {
  const rows = await db.select().from(teamAvatars).where(eq(teamAvatars.userId, userId)).limit(1);
  if (rows[0]) await deleteRow(rows[0]);
}

/* ------------------------------------------------------------------ */
/* Admin                                                               */
/* ------------------------------------------------------------------ */

export type TeamAvatarListItem = {
  id: string;
  displayName: string;
  teamRole: string;
  config: AvatarConfig;
  createdAt: Date;
  updatedAt: Date;
  fileName: string;
  /** The team form's answers, null until it is answered (D-226). */
  form: OwnTeamForm;
  /** When the admin ticked "post is done"; null while it is not (D-232). */
  processedAt: Date | null;
  /** The member changed the avatar after that tick, so it needs looking at again. */
  updatedSince: boolean;
  user: {
    id: string;
    displayName: string;
    email: string;
    role: string;
    penName: string | null;
    /** The writing areas a writer holds, in slot order; empty for anyone else (D-228). */
    areas: string[];
  };
};

const listColumns = {
  id: teamAvatars.id,
  displayName: teamAvatars.displayName,
  teamRole: teamAvatars.teamRole,
  config: teamAvatars.config,
  createdAt: teamAvatars.createdAt,
  updatedAt: teamAvatars.updatedAt,
  answered: teamAvatars.teamFormAt,
  motto: teamAvatars.motto,
  teamByline: teamAvatars.teamByline,
  zodiac: teamAvatars.zodiac,
  processedAt: teamAvatars.processedAt,
  userId: users.id,
  userDisplayName: users.displayName,
  userEmail: users.email,
  userRole: users.role,
  userPenName: users.penName,
  userArea: users.writerArea,
  userArea2: users.writerArea2,
};

type ListRow = {
  id: string;
  displayName: string;
  teamRole: string;
  config: unknown;
  createdAt: Date;
  updatedAt: Date;
  answered: Date | null;
  motto: string | null;
  teamByline: "real_name" | "pen_name" | null;
  zodiac: string | null;
  processedAt: Date | null;
  userId: string;
  userDisplayName: string;
  userEmail: string;
  userRole: string;
  userPenName: string | null;
  userArea: string | null;
  userArea2: string | null;
};

function toListItem(row: ListRow): TeamAvatarListItem {
  return {
    id: row.id,
    displayName: row.displayName,
    teamRole: row.teamRole,
    config: parseStoredConfig(row.config),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    fileName: avatarFileName(row.displayName),
    form: { answered: row.answered, motto: row.motto, teamByline: row.teamByline, zodiac: row.zodiac },
    processedAt: row.processedAt,
    updatedSince: row.processedAt !== null && row.updatedAt.getTime() > row.processedAt.getTime(),
    user: {
      id: row.userId,
      displayName: row.userDisplayName,
      email: row.userEmail,
      role: row.userRole,
      penName: row.userPenName,
      areas: [row.userArea, row.userArea2].filter((area): area is string => area !== null),
    },
  };
}

/**
 * The admin's working order (D-232): the ones changed since the tick first,
 * because they were done and are not any more; then everything still waiting;
 * then the finished ones at the bottom. Newest first within each band.
 */
function workOrder(item: TeamAvatarListItem): number {
  if (item.updatedSince) return 0;
  if (item.processedAt === null) return 1;
  return 2;
}

export async function listTeamAvatars(actor: Actor): Promise<TeamAvatarListItem[]> {
  assertAdmin(actor);
  const rows = await db
    .select(listColumns)
    .from(teamAvatars)
    .innerJoin(users, eq(teamAvatars.userId, users.id))
    .orderBy(desc(teamAvatars.updatedAt));
  // Sorted here rather than in SQL: the band depends on comparing two columns,
  // and there are a few dozen rows
  return rows.map(toListItem).sort((a, b) => workOrder(a) - workOrder(b));
}

/** The admin's tick that this member's post is made, or the taking back of it. */
export async function setTeamAvatarProcessed(
  actor: Actor,
  id: string,
  done: boolean,
  meta: RequestMeta,
): Promise<void> {
  assertAdmin(actor);
  if (!z.uuid().safeParse(id).success) throw notFound("Avatar bulunamadı.");

  const now = new Date();
  const updated = await db
    .update(teamAvatars)
    // Not `updatedAt`: that one belongs to the member's own changes, and the
    // tick must not look like one
    .set({ processedAt: done ? now : null })
    .where(eq(teamAvatars.id, id))
    .returning({ id: teamAvatars.id });

  if (!updated[0]) throw notFound("Avatar bulunamadı.");

  await writeAudit({
    actorId: actor.id,
    action: done ? "team_avatar.processed" : "team_avatar.unprocessed",
    entityType: "team_avatars",
    entityId: id,
    after: { processedAt: done ? now.toISOString() : null },
    ip: meta.ip,
  });
}

export async function getTeamAvatar(actor: Actor, id: string): Promise<TeamAvatarListItem> {
  assertAdmin(actor);
  if (!z.uuid().safeParse(id).success) throw notFound("Avatar bulunamadı.");
  const rows = await db
    .select(listColumns)
    .from(teamAvatars)
    .innerJoin(users, eq(teamAvatars.userId, users.id))
    .where(eq(teamAvatars.id, id))
    .limit(1);
  if (!rows[0]) throw notFound("Avatar bulunamadı.");
  return toListItem(rows[0]);
}

/**
 * The stored PNG, or a fresh one when the object is gone (a storage move, a
 * bucket restored from backup): the configuration is the source of truth.
 */
async function pngFor(row: { id: string; config: unknown; configVersion: number; pngStorageKey: string | null }): Promise<Buffer> {
  // A record drawn in an older style is redrawn in today's (D-195); its choices carry over
  const current = row.configVersion === AVATAR_CONFIG_VERSION;
  if (row.pngStorageKey && current) {
    try {
      return await getStorage().get({ bucket: "media", key: row.pngStorageKey });
    } catch {
      // Fall through and draw it again
    }
  }
  const config = parseStoredConfig(row.config);
  const png = await renderAvatarPng(config);
  const key = `team-avatars/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.png`;
  await getStorage().put({ bucket: "media", key, body: png, mime: PNG_MIME });
  await db
    .update(teamAvatars)
    .set({ pngStorageKey: key, config, configVersion: AVATAR_CONFIG_VERSION })
    .where(eq(teamAvatars.id, row.id));
  if (row.pngStorageKey && row.pngStorageKey !== key) await removeObject(row.pngStorageKey);
  return png;
}

export async function getTeamAvatarPng(actor: Actor, id: string): Promise<{ body: Buffer; fileName: string }> {
  assertAdmin(actor);
  if (!z.uuid().safeParse(id).success) throw notFound("Avatar bulunamadı.");
  const rows = await db.select().from(teamAvatars).where(eq(teamAvatars.id, id)).limit(1);
  const row = rows[0];
  if (!row) throw notFound("Avatar bulunamadı.");
  return { body: await pngFor(row), fileName: avatarFileName(row.displayName) };
}

/**
 * The avatars for a ZIP: all of them, or the selected ids. Permission and the
 * list are settled before the first byte, then each PNG is loaded only when
 * the archive reaches it.
 */
export async function teamAvatarZipEntries(
  actor: Actor,
  ids: readonly string[] | null,
): Promise<{ count: number; entries: AsyncIterable<ZipEntry> }> {
  assertAdmin(actor);

  let rows: TeamAvatar[];
  if (ids === null) {
    rows = await db.select().from(teamAvatars).orderBy(teamAvatars.displayName);
  } else {
    const valid = [...new Set(ids)].filter((id) => z.uuid().safeParse(id).success);
    if (valid.length === 0) throw badRequest("İndirmek için en az bir avatar seçin.");
    rows = await db.select().from(teamAvatars).where(inArray(teamAvatars.id, valid)).orderBy(teamAvatars.displayName);
  }
  if (rows.length === 0) throw notFound("İndirilecek avatar yok.");

  const names = uniqueEntryNames(rows.map((row) => avatarFileName(row.displayName)));
  async function* entries(): AsyncGenerator<ZipEntry> {
    for (const [index, row] of rows.entries()) {
      yield { name: names[index]!, data: new Uint8Array(await pngFor(row)), modified: row.updatedAt };
    }
  }
  return { count: rows.length, entries: entries() };
}

export async function deleteTeamAvatarAsAdmin(actor: Actor, id: string, meta: RequestMeta): Promise<void> {
  assertAdmin(actor);
  if (!z.uuid().safeParse(id).success) throw notFound("Avatar bulunamadı.");
  const rows = await db.select().from(teamAvatars).where(eq(teamAvatars.id, id)).limit(1);
  const row = rows[0];
  if (!row) throw notFound("Avatar bulunamadı.");

  await deleteRow(row);
  await writeAudit({
    actorId: actor.id,
    action: "team_avatar.deleted_by_admin",
    entityType: "team_avatars",
    entityId: row.id,
    before: { userId: row.userId, displayName: row.displayName, teamRole: row.teamRole },
    ip: meta.ip,
  });
}

/**
 * Draws every stored avatar again in today's style (D-216), so the files the
 * site shows catch up after a drawing change (D-215). Same path as a download
 * of an old record: configuration is the source of truth, the old object is
 * dropped once the record points at the fresh one. Callers run this as a
 * maintenance script; the rows move exactly as a download would move them.
 */
export async function redrawAllTeamAvatarPngs(): Promise<number> {
  const rows = await db.select().from(teamAvatars);
  for (const row of rows) {
    await pngFor(row);
  }
  return rows.length;
}
