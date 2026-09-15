/**
 * The contact form (D-145): what it mails, what it refuses, and that it stores nothing.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db, type Database } from "@/db/client";
import { authAttempts, siteSettings } from "@/db/schema";
import { sendContactMessage } from "@/services/contact";
import { isAppError } from "@/lib/errors";
import { getMailAdapter, MemoryMailAdapter } from "@/lib/mail/transport";
import { resetTables, setupTestDatabase, teardownTestDatabase } from "../helpers/db";

let database: Database;

beforeAll(async () => {
  database = await setupTestDatabase();
});

afterAll(async () => {
  await teardownTestDatabase();
});

const outbox = () => (getMailAdapter() as MemoryMailAdapter).outbox;

beforeEach(async () => {
  await resetTables(database);
  (getMailAdapter() as MemoryMailAdapter).clear();
  // The form mails the address the imprint names, so the setting has to exist
  await db.insert(siteSettings).values({ key: "publisher_email", value: "iletisim@postscriptmag.com" });
});

const message = {
  name: "Deniz",
  email: "deniz@example.com",
  subject: "Merhaba",
  topic: "Sanat & Edebiyat",
  message: "Derginizi çok sevdim, bir sorum olacaktı.",
};

describe("sendContactMessage (D-145)", () => {
  it("mails the magazine with what the visitor wrote, and writes no row", async () => {
    await sendContactMessage(message, { ip: "203.0.113.5", userAgent: "vitest" });

    const sent = outbox();
    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe("iletisim@postscriptmag.com");
    expect(sent[0]?.subject).toContain("Merhaba");
    expect(sent[0]?.text).toContain("deniz@example.com");
    expect(sent[0]?.text).toContain("Derginizi çok sevdim");
  });

  it("refuses an empty message, a bad address and an over-long one", async () => {
    for (const bad of [
      { ...message, message: "kısa" },
      { ...message, email: "deniz" },
      { ...message, name: "" },
    ]) {
      const refused = await sendContactMessage(bad, { ip: "203.0.113.6", userAgent: "vitest" }).catch(
        (error: unknown) => error,
      );
      expect(isAppError(refused) && refused.status).toBe(400);
    }
    expect(outbox()).toHaveLength(0);
  });

  it("stops after three messages from the same address within the hour", async () => {
    for (let i = 0; i < 3; i++) {
      await sendContactMessage(message, { ip: "203.0.113.7", userAgent: "vitest" });
    }

    const refused = await sendContactMessage(message, { ip: "203.0.113.7", userAgent: "vitest" }).catch(
      (error: unknown) => error,
    );
    expect(isAppError(refused) && refused.status).toBe(429);
    expect(outbox()).toHaveLength(3);

    const rows = await db.select().from(authAttempts);
    expect(rows.some((row) => row.scope === "contact_form_ip")).toBe(true);
  });
});
