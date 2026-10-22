/**
 * Signed contract files against the hash taken at upload (D-348): a changed or
 * missing file is never verified, is flagged in the archive, and the daily run
 * tells the admins. Nothing is repaired automatically.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { auditLog, media, notifications, signedContracts } from "@/db/schema";
import { isAppError } from "@/lib/errors";
import { MemoryStorageAdapter, setStorageAdapter } from "@/lib/storage";
import { verifySignedContractFiles } from "@/services/contract-integrity";
import { approveSignedContract, countersignZipEntries, uploadSignedContract } from "@/services/signed-contracts";
import { resetTables, setupTestDatabase, teardownTestDatabase } from "../helpers/db";
import { actorOf, createUser, noMeta, publishContract, tinyPdf } from "../helpers/factories";

let database: Database;
const storage = new MemoryStorageAdapter();

beforeAll(async () => {
  database = await setupTestDatabase();
  setStorageAdapter(storage);
});

afterAll(async () => {
  await teardownTestDatabase();
});

beforeEach(async () => {
  await resetTables(database);
  storage.clear();
});

const pdf = { buffer: tinyPdf(), fileName: "imzali.pdf", declaredMime: "application/pdf" };

async function uploaded() {
  const admin = await createUser({ role: "admin" });
  await publishContract(actorOf(admin));
  const writer = await createUser({ role: "writer", writerStatus: "pending_agreement" });
  const { id } = await uploadSignedContract(actorOf(writer), pdf, noMeta);
  const [row] = await db.select().from(signedContracts).where(eq(signedContracts.id, id));
  const [file] = await db.select().from(media).where(eq(media.id, row!.fileMediaId));
  return { admin, writer, id, key: file!.storageKey };
}

/** Swaps the stored bytes behind the record's back, as a storage-side edit would. */
async function tamper(key: string) {
  await storage.put({ bucket: "media", key, body: Buffer.concat([tinyPdf(), Buffer.from("% eklendi")]), mime: "application/pdf" });
}

async function failures(id: string) {
  return db
    .select()
    .from(auditLog)
    .where(and(eq(auditLog.entityId, id), eq(auditLog.action, "signed_contract.integrity_failed")));
}

describe("verifying an upload", () => {
  it("refuses a file whose bytes changed since upload and logs it", async () => {
    const { admin, id, key } = await uploaded();
    await tamper(key);

    const error = await approveSignedContract(actorOf(admin), id, noMeta).catch((caught: unknown) => caught);
    expect(isAppError(error) && error.status).toBe(409);
    const [row] = await db.select().from(signedContracts).where(eq(signedContracts.id, id));
    expect(row!.status).toBe("pending");
    expect(await failures(id)).toHaveLength(1);
  });

  it("refuses a file missing from storage", async () => {
    const { admin, id, key } = await uploaded();
    await storage.remove({ bucket: "media", key });

    const error = await approveSignedContract(actorOf(admin), id, noMeta).catch((caught: unknown) => caught);
    expect(isAppError(error) && error.status).toBe(409);
    const [entry] = await failures(id);
    expect((entry!.after as { kind: string }).kind).toBe("missing");
  });

  it("verifies an intact file as before", async () => {
    const { admin, id } = await uploaded();
    await approveSignedContract(actorOf(admin), id, noMeta);
    const [row] = await db.select().from(signedContracts).where(eq(signedContracts.id, id));
    expect(row!.status).toBe("approved");
    expect(await failures(id)).toHaveLength(0);
  });
});

describe("the daily check", () => {
  it("counts every file, logs each failure and tells the admins once", async () => {
    const { admin, id, key } = await uploaded();
    expect(await verifySignedContractFiles()).toEqual({ checked: 1, failed: 0 });

    await tamper(key);
    expect(await verifySignedContractFiles()).toEqual({ checked: 1, failed: 1 });
    expect(await failures(id)).toHaveLength(1);
    const told = await db.select().from(notifications).where(eq(notifications.userId, admin.id));
    expect(told.map((row) => row.kind)).toEqual(["signed_contract.integrity_failed"]);
  });
});

describe("the archive download", () => {
  it("lists every file with its upload hash and marks a changed one", async () => {
    const { admin, id, key } = await uploaded();
    await approveSignedContract(actorOf(admin), id, noMeta);
    await tamper(key);

    const { entries } = await countersignZipEntries(actorOf(admin), "all");
    const files = [];
    for await (const entry of entries) files.push(entry);

    expect(files.map((file) => file.name)[0]).toMatch(/^UYUMSUZ - /);
    const sums = files.find((file) => file.name === "SHA256SUMS.txt");
    const [row] = await db.select().from(signedContracts).where(eq(signedContracts.id, id));
    expect(new TextDecoder().decode(sums!.data)).toContain(row!.fileSha256);
    expect(await failures(id)).toHaveLength(1);
  });
});
