/**
 * The writer application pipeline (§6 of the writer-application module).
 *
 * Covers the whole flow against a real PostgreSQL: submitting with a sample
 * work, the 30 day cooldown, the staged editor → admin approvals, and the
 * contract signature that is the only thing that turns the account into a
 * writer.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { agreementAcceptances, roleChanges, users, writerApplications } from "@/db/schema";
import {
  adminDecideApplication,
  cooldownInfo,
  editorDecideApplication,
  latestApplication,
  listApplicationsByStatus,
  signApplicationContract,
  submitWriterApplication,
} from "@/services/writer-applications";
import { getCurrentAgreement, renderAgreementForWriter } from "@/services/agreements";
import { MemoryMailAdapter, setMailAdapter } from "@/lib/mail/transport";
import { MemoryStorageAdapter, setStorageAdapter } from "@/lib/storage";
import { isAppError } from "@/lib/errors";
import { resetTables, setupTestDatabase, teardownTestDatabase } from "../helpers/db";
import {
  actorOf,
  createUser,
  noMeta,
  publishContract,
  reloadUser,
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

/** A ready, plain reader (verified, adult, consented) submitting a sample. */
async function submitAs(user: User, note = "örnek eser notu") {
  return submitWriterApplication(
    actorOf(user),
    { buffer: SAMPLE_PDF, fileName: "ornek-eser.pdf", note },
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
        { buffer: Buffer.from("duz metin dosyasi"), fileName: "notlar.txt", note: null },
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

describe("contract signing", () => {
  /** A fully approved application whose contract the applicant can sign. */
  async function approvedApplication(email: string) {
    const admin = await createUser({ role: "admin" });
    const editor = await createUser({ role: "editor" });
    await publishContract(actorOf(admin));

    const applicant = await createUser({ email });
    const application = await submitAs(applicant);
    await editorDecideApplication(actorOf(editor), application.id, "approve", null, noMeta);
    await adminDecideApplication(actorOf(admin), application.id, "approve", null, noMeta);
    return { applicant, application };
  }

  it("turns the applicant into an active writer on signature", async () => {
    const { applicant, application } = await approvedApplication("imzalayan@example.com");

    const current = await getCurrentAgreement();
    const preview = await renderAgreementForWriter(applicant);

    await signApplicationContract(
      actorOf(applicant),
      application.id,
      { agreementVersionId: current!.id, renderedHash: preview.hash, acknowledged: true },
      noMeta,
    );

    // The account is now a writer and active
    const updated = await reloadUser(applicant.id);
    expect(updated.role).toBe("writer");
    expect(updated.writerStatus).toBe("active");

    // The application is closed
    const closed = await latestApplication(applicant.id);
    expect(closed!.status).toBe("signed");
    expect(closed!.signedAt).not.toBeNull();

    // The acceptance and the role change are both recorded
    const acceptances = await db
      .select()
      .from(agreementAcceptances)
      .where(eq(agreementAcceptances.userId, applicant.id));
    expect(acceptances).toHaveLength(1);

    const changes = await db
      .select()
      .from(roleChanges)
      .where(eq(roleChanges.userId, applicant.id));
    expect(changes).toHaveLength(1);
    expect(changes[0]!.oldRole).toBe("user");
    expect(changes[0]!.newRole).toBe("writer");

    expect(mailbox.lastTo("imzalayan@example.com")?.subject).toContain("Sözleşme onayınız");
  });

  it("refuses a signature from anyone but the owner", async () => {
    const { application } = await approvedApplication("sahip@example.com");
    const stranger = await createUser({ email: "yabanci@example.com" });

    const current = await getCurrentAgreement();
    const preview = await renderAgreementForWriter(stranger);

    const error = await captureError(
      signApplicationContract(
        actorOf(stranger),
        application.id,
        { agreementVersionId: current!.id, renderedHash: preview.hash, acknowledged: true },
        noMeta,
      ),
    );
    expect(error.status).toBe(403);
  });

  it("refuses a signature whose hash does not match the rendered text", async () => {
    const { applicant, application } = await approvedApplication("hash@example.com");

    const current = await getCurrentAgreement();
    const error = await captureError(
      signApplicationContract(
        actorOf(applicant),
        application.id,
        {
          agreementVersionId: current!.id,
          renderedHash: "0".repeat(64),
          acknowledged: true,
        },
        noMeta,
      ),
    );
    expect(error.status).toBe(409);
  });

  it("refuses signing before the admin approval", async () => {
    const editor = await createUser({ role: "editor" });
    const admin = await createUser({ role: "admin" });
    await publishContract(actorOf(admin));

    const applicant = await createUser({ email: "acele@example.com" });
    const application = await submitAs(applicant);
    await editorDecideApplication(actorOf(editor), application.id, "approve", null, noMeta);

    const current = await getCurrentAgreement();
    const preview = await renderAgreementForWriter(applicant);

    const error = await captureError(
      signApplicationContract(
        actorOf(applicant),
        application.id,
        { agreementVersionId: current!.id, renderedHash: preview.hash, acknowledged: true },
        noMeta,
      ),
    );
    expect(error.status).toBe(409);
  });

  it("refuses a signature once the applicant already holds a staff role", async () => {
    const { applicant, application } = await approvedApplication("once-terfi@example.com");

    // The applicant was promoted directly by the admin in the meantime
    await db
      .update(users)
      .set({ role: "editor", updatedAt: new Date() })
      .where(eq(users.id, applicant.id));

    const current = await getCurrentAgreement();
    const preview = await renderAgreementForWriter(applicant);

    const error = await captureError(
      signApplicationContract(
        actorOf({ ...applicant, role: "editor" }),
        application.id,
        { agreementVersionId: current!.id, renderedHash: preview.hash, acknowledged: true },
        noMeta,
      ),
    );
    expect(error.status).toBe(409);
  });
});