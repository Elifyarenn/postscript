/**
 * Test data builders. Everything a test does not care about gets a sane
 * default, so each test only states the thing it is actually about.
 */
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users, type Role, type User, type WriterStatus } from "@/db/schema";
import { hashPassword } from "@/lib/password";
import type { Actor } from "@/lib/auth/rbac";

let counter = 0;

export const TEST_PASSWORD = "Test-Password-2026";

export type UserOverrides = {
  email?: string;
  role?: Role;
  writerStatus?: WriterStatus | null;
  emailVerified?: boolean;
  kvkkConsent?: boolean;
  birthDate?: string | null;
  isBanned?: boolean;
  password?: string;
  displayName?: string;
};

/** An adult, verified, consented account: the shape that passes the §6 checks. */
export async function createUser(overrides: UserOverrides = {}): Promise<User> {
  counter += 1;
  const now = new Date();

  const [row] = await db
    .insert(users)
    .values({
      email: overrides.email ?? `user${counter}@example.com`,
      passwordHash: await hashPassword(overrides.password ?? TEST_PASSWORD),
      displayName: overrides.displayName ?? `Test User ${counter}`,
      role: overrides.role ?? "user",
      writerStatus: overrides.writerStatus ?? null,
      emailVerifiedAt: overrides.emailVerified === false ? null : now,
      kvkkConsentAt: overrides.kvkkConsent === false ? null : now,
      kvkkConsentVersion: overrides.kvkkConsent === false ? null : 1,
      birthDate: overrides.birthDate === undefined ? "1995-05-05" : overrides.birthDate,
      isBanned: overrides.isBanned ?? false,
    })
    .returning();

  return row!;
}

/** The subset of a user that the permission functions work with. */
export function actorOf(user: User): Actor {
  return {
    id: user.id,
    role: user.role,
    writerStatus: user.writerStatus,
    emailVerifiedAt: user.emailVerifiedAt,
    isBanned: user.isBanned,
    totpConfirmedAt: user.totpConfirmedAt,
  };
}

export async function reloadUser(userId: string): Promise<User> {
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return rows[0]!;
}

export const noMeta = { ip: "203.0.113.10", userAgent: "vitest" };

/* ------------------------------------------------------------------ */
/* Contract setup                                                      */
/* ------------------------------------------------------------------ */

/** An admin-shaped actor for the setup steps a test needs to run as one. */
export function adminActor(id = "00000000-0000-0000-0000-0000000000ad"): Actor {
  return {
    id,
    role: "admin",
    writerStatus: null,
    emailVerifiedAt: new Date(),
    isBanned: false,
    totpConfirmedAt: new Date(),
  };
}

/**
 * The publisher details and a published contract version — the state a system
 * has to be in before anyone can be promoted (§6.1 rules 5 and 6).
 */
export async function publishContract(admin: Actor) {
  const { saveSiteSettings } = await import("@/services/site-settings");
  const { createVersionFromTemplate, publishAgreementVersion } = await import(
    "@/services/agreements"
  );

  await saveSiteSettings(
    admin,
    {
      publisher_partner_1: "Elif Yaren Çekiç",
      publisher_partner_2: "Tuanna Demir",
      publisher_address: "Konak, İzmir",
      publisher_email: "iletisim@postscriptmag.com",
      public_domain: "postscriptmag.com",
      jurisdiction_city: "İzmir",
    },
    noMeta,
  );

  // {{kvkk.version}} reads the published notice, so one has to exist (D-029)
  await publishKvkkVersion();

  const draft = await createVersionFromTemplate(admin, noMeta);
  return publishAgreementVersion(admin, draft.id, noMeta);
}

/** Publishes a KVKK notice if none is current; the contract cites its version. */
export async function publishKvkkVersion(): Promise<void> {
  const { kvkkVersions } = await import("@/db/schema");
  const { hashDocument } = await import("@/lib/agreement/normalise");
  const { eq } = await import("drizzle-orm");

  const existing = await db
    .select({ id: kvkkVersions.id })
    .from(kvkkVersions)
    .where(eq(kvkkVersions.isCurrent, true))
    .limit(1);
  if (existing.length > 0) return;

  const body = "Kişisel verileriniz KVKK kapsamında işlenir.";
  await db.insert(kvkkVersions).values({
    version: 1,
    title: "KVKK Aydınlatma Metni",
    bodyMarkdown: body,
    bodyHash: hashDocument(body),
    publishedAt: new Date(),
    isCurrent: true,
  });
}

/** Walks a writer through accepting the current contract. */
export async function acceptCurrentContract(writer: User): Promise<void> {
  const { acceptAgreement, getCurrentAgreement, renderAgreementForWriter } = await import(
    "@/services/agreements"
  );

  const current = await getCurrentAgreement();
  const preview = await renderAgreementForWriter(writer);

  await acceptAgreement(
    actorOf({ ...writer, role: "writer", writerStatus: "pending_agreement" }),
    { agreementVersionId: current!.id, renderedHash: preview.hash, acknowledged: true },
    noMeta,
  );
}
