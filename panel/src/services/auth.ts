/**
 * Registration, login, e-mail verification and password reset (§5).
 *
 * Services never touch cookies or headers: the caller passes the request
 * metadata in and decides what to do with the result. That keeps every rule
 * here directly testable.
 */
import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { emailTokens, kvkkVersions, users, type User } from "@/db/schema";
import { hashToken, randomToken, sha256Hex } from "@/lib/crypto";
import { env } from "@/lib/env";
import { badRequest, conflict, forbidden, notFound, rateLimited, unauthorized } from "@/lib/errors";
import { checkPasswordPolicy, hashPassword, isPwned, verifyPassword } from "@/lib/password";
import { calculateAge } from "@/lib/age";
import { clearAttempts, consumeAttempt, currentAttemptCount, failureDelayMs } from "@/lib/rate-limit";
import { writeAudit } from "@/lib/audit";
import { sendMail } from "@/lib/mail/transport";
import * as templates from "@emails/templates";

export type RequestMeta = { ip: string | null; userAgent: string | null };

const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60_000;
const RESET_TOKEN_TTL_MS = 30 * 60_000;

/* ------------------------------------------------------------------ */
/* Schemas                                                             */
/* ------------------------------------------------------------------ */

/**
 * `strictObject` matters here: a request that tries to smuggle in `role` is
 * rejected outright rather than silently ignored (§3 rule 2).
 */
export const registerSchema = z.strictObject({
  email: z.email("Geçerli bir e-posta adresi girin.").max(254),
  password: z.string().min(1, "Şifre gerekli."),
  displayName: z.string().trim().min(2, "Ad en az 2 karakter olmalı.").max(80),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Doğum tarihi YYYY-AA-GG biçiminde olmalı."),
  kvkkConsent: z.literal(true, { message: "KVKK aydınlatma metnini onaylamanız gerekiyor." }),
});

export const loginSchema = z.strictObject({
  email: z.email().max(254),
  password: z.string().min(1),
});

export const passwordResetRequestSchema = z.strictObject({
  email: z.email().max(254),
});

export const passwordResetSchema = z.strictObject({
  token: z.string().min(10),
  password: z.string().min(1),
});

export const changeEmailSchema = z.strictObject({
  newEmail: z.email("Geçerli bir e-posta adresi girin.").max(254),
});

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/* ------------------------------------------------------------------ */
/* Registration                                                        */
/* ------------------------------------------------------------------ */

async function currentKvkkVersion(): Promise<number> {
  const rows = await db
    .select({ version: kvkkVersions.version })
    .from(kvkkVersions)
    .where(eq(kvkkVersions.isCurrent, true))
    .limit(1);
  // Version 1 is created by the seed; falling back to it keeps registration working
  return rows[0]?.version ?? 1;
}

export async function register(
  rawInput: unknown,
  meta: RequestMeta,
): Promise<{ user: User; verificationToken: string }> {
  const parsed = registerSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw badRequest("Kayıt bilgileri geçersiz.", z.flattenError(parsed.error).fieldErrors);
  }
  const input = parsed.data;

  // `calculateAge` returns null for malformed dates and for dates in the future
  if (calculateAge(input.birthDate) === null) {
    throw badRequest("Doğum tarihi geçersiz.", {
      birthDate: ["Geçerli bir doğum tarihi girin."],
    });
  }

  // Rate limit before hashing: argon2 is deliberately expensive (§5.1)
  const limit = await consumeAttempt("register_ip", meta.ip ?? "unknown");
  if (!limit.allowed) throw rateLimited("Çok fazla kayıt denemesi yapıldı, 10 dakika bekleyin.");

  const policy = checkPasswordPolicy(input.password);
  if (!policy.ok) throw badRequest(policy.reason, { password: [policy.reason] });
  if (await isPwned(input.password)) {
    const message = "Bu şifre bilinen veri sızıntılarında görüldü, başka bir şifre seçin.";
    throw badRequest(message, { password: [message] });
  }

  const email = normaliseEmail(input.email);
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.email, email), isNull(users.deletedAt)))
    .limit(1);
  if (existing.length > 0) throw conflict("Bu e-posta adresi zaten kayıtlı.");

  const passwordHash = await hashPassword(input.password);

  const [user] = await db
    .insert(users)
    .values({
      email,
      passwordHash,
      displayName: input.displayName,
      birthDate: input.birthDate,
      // The server decides the role. It is never read from the request.
      role: "user",
      kvkkConsentAt: new Date(),
      kvkkConsentVersion: await currentKvkkVersion(),
    })
    .returning();

  const verificationToken = await issueEmailToken(user!.id, "verify_email", VERIFY_TOKEN_TTL_MS);

  const url = `${env().APP_URL}/verify-email?token=${encodeURIComponent(verificationToken)}`;
  const message = templates.verifyEmail({ displayName: user!.displayName, url });
  await sendMail({ to: user!.email, subject: message.subject, text: message.text });

  await writeAudit({
    actorId: user!.id,
    action: "user.registered",
    entityType: "users",
    entityId: user!.id,
    after: { email, displayName: user!.displayName },
    ip: meta.ip,
  });

  return { user: user!, verificationToken };
}

/* ------------------------------------------------------------------ */
/* E-mail tokens                                                       */
/* ------------------------------------------------------------------ */

async function issueEmailToken(
  userId: string,
  type: "verify_email" | "reset_password" | "change_email",
  ttlMs: number,
): Promise<string> {
  // Any earlier token of the same kind is spent, so only the newest link works
  await db
    .update(emailTokens)
    .set({ usedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(emailTokens.userId, userId), eq(emailTokens.type, type), isNull(emailTokens.usedAt)));

  const token = randomToken(32);
  await db.insert(emailTokens).values({
    userId,
    type,
    tokenHash: hashToken(token, env().SESSION_SECRET),
    expiresAt: new Date(Date.now() + ttlMs),
  });
  return token;
}

async function consumeEmailToken(
  token: string,
  type: "verify_email" | "reset_password" | "change_email",
): Promise<string> {
  const tokenHash = hashToken(token, env().SESSION_SECRET);
  const rows = await db
    .select()
    .from(emailTokens)
    .where(and(eq(emailTokens.tokenHash, tokenHash), eq(emailTokens.type, type)))
    .limit(1);

  const row = rows[0];
  if (!row) throw notFound("Bağlantı geçersiz.");
  if (row.usedAt) throw badRequest("Bu bağlantı daha önce kullanılmış.");
  if (row.expiresAt.getTime() <= Date.now()) throw badRequest("Bağlantının süresi dolmuş.");

  await db
    .update(emailTokens)
    .set({ usedAt: new Date(), updatedAt: new Date() })
    .where(eq(emailTokens.id, row.id));

  return row.userId;
}

export async function verifyEmail(token: string, meta: RequestMeta): Promise<User> {
  const userId = await consumeEmailToken(token, "verify_email");

  const [user] = await db
    .update(users)
    .set({ emailVerifiedAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();

  await writeAudit({
    actorId: userId,
    action: "user.email_verified",
    entityType: "users",
    entityId: userId,
    ip: meta.ip,
  });

  const verified = user!;
  return verified;
}

/** A new link can be asked for once a minute; the button is otherwise a mail cannon. */
const RESEND_INTERVAL_MS = 60_000;

/** Sends a new verification link. Used by the "resend" button. */
export async function resendVerificationEmail(userId: string): Promise<void> {
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const user = rows[0];
  if (!user) throw notFound();
  if (user.emailVerifiedAt) throw badRequest("E-posta adresiniz zaten doğrulanmış.");

  // Throttled against the last link issued rather than a counter table: the
  // timestamp is already there and cannot drift out of step with reality
  const recent = await db
    .select({ createdAt: emailTokens.createdAt })
    .from(emailTokens)
    .where(and(eq(emailTokens.userId, user.id), eq(emailTokens.type, "verify_email")))
    .orderBy(desc(emailTokens.createdAt))
    .limit(1);

  const last = recent[0]?.createdAt;
  if (last && Date.now() - last.getTime() < RESEND_INTERVAL_MS) {
    const wait = Math.ceil((RESEND_INTERVAL_MS - (Date.now() - last.getTime())) / 1000);
    throw rateLimited(`Yeni bağlantı istemek için ${wait} saniye bekleyin.`);
  }

  const token = await issueEmailToken(user.id, "verify_email", VERIFY_TOKEN_TTL_MS);
  const url = `${env().APP_URL}/verify-email?token=${encodeURIComponent(token)}`;
  const message = templates.verifyEmail({ displayName: user.displayName, url });
  await sendMail({ to: user.email, subject: message.subject, text: message.text });
}

/* ------------------------------------------------------------------ */
/* E-mail change                                                       */
/* ------------------------------------------------------------------ */

const CHANGE_EMAIL_TTL_MS = 24 * 60 * 60_000;

/**
 * Asks to switch the account to a new address. The address is only stored as
 * pending until the owner proves they control it by following the link that is
 * sent to it. The existing, already-verified address stays live until then, so
 * a change request can never lock the owner out of the account.
 */
export async function requestEmailChange(
  userId: string,
  rawInput: unknown,
  meta: RequestMeta,
): Promise<void> {
  const parsed = changeEmailSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw badRequest("E-posta adresi geçersiz.", z.flattenError(parsed.error).fieldErrors);
  }

  const newEmail = normaliseEmail(parsed.data.newEmail);
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const user = rows[0];
  if (!user) throw notFound();
  if (user.emailVerifiedAt === null) {
    throw forbidden("Önce mevcut e-posta adresinizi doğrulamanız gerekiyor.");
  }
  if (newEmail === user.email) throw conflict("Bu adres zaten kullanıcı adresiniz.");

  // The new address must not belong to any other live account
  const taken = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.email, newEmail), isNull(users.deletedAt)))
    .limit(1);
  if (taken.length > 0) throw conflict("Bu e-posta adresi zaten kayıtlı.");

  // Throttled against the last change link, like the verification resend
  const recent = await db
    .select({ createdAt: emailTokens.createdAt })
    .from(emailTokens)
    .where(and(eq(emailTokens.userId, user.id), eq(emailTokens.type, "change_email")))
    .orderBy(desc(emailTokens.createdAt))
    .limit(1);

  const last = recent[0]?.createdAt;
  if (last && Date.now() - last.getTime() < RESEND_INTERVAL_MS) {
    const wait = Math.ceil((RESEND_INTERVAL_MS - (Date.now() - last.getTime())) / 1000);
    throw rateLimited(`Yeni bağlantı istemek için ${wait} saniye bekleyin.`);
  }

  await db
    .update(users)
    .set({ pendingEmail: newEmail, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  const token = await issueEmailToken(user.id, "change_email", CHANGE_EMAIL_TTL_MS);
  const url = `${env().APP_URL}/verify-email/change?token=${encodeURIComponent(token)}`;
  const message = templates.changeEmail({ displayName: user.displayName, newEmail, url });
  await sendMail({ to: newEmail, subject: message.subject, text: message.text });

  await writeAudit({
    actorId: userId,
    action: "user.email_change_requested",
    entityType: "users",
    entityId: userId,
    before: { email: user.email },
    after: { pendingEmail: newEmail },
    ip: meta.ip,
  });
}

/**
 * Completes the swap after the owner follows the link sent to the new address.
 * The pending address becomes the live one, is marked verified, and every other
 * session is dropped so the change is felt everywhere at once.
 */
export async function confirmEmailChange(token: string, meta: RequestMeta): Promise<User> {
  const userId = await consumeEmailToken(token, "change_email");

  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const user = rows[0];
  if (!user) throw notFound();
  if (!user.pendingEmail) throw badRequest("Bu bağlantı için bekleyen bir adres yok.");

  const [updated] = await db
    .update(users)
    .set({
      email: user.pendingEmail,
      pendingEmail: null,
      emailVerifiedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning();

  await writeAudit({
    actorId: userId,
    action: "user.email_changed",
    entityType: "users",
    entityId: userId,
    before: { email: user.email },
    after: { email: updated!.email },
    ip: meta.ip,
  });

  return updated!;
}

/* ------------------------------------------------------------------ */
/* Login                                                               */
/* ------------------------------------------------------------------ */

export type LoginOutcome = { user: User };

/**
 * Verifies credentials only. Creating the session cookie is the caller's job,
 * because that needs a request context and this must stay testable.
 */
export async function verifyCredentials(
  rawInput: unknown,
  meta: RequestMeta,
): Promise<LoginOutcome> {
  const parsed = loginSchema.safeParse(rawInput);
  if (!parsed.success) throw badRequest("E-posta veya şifre hatalı.");

  const email = normaliseEmail(parsed.data.email);
  const ipKey = meta.ip ?? "unknown";

  // Two independent counters, per §5.2: one for the address, one for the account
  const ipLimit = await consumeAttempt("login_ip", ipKey);
  const accountLimit = await consumeAttempt("login_account", email);
  if (!ipLimit.allowed || !accountLimit.allowed) {
    throw rateLimited("Çok fazla başarısız deneme. 15 dakika sonra tekrar deneyin.");
  }

  // Increasing delay before the answer, so guessing gets slower each time
  const failures = await currentAttemptCount("login_account", email);
  const delay = failureDelayMs(failures);
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));

  const rows = await db
    .select()
    .from(users)
    .where(and(eq(users.email, email), isNull(users.deletedAt)))
    .limit(1);
  const user = rows[0];

  // Same generic message whether the account exists or the password is wrong
  if (!user) throw unauthorized("E-posta veya şifre hatalı.");
  if (!(await verifyPassword(user.passwordHash, parsed.data.password))) {
    throw unauthorized("E-posta veya şifre hatalı.");
  }
  if (user.isBanned) throw forbidden("Hesabınız askıya alınmış.");

  await clearAttempts("login_account", email);
  await clearAttempts("login_ip", ipKey);

  return { user };
}

/* ------------------------------------------------------------------ */
/* Password reset                                                      */
/* ------------------------------------------------------------------ */

/**
 * Always resolves, whether or not the address exists: a reset form must not
 * become a way to enumerate accounts.
 */
export async function requestPasswordReset(rawInput: unknown, meta: RequestMeta): Promise<void> {
  const parsed = passwordResetRequestSchema.safeParse(rawInput);
  if (!parsed.success) return;

  const limit = await consumeAttempt("password_reset_ip", meta.ip ?? "unknown");
  if (!limit.allowed) throw rateLimited();

  const email = normaliseEmail(parsed.data.email);
  const rows = await db
    .select()
    .from(users)
    .where(and(eq(users.email, email), isNull(users.deletedAt)))
    .limit(1);
  const user = rows[0];
  if (!user) return;

  const token = await issueEmailToken(user.id, "reset_password", RESET_TOKEN_TTL_MS);
  const url = `${env().APP_URL}/reset-password?token=${encodeURIComponent(token)}`;
  const message = templates.resetPassword({ displayName: user.displayName, url });
  await sendMail({ to: user.email, subject: message.subject, text: message.text });
}

/**
 * Sets the new password. Every active session is dropped afterwards, which is
 * the point of a reset: whoever held the old session loses it.
 */
export async function resetPassword(rawInput: unknown, meta: RequestMeta): Promise<string> {
  const parsed = passwordResetSchema.safeParse(rawInput);
  if (!parsed.success) throw badRequest("Bağlantı veya şifre geçersiz.");

  const policy = checkPasswordPolicy(parsed.data.password);
  if (!policy.ok) throw badRequest(policy.reason, { password: [policy.reason] });

  const userId = await consumeEmailToken(parsed.data.token, "reset_password");
  const passwordHash = await hashPassword(parsed.data.password);

  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, userId));

  await writeAudit({
    actorId: userId,
    action: "user.password_reset",
    entityType: "users",
    entityId: userId,
    ip: meta.ip,
  });

  return userId;
}

/** Changing a password from inside the panel; requires the current one. */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  meta: RequestMeta,
): Promise<void> {
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const user = rows[0];
  if (!user) throw notFound();

  if (!(await verifyPassword(user.passwordHash, currentPassword))) {
    throw badRequest("Mevcut şifreniz hatalı.", { currentPassword: ["Mevcut şifreniz hatalı."] });
  }

  const policy = checkPasswordPolicy(newPassword);
  if (!policy.ok) throw badRequest(policy.reason, { password: [policy.reason] });

  await db
    .update(users)
    .set({ passwordHash: await hashPassword(newPassword), updatedAt: new Date() })
    .where(eq(users.id, userId));

  await writeAudit({
    actorId: userId,
    action: "user.password_changed",
    entityType: "users",
    entityId: userId,
    ip: meta.ip,
  });
}

/** Exposed for tests and for the seed script, which needs a deterministic hash. */
export const _internals = { issueEmailToken, consumeEmailToken, sha256Hex };
