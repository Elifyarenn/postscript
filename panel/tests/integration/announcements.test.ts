/**
 * Internal announcements (module 5): severity drives acknowledgement, and the
 * read report covers exactly the announcement's audience.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db, type Database } from "@/db/client";
import {
  acknowledge,
  createAnnouncement,
  listAnnouncementsFor,
  publishAnnouncement,
  readReport,
} from "@/services/announcements";
import { MemoryMailAdapter, setMailAdapter } from "@/lib/mail/transport";
import { resetTables, setupTestDatabase, teardownTestDatabase } from "../helpers/db";
import { actorOf, createUser, noMeta } from "../helpers/factories";

let database: Database;
const mailbox = new MemoryMailAdapter();

beforeAll(async () => {
  database = await setupTestDatabase();
  setMailAdapter(mailbox);
});

afterAll(async () => {
  await teardownTestDatabase();
});

beforeEach(async () => {
  await resetTables(database);
  mailbox.clear();
});

async function publishAs(actorId: string, input: object) {
  const draft = await createAnnouncement(
    { id: actorId, role: "editor", writerStatus: null, editorStatus: null, emailVerifiedAt: new Date(), isBanned: false },
    input,
    noMeta,
  );
  return publishAnnouncement(
    { id: actorId, role: "admin", writerStatus: null, editorStatus: null, emailVerifiedAt: new Date(), isBanned: false },
    draft.id,
    noMeta,
  );
}

describe("severity", () => {
  it("defaults to info and only asks for acknowledgement when told so", async () => {
    const draft = await createAnnouncement(
      actorOf(await createUser({ role: "editor" })),
      {
        title: "Bilgilendirme",
        bodyMarkdown: "Sadece bilgi",
        audience: "writers",
        severity: "info",
        requiresAcknowledgement: false,
        pinned: false,
      },
      noMeta,
    );
    expect(draft.severity).toBe("info");
    expect(draft.requiresAcknowledgement).toBe(false);
  });

  it("forces an acknowledgement for critical announcements", async () => {
    const draft = await createAnnouncement(
      actorOf(await createUser({ role: "admin" })),
      {
        title: "Kritik",
        bodyMarkdown: "Acil aksiyon",
        audience: "writers",
        severity: "critical",
        requiresAcknowledgement: false, // ignored
        pinned: false,
      },
      noMeta,
    );
    expect(draft.severity).toBe("critical");
    expect(draft.requiresAcknowledgement).toBe(true);
  });
});

describe("audience and read report", () => {
  it("shows the severity to the audience and records acknowledgements", async () => {
    const admin = await createUser({ role: "admin" });
    const writer = await createUser({ role: "writer", writerStatus: "active" });
    const published = await publishAs(admin.id, {
      title: "Kritik duyuru",
      bodyMarkdown: "Oku ve onayla",
      audience: "writers",
      severity: "critical",
      requiresAcknowledgement: false,
      pinned: false,
    });

    const list = await listAnnouncementsFor(actorOf(writer));
    expect(list).toHaveLength(1);
    expect(list[0]!.severity).toBe("critical");
    expect(list[0]!.requiresAcknowledgement).toBe(true);
    expect(list[0]!.acknowledgedAt).toBeNull();

    await acknowledge(actorOf(writer), published.id, noMeta);
    const after = await listAnnouncementsFor(actorOf(writer));
    expect(after[0]!.acknowledgedAt).not.toBeNull();
  });

  it("reports only the announcement's real audience", async () => {
    const admin = await createUser({ role: "admin" });
    const writer = await createUser({ role: "writer" });
    const editor = await createUser({ role: "editor" });
    await publishAs(admin.id, {
      title: "Yazarlara özel",
      bodyMarkdown: "Sadece yazarlar",
      audience: "writers",
      severity: "important",
      requiresAcknowledgement: false,
      pinned: false,
    });

    const adminActor = actorOf(admin);
    const announcements = await listAnnouncementsFor(adminActor);
    const report = await readReport(adminActor, announcements[0]!.id);

    const emails = report.map((row) => row.email);
    expect(emails).toContain(writer.email);
    expect(emails).not.toContain(editor.email);
    expect(emails).not.toContain(admin.email);
  });
});