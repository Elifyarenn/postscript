/**
 * The writer application pipeline (§6 of the writer-application module).
 *
 * Covers the whole flow against a real PostgreSQL: submitting with a sample
 * work, the 30 day cooldown, the staged editor → admin approvals, and the
 * admin's verification of the uploaded signed contract, which is the only
 * thing that turns the account into a writer (D-275).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { agreementAcceptances, roleChanges, users, writerApplications } from "@/db/schema";
import {
  adminDecideApplication,
  cooldownInfo,
  editorDecideApplication,
  getApplicationProcess,
  latestApplication,
  listApplicationsByStatus,
  submitWriterApplication,
} from "@/services/writer-applications";
import { getCurrentAgreement } from "@/services/agreements";
import { approveSignedContract, uploadSignedContract } from "@/services/signed-contracts";
import { MemoryMailAdapter, setMailAdapter } from "@/lib/mail/transport";
import { MemoryStorageAdapter, setStorageAdapter } from "@/lib/storage";
import { isAppError } from "@/lib/errors";
import {
  resetTables,
  seedDefaultWriterAreas,
  setupTestDatabase,
  teardownTestDatabase,
} from "../helpers/db";
import {
  actorOf,
  createUser,
  noMeta,
  publishContract,
  reloadUser,
  tinyPdf,
} from "../helpers/factories";
import type { User } from "@/db/schema";

let database: Database;
const mailbox = new MemoryMailAdapter();
const storage = new MemoryStorageAdapter();

beforeAll(async () => {
  database = await setupTestDatabase();
  setMailAdapter(mailbox);
  setStorageAdapter(storage);
});

afterAll(async () => {
  await teardownTestDatabase();
});

beforeEach(async () => {
  await resetTables(database);
  await seedDefaultWriterAreas();
  mailbox.clear();
  storage.clear();
});

async function captureError(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    if (isAppError(error)) return error;
    throw error;
  }
  throw new Error("Expected the call to fail, but it succeeded.");
}

const SAMPLE_PDF = Buffer.from("%PDF-1.4\n% ornek eser icerigi");

/** Every required answer of the application form (D-375), for a long-term writer. */
const ANSWERS = {
  engagement: "long_term",
  interestAreas: ["Bilim & Teknoloji", "Tarih & Dünya"],
  phone: "0532 111 22 33",
  hasExperience: false,
  experience: null,
} as const;

const SAMPLE = { buffer: SAMPLE_PDF, fileName: "ornek-eser.pdf" };

/** A ready, plain reader (verified, adult, consented) submitting a sample. */
async function submitAs(user: User, note = "örnek eser notu") {
  return submitWriterApplication(
    actorOf(user),
    { ...ANSWERS, interestAreas: [...ANSWERS.interestAreas], sample: SAMPLE, note },
    noMeta,
  );
}

describe("submitting", () => {
  it("creates the application, stores the sample and notifies the applicant", async () => {
    const applicant = await createUser({ email: "aday@example.com" });

    const application = await submitAs(applicant);

    expect(application.status).toBe("submitted");
    expect(application.sampleMediaId).not.toBeNull();

    const stored = await db
      .select()
      .from(writerApplications)
      .where(eq(writerApplications.id, application.id))
      .limit(1);
    expect(stored[0]!.note).toBe("örnek eser notu");

    expect(mailbox.lastTo("aday@example.com")?.subject).toContain("alındı");
  });

  it("stores the answers and saves the contact number on the account", async () => {
    const applicant = await createUser({ email: "yanitlar@example.com" });

    const application = await submitWriterApplication(
      actorOf(applicant),
      {
        ...ANSWERS,
        // Picked out of order; stored in the areas' own order
        interestAreas: ["Tarih & Dünya", "Bilim & Teknoloji"],
        hasExperience: true,
        experience: "Okul gazetesinde iki yıl yazdım.",
        sample: SAMPLE,
      },
      noMeta,
    );

    expect(application.engagement).toBe("long_term");
    expect(application.interestAreas).toEqual(["Bilim & Teknoloji", "Tarih & Dünya"]);
    expect(application.hasExperience).toBe(true);
    expect(application.experience).toBe("Okul gazetesinde iki yıl yazdım.");
    expect((await reloadUser(applicant.id)).phone).toBe("05321112233");
  });

  it("accepts a one-time application without a sample file", async () => {
    const applicant = await createUser({ email: "dosyasiz@example.com" });

    const application = await submitWriterApplication(
      actorOf(applicant),
      { ...ANSWERS, interestAreas: ["Pop Culture"], engagement: "one_time", sample: null },
      noMeta,
    );

    expect(application.status).toBe("submitted");
    expect(application.engagement).toBe("one_time");
    expect(application.sampleMediaId).toBeNull();
  });

  it("refuses a long-term application without a sample file", async () => {
    const applicant = await createUser({ email: "uzun-dosyasiz@example.com" });

    const error = await captureError(
      submitWriterApplication(
        actorOf(applicant),
        { ...ANSWERS, interestAreas: ["Pop Culture"], sample: null },
        noMeta,
      ),
    );
    expect(error.status).toBe(400);
    expect(error.message).toMatch(/örnek yazı göndermek zorunludur/);
  });

  it("refuses each missing required answer with its own message", async () => {
    const applicant = await createUser({ email: "eksik@example.com" });
    const base = { ...ANSWERS, interestAreas: ["Pop Culture"], sample: SAMPLE };

    const cases: [Record<string, unknown>, RegExp][] = [
      [{ engagement: null }, /Uzun süreli mi tek seferlik mi/],
      [{ interestAreas: [] }, /en az bir kategoriyi/],
      [{ phone: null }, /İletişim numaranızı/],
      [{ phone: "12345" }, /Telefon numarası geçersiz/],
      [{ hasExperience: null }, /deneyiminiz olup olmadığını/],
      [{ hasExperience: true, experience: "  " }, /Deneyiminizi kısaca anlatın/],
    ];
    for (const [change, message] of cases) {
      const error = await captureError(
        submitWriterApplication(actorOf(applicant), { ...base, ...change }, noMeta),
      );
      expect(error.status, JSON.stringify(change)).toBe(400);
      expect(error.message, JSON.stringify(change)).toMatch(message);
    }
    // Nothing was stored along the way
    expect(await db.select().from(writerApplications)).toHaveLength(0);
  });

  it("refuses a category that is not an active area", async () => {
    const applicant = await createUser({ email: "sahte-alan@example.com" });

    const error = await captureError(
      submitWriterApplication(
        actorOf(applicant),
        { ...ANSWERS, interestAreas: ["Uydurma Kategori"], sample: SAMPLE },
        noMeta,
      ),
    );
    expect(error.status).toBe(400);
    expect(error.message).toMatch(/kategorilerden biri artık yok/);
  });

  it("drops the experience text when the applicant has none", async () => {
    const applicant = await createUser({ email: "deneyimsiz@example.com" });

    const application = await submitWriterApplication(
      actorOf(applicant),
      { ...ANSWERS, interestAreas: ["Pop Culture"], experience: "yazılmış ama yok dendi", sample: SAMPLE },
      noMeta,
    );
    expect(application.hasExperience).toBe(false);
    expect(application.experience).toBeNull();
  });

  it("refuses when a prerequisite is missing, naming the missing ones", async () => {
    const unverified = await createUser({ email: "unverified@example.com", emailVerified: false });

    const error = await captureError(submitAs(unverified));
    expect(error.status).toBe(409);
    expect(error.details?.requirements).toBeDefined();
    expect(error.details!.requirements!.join(" ")).toMatch(/doğrulanmamış/i);
  });

  it("refuses someone who already holds a staff role", async () => {
    const writer = await createUser({ role: "writer" });

    const error = await captureError(submitAs(writer));
    expect(error.status).toBe(403);
  });

  it("refuses a file that is neither PDF nor DOCX", async () => {
    const applicant = await createUser({ email: "text@example.com" });

    const error = await captureError(
      submitWriterApplication(
        actorOf(applicant),
        {
          ...ANSWERS,
          interestAreas: ["Pop Culture"],
          sample: { buffer: Buffer.from("duz metin dosyasi"), fileName: "notlar.txt" },
          note: null,
        },
        noMeta,
      ),
    );
    expect(error.status).toBe(400);
    expect(error.message).toMatch(/PDF ve DOCX/i);
  });

  it("enforces the 30 day cooldown", async () => {
    const applicant = await createUser({ email: "tekrar@example.com" });
    await submitAs(applicant);

    const cooldown = await cooldownInfo(applicant.id);
    expect(cooldown.withinCooldown).toBe(true);
    expect(cooldown.retryAt).not.toBeNull();

    const error = await captureError(submitAs(applicant));
    expect(error.status).toBe(429);
    expect(error.message).toMatch(/30 günde/i);
  });

  it("reports the latest application for the account page", async () => {
    const applicant = await createUser({ email: "son@example.com" });
    await submitAs(applicant, "ilk deneme");

    const latest = await latestApplication(applicant.id);
    expect(latest).not.toBeNull();
    expect(latest!.note).toBe("ilk deneme");
  });
});

describe("editor stage", () => {
  it("approves and passes the application to the admin queue", async () => {
    const admin = await createUser({ role: "admin" });
    const editor = await createUser({ role: "editor" });
    const applicant = await createUser({ email: "gecen@example.com" });
    const application = await submitAs(applicant);

    const decided = await editorDecideApplication(
      actorOf(editor),
      application.id,
      "approve",
      "eser incelemeden geçti",
      noMeta,
    );
    expect(decided.status).toBe("editor_approved");
    expect(decided.editorBy).toBe(editor.id);

    // The editor queue no longer has it; the admin queue does
    const editorQueue = await listApplicationsByStatus(actorOf(editor), ["submitted"]);
    expect(editorQueue).toHaveLength(0);
    const adminQueue = await listApplicationsByStatus(actorOf(admin), ["editor_approved"]);
    expect(adminQueue).toHaveLength(1);
    expect(adminQueue[0]!.id).toBe(application.id);
    // The admin pages link the applicant's name to /admin/users/:id
    expect(adminQueue[0]!.applicantId).toBe(applicant.id);

    expect(mailbox.lastTo("gecen@example.com")?.subject).toContain("editör onayından geçti");
  });

  it("rejects with a required reason", async () => {
    const editor = await createUser({ role: "editor" });
    const applicant = await createUser({ email: "reddedilen@example.com" });
    const application = await submitAs(applicant);

    // A rejection without a reason is refused
    const missingReason = await captureError(
      editorDecideApplication(actorOf(editor), application.id, "reject", null, noMeta),
    );
    expect(missingReason.status).toBe(400);

    const decided = await editorDecideApplication(
      actorOf(editor),
      application.id,
      "reject",
      "örnek eser dergi çizgisine uymuyor",
      noMeta,
    );
    expect(decided.status).toBe("editor_rejected");

    expect(mailbox.lastTo("reddedilen@example.com")?.text).toContain("dergi çizgisine uymuyor");
  });

  it("refuses a review without the editor role", async () => {
    const writer = await createUser({ role: "writer" });
    const applicant = await createUser({ email: "yetkisiz@example.com" });
    const application = await submitAs(applicant);

    const error = await captureError(
      editorDecideApplication(actorOf(writer), application.id, "approve", null, noMeta),
    );
    expect(error.status).toBe(403);
  });

  it("refuses to review one's own application", async () => {
    const applicant = await createUser({ email: "kendisi@example.com" });
    const application = await submitAs(applicant);

    // The applicant was promoted to editor meanwhile and sees their own row
    const error = await captureError(
      editorDecideApplication(actorOf({ ...applicant, role: "editor" }), application.id, "approve", null, noMeta),
    );
    expect(error.status).toBe(409);
  });
});

describe("admin stage", () => {
  it("approves and defines the current contract version", async () => {
    const admin = await createUser({ role: "admin" });
    const editor = await createUser({ role: "editor" });
    await publishContract(actorOf(admin));

    const applicant = await createUser({ email: "onayli@example.com" });
    const application = await submitAs(applicant);
    await editorDecideApplication(actorOf(editor), application.id, "approve", null, noMeta);

    const current = await getCurrentAgreement();
    const decided = await adminDecideApplication(
      actorOf(admin),
      application.id,
      "approve",
      "sözleşmeye uygun",
      noMeta,
    );

    expect(decided.status).toBe("admin_approved");
    expect(decided.contractVersionId).toBe(current!.id);

    expect(mailbox.lastTo("onayli@example.com")?.subject).toContain("sözleşmeniz hazır");
    expect(mailbox.lastTo("onayli@example.com")?.text).toContain(
      "/writer-application/contract",
    );
  });

  it("refuses to approve before the editor stage", async () => {
    const admin = await createUser({ role: "admin" });
    const applicant = await createUser({ email: "erken@example.com" });
    const application = await submitAs(applicant);

    const error = await captureError(
      adminDecideApplication(actorOf(admin), application.id, "approve", null, noMeta),
    );
    expect(error.status).toBe(409);
  });

  it("rejects with a required reason", async () => {
    const admin = await createUser({ role: "admin" });
    const editor = await createUser({ role: "editor" });
    const applicant = await createUser({ email: "yonetim-reddi@example.com" });
    const application = await submitAs(applicant);
    await editorDecideApplication(actorOf(editor), application.id, "approve", null, noMeta);

    const missingReason = await captureError(
      adminDecideApplication(actorOf(admin), application.id, "reject", null, noMeta),
    );
    expect(missingReason.status).toBe(400);

    const decided = await adminDecideApplication(
      actorOf(admin),
      application.id,
      "reject",
      "kadro planına uygun değil",
      noMeta,
    );
    expect(decided.status).toBe("admin_rejected");
  });
});

describe("the user page's process card (D-374)", () => {
  it("returns the newest application with both reviewers and counts the earlier ones", async () => {
    const admin = await createUser({ role: "admin", displayName: "Yönetici Kişi" });
    const editor = await createUser({ role: "editor", displayName: "Editör Kişi" });
    await publishContract(actorOf(admin));
    const applicant = await createUser({ email: "surec@example.com" });

    // An older, closed application from before the cooldown window
    await db.insert(writerApplications).values({
      userId: applicant.id,
      status: "editor_rejected",
      submittedAt: new Date(Date.now() - 60 * 86_400_000),
    });

    const application = await submitAs(applicant);
    await editorDecideApplication(actorOf(editor), application.id, "approve", null, noMeta);
    await adminDecideApplication(actorOf(admin), application.id, "approve", "uygun", noMeta);

    const { latest, earlierCount } = await getApplicationProcess(actorOf(admin), applicant.id);
    expect(latest!.id).toBe(application.id);
    expect(latest!.status).toBe("admin_approved");
    expect(latest!.editorName).toBe("Editör Kişi");
    expect(latest!.adminName).toBe("Yönetici Kişi");
    expect(latest!.reviewNote).toBe("uygun");
    expect(earlierCount).toBe(1);
  });

  it("is empty for someone who never applied", async () => {
    const admin = await createUser({ role: "admin" });
    const reader = await createUser({ email: "basvurmadi@example.com" });

    expect(await getApplicationProcess(actorOf(admin), reader.id)).toEqual({
      latest: null,
      earlierCount: 0,
    });
  });

  it("is admin only", async () => {
    const editor = await createUser({ role: "editor" });
    const reader = await createUser({ email: "gizli@example.com" });

    const error = await captureError(getApplicationProcess(actorOf(editor), reader.id));
    expect(error.status).toBe(403);
  });
});

describe("contract signing (D-275: signed PDF, admin verification)", () => {
  /** A fully approved application whose contract the applicant can sign. */
  async function approvedApplication(email: string) {
    const admin = await createUser({ role: "admin" });
    const editor = await createUser({ role: "editor" });
    await publishContract(actorOf(admin));

    const applicant = await createUser({ email });
    const application = await submitAs(applicant);
    await editorDecideApplication(actorOf(editor), application.id, "approve", null, noMeta);
    await adminDecideApplication(actorOf(admin), application.id, "approve", null, noMeta);
    return { admin, applicant, application };
  }

  const upload = (who: User) =>
    uploadSignedContract(
      actorOf(who),
      { buffer: tinyPdf(), fileName: "imzali.pdf", declaredMime: "application/pdf" },
      noMeta,
    );

  it("turns the applicant into an active writer when the admin verifies the signed PDF", async () => {
    const { admin, applicant } = await approvedApplication("imzalayan@example.com");

    const { id } = await upload(applicant);
    // Uploading alone changes nothing about the account
    expect((await reloadUser(applicant.id)).role).toBe("user");

    await approveSignedContract(actorOf(admin), id, noMeta);

    const updated = await reloadUser(applicant.id);
    expect(updated.role).toBe("writer");
    expect(updated.writerStatus).toBe("active");

    const closed = await latestApplication(applicant.id);
    expect(closed!.status).toBe("signed");
    expect(closed!.signedAt).not.toBeNull();

    // The role change names the verifying admin; no checkbox acceptance is written
    const changes = await db.select().from(roleChanges).where(eq(roleChanges.userId, applicant.id));
    expect(changes).toHaveLength(1);
    expect(changes[0]!.oldRole).toBe("user");
    expect(changes[0]!.newRole).toBe("writer");
    expect(changes[0]!.changedBy).toBe(admin.id);
    expect(await db.select().from(agreementAcceptances).where(eq(agreementAcceptances.userId, applicant.id))).toHaveLength(0);
  });

  it("refuses an upload from someone without an approved application", async () => {
    await approvedApplication("sahip@example.com");
    const stranger = await createUser({ email: "yabanci@example.com" });

    const error = await captureError(upload(stranger));
    expect(error.status).toBe(403);
  });

  it("refuses an upload before the admin approval", async () => {
    const editor = await createUser({ role: "editor" });
    const admin = await createUser({ role: "admin" });
    await publishContract(actorOf(admin));

    const applicant = await createUser({ email: "acele@example.com" });
    const application = await submitAs(applicant);
    await editorDecideApplication(actorOf(editor), application.id, "approve", null, noMeta);

    const error = await captureError(upload(applicant));
    expect(error.status).toBe(403);
  });

  it("re-checks the promotion prerequisites at verification", async () => {
    const { admin, applicant } = await approvedApplication("yasakli-oldu@example.com");
    const { id } = await upload(applicant);
    await db.update(users).set({ isBanned: true }).where(eq(users.id, applicant.id));

    const error = await captureError(approveSignedContract(actorOf(admin), id, noMeta));
    expect(error.status).toBe(409);
    expect((await reloadUser(applicant.id)).role).toBe("user");
  });

  it("does not demote an applicant who already holds a staff role", async () => {
    const { admin, applicant } = await approvedApplication("once-terfi@example.com");
    await db.update(users).set({ role: "editor", updatedAt: new Date() }).where(eq(users.id, applicant.id));

    const { id } = await upload({ ...applicant, role: "editor" });
    await approveSignedContract(actorOf(admin), id, noMeta);

    expect((await reloadUser(applicant.id)).role).toBe("editor");
    expect((await latestApplication(applicant.id))!.status).toBe("admin_approved");
    expect(await db.select().from(roleChanges).where(eq(roleChanges.userId, applicant.id))).toHaveLength(0);
  });
});
