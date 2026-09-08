/**
 * Seeds a usable system: the first admin, the KVKK notice, a published framework
 * agreement and the publisher details.
 *
 * The demo accounts (editor, writer, readers) and the sample content are only
 * created when `SEED_DEMO_USERS=1`. They exist so the development environment
 * and the end to end suite have someone to log in as; a production seed must
 * not ship accounts with known, committed passwords (D-038).
 *
 * Run with: pnpm seed
 *
 * Idempotent by e-mail address: running it twice does not duplicate accounts.
 */
import "dotenv/config";
import path from "node:path";
import { readFileSync } from "node:fs";
import { and, eq, isNull } from "drizzle-orm";
import { createConnection } from "@/db/connect";
import { setDatabase, db } from "@/db/client";
import {
  agreementVersions,
  articles,
  bannedWords,
  issues,
  kvkkVersions,
  users,
  writerAreas,
  type Role,
} from "@/db/schema";
import { hashPassword } from "@/lib/password";
import { AREA_QUOTA, DEFAULT_WRITER_AREAS } from "@/lib/writer-areas";
import { encryptSecret, sha256Hex } from "@/lib/crypto";
import { slugify } from "@/lib/slug";
import { normalizeBannedWord } from "@/lib/moderation";
import { MemoryMailAdapter, setMailAdapter } from "@/lib/mail/transport";
import {
  acceptAgreement,
  createVersionFromTemplate,
  publishAgreementVersion,
  renderAgreementForWriter,
} from "@/services/agreements";
import { saveSiteSettings } from "@/services/site-settings";
import type { Actor } from "@/lib/auth/rbac";

/**
 * The notice itself lives in `data/`, next to the other documents the system
 * reads at run time: it is a legal text, not code (same rule as the contract
 * template, D-028).
 */
const KVKK_TEXT = readFileSync(
  path.join(process.cwd(), "data", "kvkk-aydinlatma-metni.md"),
  "utf8",
).trim();

type SeedUser = {
  email: string;
  displayName: string;
  password: string;
  role: Role;
  penName?: string;
  birthDate?: string | null;
  verified?: boolean;
  /** When set, the account starts with the TOTP second factor enabled. */
  totpSecret?: string;
};

async function upsertUser(input: SeedUser): Promise<string> {
  const email = input.email.toLowerCase();
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.email, email), isNull(users.deletedAt)))
    .limit(1);

  if (existing[0]) {
    console.log(`  · ${email} already exists`);
    return existing[0].id;
  }

  const now = new Date();
  const [row] = await db
    .insert(users)
    .values({
      email,
      passwordHash: await hashPassword(input.password),
      displayName: input.displayName,
      penName: input.penName ?? null,
      penNameSlug: input.penName ? slugify(input.penName) : null,
      role: input.role,
      // writer_status belongs to writers only; editors and admins leave it null
      writerStatus: input.role === "writer" ? "pending_agreement" : null,
      emailVerifiedAt: input.verified === false ? null : now,
      kvkkConsentAt: now,
      kvkkConsentVersion: 1,
      birthDate: input.birthDate === undefined ? "1994-04-12" : input.birthDate,
      // The e2e run sets SEED_TOTP_SECRET so the editorial logins exercise the
      // second factor the way production users will
      totpSecret: input.totpSecret
        ? encryptSecret(input.totpSecret, process.env.SESSION_SECRET!)
        : null,
      totpEnabledAt: input.totpSecret ? now : null,
    })
    .returning();

  console.log(`  · created ${email} (${input.role})`);
  return row!.id;
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");

  // The old placeholder users are off by default; dev and e2e opt back in
  const demoEnabled = process.env.SEED_DEMO_USERS === "1";

  const connection = await createConnection(url);
  setDatabase(connection.db, connection.close);

  console.log("Applying migrations ...");
  await connection.migrate(path.join(process.cwd(), "drizzle"));

  // The seed must not try to reach a mail server
  setMailAdapter(new MemoryMailAdapter());

  console.log("Seeding KVKK notice ...");
  const kvkkExists = await db.select({ id: kvkkVersions.id }).from(kvkkVersions).limit(1);
  if (kvkkExists.length === 0) {
    await db.insert(kvkkVersions).values({
      version: 1,
      title: "KVKK Aydınlatma Metni",
      bodyMarkdown: KVKK_TEXT,
      bodyHash: sha256Hex(KVKK_TEXT),
      publishedAt: new Date(),
      isCurrent: true,
    });
    console.log("  · published version 1");
  } else {
    console.log("  · already present");
  }

  console.log("Seeding accounts ...");
  // The e2e run gives the seeded staff accounts a known second factor
  const seedTotp = process.env.SEED_TOTP_SECRET || undefined;
  const adminId = await upsertUser({
    email: process.env.SEED_ADMIN_EMAIL ?? "admin@postscriptmag.com",
    displayName: process.env.SEED_ADMIN_NAME ?? "Site Admin",
    password: process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe!Admin2026",
    role: "admin",
    totpSecret: seedTotp,
  });

  let writerId: string | null = null;

  if (demoEnabled) {
    await upsertUser({
      email: "editor@postscript.local",
      displayName: "Deniz Editör",
      password: "Editor!Parola2026",
      role: "editor",
      totpSecret: seedTotp,
    });

    const writer = await upsertUser({
      email: "yazar@postscript.local",
      displayName: "Ada Yazar",
      penName: "Ada Y.",
      password: "Yazar!Parola2026",
      role: "writer",
    });
    writerId = writer;

    await upsertUser({
      email: "okur@postscript.local",
      displayName: "Kerem Okur",
      password: "Okur!Parola2026",
      role: "user",
    });

    // The reader the writer-application pipeline scenario submits as; no other
    // scenario touches this account, so the two never race
    await upsertUser({
      email: "aday@postscript.local",
      displayName: "Aylin Aday",
      password: "Aday!Parola2026",
      role: "user",
    });

    // Deliberately under 18: the promotion screen must refuse this account
    await upsertUser({
      email: "genc@postscript.local",
      displayName: "Genç Aday",
      password: "Genc!Parola2026",
      role: "user",
      birthDate: new Date(new Date().setUTCFullYear(new Date().getUTCFullYear() - 17))
        .toISOString()
        .slice(0, 10),
    });
  }

  const adminActor: Actor = {
    id: adminId,
    role: "admin",
    writerStatus: null,
    editorStatus: null,
    emailVerifiedAt: new Date(),
    isBanned: false,
  };

  console.log("Seeding publisher settings ...");
  await saveSiteSettings(
    adminActor,
    {
      publisher_partner_1: "Elif Yaren Çekiç",
      publisher_partner_2: "Tuanna Demir",
      publisher_address: "Konak, İzmir",
      publisher_email: "iletisim@postscriptmag.com",
      public_domain: "postscriptmag.com",
      jurisdiction_city: "İzmir",
    },
    { ip: null, userAgent: "seed" },
  );
  console.log("  · saved");

  console.log("Seeding writer areas ...");
  const areaCount = await db.select({ id: writerAreas.id }).from(writerAreas).limit(1);
  if (areaCount.length === 0) {
    await db.insert(writerAreas).values(
      DEFAULT_WRITER_AREAS.map((name, index) => ({
        name,
        quota: AREA_QUOTA,
        sortOrder: index + 1,
      })),
    );
    console.log(`  · inserted ${DEFAULT_WRITER_AREAS.length} areas`);
  } else {
    console.log("  · already present");
  }

  console.log("Seeding the community blacklist ...");
  const bannedSource = readFileSync(
    path.join(process.cwd(), "data", "banned-words.txt"),
    "utf8",
  )
    .split(/\r?\n/)
    .map(normalizeBannedWord)
    .filter((word) => word.length > 0);

  for (const word of bannedSource) {
    const live = await db
      .select({ id: bannedWords.id })
      .from(bannedWords)
      .where(and(eq(bannedWords.word, word), isNull(bannedWords.deletedAt)))
      .limit(1);
    if (live.length === 0) {
      await db.insert(bannedWords).values({ word, createdBy: adminId });
    }
  }
  console.log(`  · ${bannedSource.length} banned words ensured`);

  console.log("Seeding the writer contract ...");
  const agreements = await db.select({ id: agreementVersions.id }).from(agreementVersions).limit(1);  if (agreements.length === 0) {
    const draft = await createVersionFromTemplate(adminActor, { ip: null, userAgent: "seed" });
    const published = await publishAgreementVersion(adminActor, draft.id, {
      ip: null,
      userAgent: "seed",
    });
    console.log(`  · published version ${published.version} from the template file`);

    // The seeded writer starts out active, so the panel is immediately usable.
    // Demo users only: a production seed has no placeholder writer to accept.
    if (demoEnabled && writerId) {
      const writerActor: Actor = {
        id: writerId,
        role: "writer",
        writerStatus: "pending_agreement",
        editorStatus: null,
        emailVerifiedAt: new Date(),
        isBanned: false,
      };
      const writerRow = await db.select().from(users).where(eq(users.id, writerId)).limit(1);
      const preview = await renderAgreementForWriter(writerRow[0]!);

      await acceptAgreement(
        writerActor,
        {
          agreementVersionId: published.id,
          renderedHash: preview.hash,
          acknowledged: true,
        },
        { ip: "127.0.0.1", userAgent: "seed" },
      );
      console.log("  · seeded writer accepted it");
    }
  } else {
    console.log("  · already present");
  }

  console.log("Seeding issue and articles ...");
  if (demoEnabled && writerId) {
    const existingIssue = await db.select({ id: issues.id }).from(issues).limit(1);
  if (existingIssue.length === 0) {
    const [issue] = await db
      .insert(issues)
      .values({
        number: 1,
        title: "Başlangıçlar",
        theme: "İlk sayı",
        status: "in_production",
        plannedPublishDate: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
      })
      .returning();

    const samples = [
      { title: "Bir Derginin İlk Sayısı Nasıl Kurulur", status: "draft" as const },
      { title: "Şehirde Yürümek Üzerine", status: "in_review" as const },
      { title: "Çeviri Notları: Kayıp Bir Şiir", status: "draft" as const },
    ];

    for (const [index, sample] of samples.entries()) {
      await db.insert(articles).values({
        issueId: issue!.id,
        title: sample.title,
        slug: slugify(sample.title),
        summary: "Örnek veri.",
        bodyMarkdown: `## ${sample.title}\n\nBu bir örnek yazı gövdesidir.\n`,
        authorId: writerId,
        status: sample.status,
        orderInIssue: index + 1,
        dueDate: new Date(Date.now() + (index + 7) * 86_400_000).toISOString().slice(0, 10),
      });
    }
    console.log(`  · created issue 1 with ${samples.length} articles`);
  } else {
    console.log("  · already present");
  }
  } else {
    console.log("  · demo content skipped (SEED_DEMO_USERS is not set)");
  }

  console.log("\nSeed complete.");
  console.log("  admin  :", process.env.SEED_ADMIN_EMAIL ?? "admin@postscriptmag.com");
  if (demoEnabled) {
    console.log("  editor : editor@postscript.local / Editor!Parola2026");
    console.log("  writer : yazar@postscript.local / Yazar!Parola2026");
    console.log("  reader : okur@postscript.local / Okur!Parola2026");
    console.log("  applicant : aday@postscript.local / Aday!Parola2026");
  }

  await connection.close();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
