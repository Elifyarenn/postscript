/**
 * Signed contracts (D-275): the member uploads a signed PDF, an admin records
 * the signed contract verification or rejects it with a reason. Only a
 * verified upload for the current version counts as having a contract; the
 * old checkbox acceptances stay in place and count for nothing.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { agreementAcceptances, agreementVersions, media, signedContracts, users, type User } from "@/db/schema";
import { createSession } from "@/lib/auth/session";
import { isAppError } from "@/lib/errors";
import { MemoryStorageAdapter, setStorageAdapter } from "@/lib/storage";
import {
  acceptanceReport,
  getCurrentAgreement,
  hasAcceptedCurrentAgreement,
  publishAgreementVersion,
} from "@/services/agreements";
import {
  approveSignedContract,
  listOwnSignedContracts,
  listSignedContracts,
  rejectSignedContract,
  uploadSignedContract,
} from "@/services/signed-contracts";
import { GET as getMediaRoute } from "@/app/api/media/[id]/route";
import { resetTables, setupTestDatabase, teardownTestDatabase } from "../helpers/db";
import { actorOf, createUser, noMeta, publishContract, reloadUser, tinyPdf } from "../helpers/factories";

const jar = vi.hoisted(() => ({ cookies: new Map<string, string>(), headers: new Headers() }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.cookies.has(name) ? { name, value: jar.cookies.get(name)! } : undefined),
    set: (name: string, value: string) => void jar.cookies.set(name, value),
    delete: (name: string) => void jar.cookies.delete(name),
  }),
  headers: async () => jar.headers,
}));

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
  jar.cookies.clear();
});

async function captureError(promise: Promise<unknown>) {
  try {
    await promise;
    return null;
  } catch (error) {
    if (isAppError(error)) return error;
    throw error;
  }
}

const pdf = { buffer: tinyPdf(), fileName: "Sozlesme-Imzali.PDF", declaredMime: "application/pdf" };

async function setup() {
  const admin = await createUser({ role: "admin" });
  const otherAdmin = await createUser({ role: "admin" });
  await publishContract(actorOf(admin));
  const writer = await createUser({ role: "writer", writerStatus: "pending_agreement" });
  return { admin, otherAdmin, writer };
}

describe("what may be uploaded", () => {
  it("takes only a PDF: by name, by declared type and by its bytes", async () => {
    const { writer } = await setup();
    const actor = actorOf(writer);

    const byName = await captureError(uploadSignedContract(actor, { ...pdf, fileName: "sozlesme.png" }, noMeta));
    expect(byName?.status).toBe(400);

    const byType = await captureError(uploadSignedContract(actor, { ...pdf, declaredMime: "image/png" }, noMeta));
    expect(byType?.status).toBe(400);

    // A PNG renamed to .pdf and declared as a PDF is still a PNG
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);
    const byBytes = await captureError(uploadSignedContract(actor, { ...pdf, buffer: png }, noMeta));
    expect(byBytes?.status).toBe(400);

    const tooBig = Buffer.concat([tinyPdf(), Buffer.alloc(4 * 1024 * 1024)]);
    const bySize = await captureError(uploadSignedContract(actor, { ...pdf, buffer: tooBig }, noMeta));
    expect(bySize?.status).toBe(400);

    expect(await db.select().from(signedContracts)).toHaveLength(0);
    expect(storage.objects.size).toBe(0);
  });

  it("stores the file privately as a contract document and records it as pending", async () => {
    const { writer } = await setup();
    const { id } = await uploadSignedContract(actorOf(writer), pdf, noMeta);

    const [row] = await db.select().from(signedContracts).where(eq(signedContracts.id, id));
    expect(row!.status).toBe("pending");
    expect(row!.agreementVersionId).toBe((await getCurrentAgreement())!.id);
    expect(row!.fileSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(row!.reviewedAt).toBeNull();

    const [file] = await db.select().from(media).where(eq(media.id, row!.fileMediaId));
    expect(file!.licenseType).toBe("contract_pdf");
    expect(file!.storageKey.startsWith("contracts/signed/")).toBe(true);

    // Uploading is not having a contract
    expect(await hasAcceptedCurrentAgreement(writer.id)).toBe(false);
  });

  it("keeps one upload waiting at a time", async () => {
    const { writer } = await setup();
    await uploadSignedContract(actorOf(writer), pdf, noMeta);
    const error = await captureError(uploadSignedContract(actorOf(writer), pdf, noMeta));
    expect(error?.status).toBe(409);
  });

  it("refuses an account that is neither on the team nor an approved applicant", async () => {
    await setup();
    const member = await createUser({ role: "user" });
    const error = await captureError(uploadSignedContract(actorOf(member), pdf, noMeta));
    expect(error?.status).toBe(403);
  });
});

describe("the signed contract verification", () => {
  it("approves: records who and when, activates the writer, and now counts", async () => {
    const { admin, writer } = await setup();
    const { id } = await uploadSignedContract(actorOf(writer), pdf, noMeta);

    await approveSignedContract(actorOf(admin), id, noMeta);

    const [row] = await db.select().from(signedContracts).where(eq(signedContracts.id, id));
    expect(row!.status).toBe("approved");
    expect(row!.reviewedBy).toBe(admin.id);
    expect(row!.reviewedAt).not.toBeNull();
    expect((await reloadUser(writer.id)).writerStatus).toBe("active");
    expect(await hasAcceptedCurrentAgreement(writer.id)).toBe(true);

    const report = await acceptanceReport(actorOf(admin));
    expect(report.accepted.map((entry) => entry.id)).toEqual([writer.id]);

    // Decided once
    expect((await captureError(approveSignedContract(actorOf(admin), id, noMeta)))?.status).toBe(409);
    expect((await captureError(uploadSignedContract(actorOf(writer), pdf, noMeta)))?.status).toBe(409);
  });

  it("rejects only with a reason, which the member reads before uploading again", async () => {
    const { admin, writer } = await setup();
    const { id } = await uploadSignedContract(actorOf(writer), pdf, noMeta);

    const noReason = await captureError(rejectSignedContract(actorOf(admin), id, "  ", noMeta));
    expect(noReason?.status).toBe(400);

    await rejectSignedContract(actorOf(admin), id, "İmza sayfası eksik", noMeta);
    const own = await listOwnSignedContracts(actorOf(writer));
    expect(own[0]).toMatchObject({ status: "rejected", rejectionReason: "İmza sayfası eksik" });
    expect(await hasAcceptedCurrentAgreement(writer.id)).toBe(false);

    const again = await uploadSignedContract(actorOf(writer), pdf, noMeta);
    expect((await listOwnSignedContracts(actorOf(writer))).map((row) => row.status)).toEqual(["pending", "rejected"]);
    expect(again.id).not.toBe(id);
  });

  it("is the admin's alone, and never on their own upload", async () => {
    const { admin, otherAdmin, writer } = await setup();
    const { id } = await uploadSignedContract(actorOf(writer), pdf, noMeta);
    const editor = await createUser({ role: "editor" });
    const peer = await createUser({ role: "writer" });

    for (const actor of [actorOf(editor), actorOf(peer), actorOf(writer)]) {
      expect((await captureError(approveSignedContract(actor, id, noMeta)))?.status).toBe(403);
      expect((await captureError(rejectSignedContract(actor, id, "neden", noMeta)))?.status).toBe(403);
      expect((await captureError(listSignedContracts(actor)))?.status).toBe(403);
    }

    const own = await uploadSignedContract(actorOf(admin), pdf, noMeta);
    expect((await captureError(approveSignedContract(actorOf(admin), own.id, noMeta)))?.status).toBe(403);
    await approveSignedContract(actorOf(otherAdmin), own.id, noMeta);
  });

  it("lists every upload for the admin with name, role, date and status", async () => {
    const { admin, writer } = await setup();
    await uploadSignedContract(actorOf(writer), pdf, noMeta);

    const [item] = await listSignedContracts(actorOf(admin));
    expect(item).toMatchObject({
      memberId: writer.id,
      memberName: writer.displayName,
      memberRole: "writer",
      status: "pending",
      isCurrentVersion: true,
    });
    expect(item!.uploadedAt).toBeInstanceOf(Date);
  });

  it("shows a member only their own uploads", async () => {
    const { writer } = await setup();
    const other = await createUser({ role: "writer" });
    await uploadSignedContract(actorOf(other), pdf, noMeta);
    expect(await listOwnSignedContracts(actorOf(writer))).toHaveLength(0);
  });

  it("does not verify a contract signed on an older version", async () => {
    const { admin, writer } = await setup();
    const { id } = await uploadSignedContract(actorOf(writer), pdf, noMeta);

    // A new version is published while the upload waits. The template file
    // cannot be versioned twice, so the next version is inserted by hand.
    const current = (await getCurrentAgreement())!;
    const [next] = await db
      .insert(agreementVersions)
      .values({
        version: current.version + 1,
        title: current.title,
        bodyMarkdown: `${current.bodyMarkdown}\n`,
        bodyHash: "f".repeat(64),
      })
      .returning();
    await publishAgreementVersion(actorOf(admin), next!.id, noMeta);

    expect((await captureError(approveSignedContract(actorOf(admin), id, noMeta)))?.status).toBe(409);
    // A verification of the old version would not count for the new one anyway
    expect(await hasAcceptedCurrentAgreement(writer.id)).toBe(false);
  });
});

describe("the old checkbox acceptances", () => {
  it("stay untouched and no longer count as a contract", async () => {
    const { admin, writer } = await setup();
    const current = await getCurrentAgreement();
    const [legacy] = await db
      .insert(agreementAcceptances)
      .values({ userId: writer.id, agreementVersionId: current!.id, bodyHashAtAcceptance: "a".repeat(64) })
      .returning();

    expect(await hasAcceptedCurrentAgreement(writer.id)).toBe(false);
    expect((await acceptanceReport(actorOf(admin))).accepted).toHaveLength(0);

    const { id } = await uploadSignedContract(actorOf(writer), pdf, noMeta);
    await approveSignedContract(actorOf(admin), id, noMeta);

    const [still] = await db.select().from(agreementAcceptances).where(eq(agreementAcceptances.id, legacy!.id));
    expect(still).toEqual(legacy);
  });
});

describe("GET /api/media/:id for a signed contract", () => {
  async function fetchAs(user: User | null, id: string): Promise<number> {
    jar.cookies.clear();
    if (user) await createSession({ userId: user.id, ip: noMeta.ip, userAgent: noMeta.userAgent });
    const response = await getMediaRoute(new Request(`http://localhost/api/media/${id}`), {
      params: Promise.resolve({ id }),
    });
    return response.status;
  }

  it("opens for its owner and an admin, and for nobody else", async () => {
    const { admin, writer } = await setup();
    await db.update(users).set({ totpEnabledAt: new Date() }).where(eq(users.id, admin.id));
    const { id } = await uploadSignedContract(actorOf(writer), pdf, noMeta);
    const [row] = await db.select().from(signedContracts).where(eq(signedContracts.id, id));
    const fileId = row!.fileMediaId;

    expect(await fetchAs(writer, fileId)).toBe(200);
    expect(await fetchAs(await reloadUser(admin.id), fileId)).toBe(200);
    expect(await fetchAs(await createUser({ role: "writer" }), fileId)).toBe(403);
    expect(await fetchAs(await createUser({ role: "editor" }), fileId)).toBe(403);
    expect(await fetchAs(null, fileId)).toBe(401);
  });
});
