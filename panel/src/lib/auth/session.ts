/**
 * Database backed sessions (DECISIONS.md D-005).
 *
 * The cookie carries a random token; the database stores only a peppered
 * sha256 of it. Sessions can therefore be revoked instantly, which is the whole
 * reason the specification rules out JWT.
 */
import "server-only";
import { cookies, headers } from "next/headers";
import { and, eq, isNull, ne, desc } from "drizzle-orm";
import { db } from "@/db/client";
import { sessions, users, type EditorStatus, type Role, type WriterStatus } from "@/db/schema";
import { hashToken, randomToken } from "@/lib/crypto";
import { env, isProduction } from "@/lib/env";
import { forbidden, unauthorized } from "@/lib/errors";
import {
  canAccessAdminPanel,
  canAccessEditorPanel,
  canAccessWriterPanel,
  hasRole,
  type Actor,
} from "./rbac";

export const SESSION_COOKIE = "ps_session";

export type SessionUser = Actor & {
  email: string;
  displayName: string;
  penName: string | null;
  kvkkConsentAt: Date | null;
  birthDate: string | null;
};

export type AuthContext = {
  user: SessionUser;
  sessionId: string;
};

/* ------------------------------------------------------------------ */
/* Request metadata                                                    */
/* ------------------------------------------------------------------ */

/** Client IP and user agent, recorded on sessions and on every legal signature. */
export async function requestMetadata(): Promise<{ ip: string | null; userAgent: string | null }> {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? headerList.get("x-real-ip") ?? null;
  return { ip, userAgent: headerList.get("user-agent") };
}

/* ------------------------------------------------------------------ */
/* Creating and destroying sessions                                    */
/* ------------------------------------------------------------------ */

export async function createSession(input: {
  userId: string;
  ip: string | null;
  userAgent: string | null;
}): Promise<string> {
  const config = env();
  const rawToken = randomToken(32);
  const tokenHash = hashToken(rawToken, config.SESSION_SECRET);
  const expiresAt = new Date(Date.now() + config.SESSION_MAX_AGE_DAYS * 86_400_000);

  await db.insert(sessions).values({
    userId: input.userId,
    tokenHash,
    ip: input.ip,
    userAgent: input.userAgent,
    expiresAt,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, rawToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction(),
    path: "/",
    expires: expiresAt,
  });

  return rawToken;
}

export async function destroyCurrentSession(): Promise<void> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE)?.value;

  if (rawToken) {
    const tokenHash = hashToken(rawToken, env().SESSION_SECRET);
    await db
      .update(sessions)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(eq(sessions.tokenHash, tokenHash));
  }
  cookieStore.delete(SESSION_COOKIE);
}

/** Used by password reset and by "sign out everywhere". */
export async function revokeAllSessions(userId: string, exceptSessionId?: string): Promise<void> {
  const condition = exceptSessionId
    ? and(eq(sessions.userId, userId), ne(sessions.id, exceptSessionId), isNull(sessions.revokedAt))
    : and(eq(sessions.userId, userId), isNull(sessions.revokedAt));

  await db.update(sessions).set({ revokedAt: new Date(), updatedAt: new Date() }).where(condition);
}

export async function revokeSession(userId: string, sessionId: string): Promise<void> {
  await db
    .update(sessions)
    .set({ revokedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)));
}

export async function listSessions(userId: string) {
  return db
    .select({
      id: sessions.id,
      ip: sessions.ip,
      userAgent: sessions.userAgent,
      lastSeenAt: sessions.lastSeenAt,
      createdAt: sessions.createdAt,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)))
    .orderBy(desc(sessions.lastSeenAt));
}

/* ------------------------------------------------------------------ */
/* Reading the current session                                         */
/* ------------------------------------------------------------------ */

/**
 * Resolves the caller from the session cookie, or null when there is no valid
 * session. Also refreshes `last_seen_at`, which is what makes the 7 day
 * inactivity rule work.
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE)?.value;
  if (!rawToken) return null;

  const config = env();
  const tokenHash = hashToken(rawToken, config.SESSION_SECRET);

  const rows = await db
    .select({
      sessionId: sessions.id,
      expiresAt: sessions.expiresAt,
      lastSeenAt: sessions.lastSeenAt,
      revokedAt: sessions.revokedAt,
      userId: users.id,
      email: users.email,
      displayName: users.displayName,
      penName: users.penName,
      role: users.role,
      writerStatus: users.writerStatus,
      editorStatus: users.editorStatus,
      emailVerifiedAt: users.emailVerifiedAt,
      isBanned: users.isBanned,
      kvkkConsentAt: users.kvkkConsentAt,
      birthDate: users.birthDate,
      deletedAt: users.deletedAt,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.tokenHash, tokenHash))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const now = Date.now();
  const idleLimitMs = config.SESSION_IDLE_DAYS * 86_400_000;

  const invalid =
    row.revokedAt !== null ||
    row.deletedAt !== null ||
    row.expiresAt.getTime() <= now ||
    now - row.lastSeenAt.getTime() > idleLimitMs;

  if (invalid) return null;

  // Touch the session, but not on every single request: once a minute is plenty
  if (now - row.lastSeenAt.getTime() > 60_000) {
    await db
      .update(sessions)
      .set({ lastSeenAt: new Date(now), updatedAt: new Date(now) })
      .where(eq(sessions.id, row.sessionId));
  }

  const user: SessionUser = {
    id: row.userId,
    email: row.email,
    displayName: row.displayName,
    penName: row.penName,
    role: row.role as Role,
    writerStatus: row.writerStatus as WriterStatus | null,
    editorStatus: row.editorStatus as EditorStatus | null,
    emailVerifiedAt: row.emailVerifiedAt,
    isBanned: row.isBanned,
    kvkkConsentAt: row.kvkkConsentAt,
    birthDate: row.birthDate,
  };

  return { user, sessionId: row.sessionId };
}

/* ------------------------------------------------------------------ */
/* Guards                                                              */
/* ------------------------------------------------------------------ */

/**
 * Throws 401 when there is no session. Every mutation starts here.
 *
 * An address that has not been verified gets nothing: not the profile, not a
 * password change, not a session list. The single exception is asking for
 * another verification link, which is the one thing such an account is
 * supposed to be doing (D-034).
 */
export async function requireAuth(
  options: { allowUnverified?: boolean } = {},
): Promise<AuthContext> {
  const context = await getAuthContext();
  if (!context) throw unauthorized();
  if (context.user.isBanned) throw forbidden("Hesabınız askıya alınmış.");

  if (!options.allowUnverified && context.user.emailVerifiedAt === null) {
    throw forbidden("Önce e-posta adresinizi doğrulamanız gerekiyor.");
  }

  return context;
}

/** Throws 401/403 unless the caller holds at least `minimum` and passed 2FA. */
export async function requireRole(minimum: Role): Promise<AuthContext> {
  const context = await requireAuth();
  const { user } = context;

  if (!hasRole(user.role, minimum)) throw forbidden();
  if (user.emailVerifiedAt === null) {
    throw forbidden("Önce e-posta adresinizi doğrulamanız gerekiyor.");
  }
  const allowed =
    minimum === "user" ||
    (minimum === "writer" && canAccessWriterPanel(user)) ||
    (minimum === "editor" && canAccessEditorPanel(user)) ||
    (minimum === "admin" && canAccessAdminPanel(user));

  if (!allowed) throw forbidden();
  return context;
}
