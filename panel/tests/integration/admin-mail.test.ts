/**
 * Mail to the admins (D-098): a new content report and an application that
 * reached the admin's stage both reach every active admin's mailbox, and
 * neither mail carries what must stay inside the panel.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { contentReports, users } from "@/db/schema";
import { remindOpenReports, reportContent } from "@/services/reports";
import { editorDecideApplication, submitWriterApplication } from "@/services/writer-applications";
import { MemoryMailAdapter, setMailAdapter } from "@/lib/mail/transport";
import { MemoryStorageAdapter, setStorageAdapter } from "@/lib/storage";
import {
  resetTables,
  seedDefaultWriterAreas,
  setupTestDatabase,
  teardownTestDatabase,
} from "../helpers/db";
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
  await seedDefaultWriterAreas();
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
    // The queue itself, not the community overview (D-367)
    expect(mail?.text).toContain("/admin/community/reports");
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
      {
        engagement: "long_term",
        interestAreas: ["Pop Culture"],
        phone: "0532 111 22 33",
        hasExperience: false,
        sample: { buffer: Buffer.from("%PDF-1.4\n% ornek"), fileName: "ornek.pdf" },
        note: null,
      },
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

describe("a report still open (D-367)", () => {
  async function openReport() {
    await createUser({ role: "admin", email: "yonetim1@example.com" });
    await createUser({ role: "admin", email: "yonetim2@example.com" });
    const reporter = await createUser();
    const reported = await createUser();
    await db.update(users).set({ username: "hedefhesap" }).where(eq(users.id, reported.id));
    await reportContent(
      actorOf(reporter),
      { targetType: "member", targetId: reported.id, category: "spam", reason: "özel açıklama" },
      noMeta,
    );
    mailbox.clear();
    const [report] = await db.select().from(contentReports);
    return report!;
  }

  const hoursAfter = (date: Date, hours: number) => new Date(date.getTime() + hours * 3_600_000);

  it("mails nobody before eighteen hours", async () => {
    const report = await openReport();
    expect(await remindOpenReports(hoursAfter(report.createdAt, 17))).toBe(0);
    expect(mailbox.outbox).toHaveLength(0);
  });

  it("reminds every admin once with the deadline, the kinds only, however often it runs", async () => {
    const report = await openReport();
    const later = hoursAfter(report.createdAt, 19);

    expect(await remindOpenReports(later)).toBe(1);
    const mail = mailbox.lastTo("yonetim1@example.com");
    expect(mail?.subject).toContain("hâlâ açık");
    expect(mail?.text).toContain("Son süre:");
    expect(mail?.text).toContain("/admin/community/reports");
    expect(mail?.text).not.toContain("özel açıklama");
    expect(mailbox.lastTo("yonetim2@example.com")).toBeDefined();

    mailbox.clear();
    await remindOpenReports(hoursAfter(report.createdAt, 20));
    await remindOpenReports(hoursAfter(report.createdAt, 30));
    expect(mailbox.outbox).toHaveLength(0);
  });

  it("says the time ran out when it first runs after the twenty-four hours", async () => {
    const report = await openReport();
    await remindOpenReports(hoursAfter(report.createdAt, 26));
    expect(mailbox.lastTo("yonetim1@example.com")?.subject).toContain("24 saati doldu");
  });

  it("leaves a settled report alone", async () => {
    const report = await openReport();
    await db.update(contentReports).set({ status: "dismissed", resolvedAt: new Date() });
    expect(await remindOpenReports(hoursAfter(report.createdAt, 19))).toBe(0);
    expect(mailbox.outbox).toHaveLength(0);
  });
});
