/**
 * Seeds a usable system: the first admin, an editor, an active writer, a couple
 * of ordinary accounts, the KVKK notice, a published framework agreement, one
 * issue and articles at several points in the lifecycle.
 *
 * Run with: pnpm seed
 *
 * Idempotent by e-mail address: running it twice does not duplicate accounts.
 */
import "dotenv/config";
import path from "node:path";
import { and, eq, isNull } from "drizzle-orm";
import { createConnection } from "@/db/connect";
import { setDatabase, db } from "@/db/client";
import {
  agreementVersions,
  articles,
  issues,
  kvkkVersions,
  users,
  type Role,
} from "@/db/schema";
import { hashPassword } from "@/lib/password";
import { sha256Hex } from "@/lib/crypto";
import { slugify } from "@/lib/slug";
import { MemoryMailAdapter, setMailAdapter } from "@/lib/mail/transport";
import { publishAgreementVersion, createAgreementDraft, acceptAgreement } from "@/services/agreements";
import type { Actor } from "@/lib/auth/rbac";

const AGREEMENT_TEXT = `## 1. Taraflar ve konu

Bu çerçeve sözleşme, postscript e-dergisi ile dergide eser yayımlayan yazar
arasındaki genel çalışma esaslarını belirler. Her eser için ayrıca imzalanan
mali hak devri formu bu sözleşmenin ekidir ve öncelikli olarak uygulanır.

## 2. Yazarın beyanları

Yazar, gönderdiği eserin kendisine ait ve özgün olduğunu, üçüncü kişilerin
haklarını ihlal etmediğini beyan eder. Eserde kullanılan görsel ve alıntıların
izinleri yazarın sorumluluğundadır.

## 3. Manevi haklar

Eser sahibinin manevi hakları 5846 sayılı Fikir ve Sanat Eserleri Kanunu'nun
14 ila 17. maddeleri uyarınca yazarda kalır ve devredilemez. Eser, yazarın
belirttiği ad veya mahlasla yayımlanır.

## 4. Mali haklar

Mali haklar eser bazında, ayrı bir devir formuyla ve haklar tek tek sayılarak
düzenlenir. Bu çerçeve sözleşmenin imzalanması tek başına mali hak devri
anlamına gelmez.

## 5. Bedel

Dergi kâr amacı gütmez. Bu aşamada eserler için herhangi bir bedel ödenmez;
bu durum her devir formunda ayrıca belirtilir.

## 6. Yayından çekme

Dergi, hukuki bir zorunluluk veya telif itirazı hâlinde eseri yayından
çekebilir. Çekme gerekçesi kayıt altına alınır ve yazara bildirilir.

## 7. Kişisel veriler

Yazarın kişisel verileri KVKK aydınlatma metninde belirtilen kapsamda işlenir.
İmza kayıtları ve devir formları, sözleşmenin ispatı amacıyla hesap silinse de
saklanır.

## 8. Yürürlük

Bu sözleşme, yazarın panel üzerinden onay verdiği anda yürürlüğe girer. Dergi
yeni bir sürüm yayınlarsa, yazarın yeniden onay vermesi istenir.`;

const KVKK_TEXT = `## Veri sorumlusu

postscript e-dergi, 6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında
veri sorumlusudur.

## İşlenen veriler

Ad soyad, mahlas, e-posta adresi, doğum tarihi, kimlik doğrulama belgesi,
oturum kayıtları (IP adresi ve tarayıcı bilgisi) ve sözleşme onay kayıtları.

## İşleme amaçları

Hesap yönetimi, yazarlık yetkisinin doğrulanması, 18 yaş sınırının
denetlenmesi, eser bazlı hak devirlerinin ispatı ve yasal saklama
yükümlülüklerinin yerine getirilmesi.

## Saklama süreleri

Kimlik doğrulama belgeleri en fazla 90 gün saklanır ve otomatik olarak silinir.
Doğrulamanın yapıldığı bilgisi kalır. Hesap silme talebinde kişisel veriler
anonimleştirilir; imzalı hak devri kayıtları ve imza kanıtları sözleşmenin
ispatı amacıyla saklanmaya devam eder.

## Haklarınız

KVKK'nın 11. maddesindeki haklarınızı kullanmak için dergi ile iletişime
geçebilirsiniz. Verilerinizin makine tarafından okunabilir bir kopyasını panel
üzerinden talep edebilirsiniz.`;

type SeedUser = {
  email: string;
  displayName: string;
  password: string;
  role: Role;
  penName?: string;
  birthDate?: string | null;
  verified?: boolean;
  identityVerified?: boolean;
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
      identityVerifiedAt: input.identityVerified === false ? null : now,
      kvkkConsentAt: now,
      kvkkConsentVersion: 1,
      birthDate: input.birthDate === undefined ? "1994-04-12" : input.birthDate,
    })
    .returning();

  console.log(`  · created ${email} (${input.role})`);
  return row!.id;
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");

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
  const adminId = await upsertUser({
    email: process.env.SEED_ADMIN_EMAIL ?? "admin@postscriptmag.com",
    displayName: process.env.SEED_ADMIN_NAME ?? "Site Admin",
    password: process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe!Admin2026",
    role: "admin",
  });

  const editorId = await upsertUser({
    email: "editor@postscript.local",
    displayName: "Deniz Editör",
    password: "Editor!Parola2026",
    role: "editor",
  });

  const writerId = await upsertUser({
    email: "yazar@postscript.local",
    displayName: "Ada Yazar",
    penName: "Ada Y.",
    password: "Yazar!Parola2026",
    role: "writer",
  });

  await upsertUser({
    email: "okur@postscript.local",
    displayName: "Kerem Okur",
    password: "Okur!Parola2026",
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

  const adminActor: Actor = {
    id: adminId,
    role: "admin",
    writerStatus: null,
    emailVerifiedAt: new Date(),
    isBanned: false,
    totpConfirmedAt: new Date(),
  };

  console.log("Seeding framework agreement ...");
  const agreements = await db.select({ id: agreementVersions.id }).from(agreementVersions).limit(1);
  if (agreements.length === 0) {
    const draft = await createAgreementDraft(
      adminActor,
      { title: "postscript Çerçeve Sözleşmesi", bodyMarkdown: AGREEMENT_TEXT },
      { ip: null, userAgent: "seed" },
    );
    const published = await publishAgreementVersion(adminActor, draft.id, {
      ip: null,
      userAgent: "seed",
    });
    console.log(`  · published version ${published.version}`);

    // The seeded writer starts out active, so the panel is immediately usable
    await acceptAgreement(
      {
        id: writerId,
        role: "writer",
        writerStatus: "pending_agreement",
        emailVerifiedAt: new Date(),
        isBanned: false,
        totpConfirmedAt: null,
      },
      {
        agreementVersionId: published.id,
        bodyHash: published.bodyHash,
        acknowledged: true,
      },
      { ip: "127.0.0.1", userAgent: "seed" },
    );
    console.log("  · seeded writer accepted it");
  } else {
    console.log("  · already present");
  }

  console.log("Seeding issue and articles ...");
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

  console.log("\nSeed complete.");
  console.log("  admin  :", process.env.SEED_ADMIN_EMAIL ?? "admin@postscriptmag.com");
  console.log("  editor : editor@postscript.local / Editor!Parola2026");
  console.log("  writer : yazar@postscript.local / Yazar!Parola2026");
  console.log("  reader : okur@postscript.local / Okur!Parola2026");
  console.log(`\n  (editor id ${editorId} — two factor setup is required at first login)`);

  await connection.close();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
