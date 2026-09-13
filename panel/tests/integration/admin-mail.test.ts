/**
 * Mail to the admins (D-098): a new content report and an application that
 * reached the admin's stage both reach every active admin's mailbox, and
 * neither mail carries what must stay inside the panel.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { users } from "@/db/schema";
import { reportContent } from "@/services/reports";
import { editorDecideApplication, submitWriterApplication } from "@/services/writer-applications";
import { MemoryMailAdapter, setMailAdapter } from "@/lib/mail/transport";
import { MemoryStorageAdapter, setStorageAdapter } from "@/lib/storage";
import { resetTables, setupTestDatabase, teardownTestDatabase } from "../helpers/db";
import { actorOf, createUser, noMeta } from "../helpers/factories";

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

describe("a new content report", () => {
  it("mails every active admin the kinds only", async () => {
    await createUser({ role: "admin", email: "yonetim1@example.com" });
    await createUser({ role: "admin", email: "yonetim2@example.com" });
    await createUser({ role: "admin", email: "yasakli@example.com", isBanned: true });
    const reporter = await createUser({ email: "bildiren@example.com", displayName: "Bildiren Üye" });
    const reported = await createUser({ email: "hedef@example.com" });
    await db
      .update(users)
      .set({ username: "hedefhesap", bio: "gizli biyografi" })
      .where(eq(users.id, reported.id));

    const input = {
      targetType: "member",
      targetId: reported.id,
      category: "spam",
      reason: "özel açıklama",
    };
    await reportContent(actorOf(reporter), input, noMeta);

    const mail = mailbox.lastTo("yonetim1@example.com");
    expect(mail?.subject).toContain("24 saat");
    expect(mail?.text).toContain("Bildirilen: Hesap");
    expect(mail?.text).toContain("Bildirim türü: Reklam veya spam");
    expect(mail?.text).toContain("/admin/community");
    for (const secret of ["hedefhesap", "gizli biyografi", "özel açıklama", "Bildiren Üye", "bildiren@example.com"]) {
      expect(mail?.text).not.toContain(secret);
    }

    expect(mailbox.lastTo("yonetim2@example.com")).toBeDefined();
    expect(mailbox.lastTo("yasakli@example.com")).toBeUndefined();

    // Reporting the same thing again adds nothing to the queue, so no new mail
    mailbox.clear();
    const again = await reportContent(actorOf(reporter), input, noMeta);
    expect(again.duplicate).toBe(true);
    expect(mailbox.outbox).toHaveLength(0);
  });
});

describe("an application reaching the admin's stage", () => {
  async function submitted() {
    const applicant = await createUser({ email: "aday@example.com", displayName: "Aday Kişi" });
    return submitWriterApplication(
      actorOf(applicant),
      { buffer: Buffer.from("%PDF-1.4\n% ornek"), fileName: "ornek.pdf", note: null },
      noMeta,
    );
  }

  it("mails the admins without the applicant's details", async () => {
    await createUser({ role: "admin", email: "yonetim@example.com" });
    const editor = await createUser({ role: "editor" });
    const application = await submitted();

    await editorDecideApplication(actorOf(editor), application.id, "approve", null, noMeta);

    const mail = mailbox.lastTo("yonetim@example.com");
    expect(mail?.subject).toContain("Yönetim onayı bekleyen");
    expect(mail?.text).toContain("/admin/applications");
    expect(mail?.text).not.toContain("Aday Kişi");
    expect(mail?.text).not.toContain("aday@example.com");
  });

  it("mails nobody on the admin side when the editor rejects", async () => {
    await createUser({ role: "admin", email: "yonetim@example.com" });
    const editor = await createUser({ role: "editor" });
    const application = await submitted();

    await editorDecideApplication(actorOf(editor), application.id, "reject", "Uygun değil.", noMeta);

    expect(mailbox.lastTo("yonetim@example.com")).toBeUndefined();
  });
});
