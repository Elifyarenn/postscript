/**
 * The writer lead and category quota module (module 5): the public interest
 * form's rules, the category CRUD, and the admin's lead inbox.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { writerLeads } from "@/db/schema";
import {
  applyAsWriterLead,
  createCategory,
  deleteCategory,
  listCategoriesWithQuota,
  listLeads,
  updateCategory,
  updateLead,
} from "@/services/leads";
import { MemoryMailAdapter, setMailAdapter } from "@/lib/mail/transport";
import { isAppError } from "@/lib/errors";
import { resetTables, setupTestDatabase, teardownTestDatabase } from "../helpers/db";
import { actorOf, createUser, noMeta } from "../helpers/factories";
import type { Actor } from "@/lib/auth/rbac";

let database: Database;
const mailbox = new MemoryMailAdapter();
let admin: Actor | null = null;

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
  const user = await createUser({ role: "admin" });
  admin = actorOf(user);
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

const APPLICANT = {
  fullName: "Deniz Yazar",
  birthDate: "1992-05-05",
  phone: "0 532 111 22 33",
  email: "aday@example.com",
};

describe("categories", () => {
  it("creates, updates and soft deletes a category", async () => {
    const created = await createCategory(admin!, { name: "Fotoğrafçılık", maxQuota: 2 }, noMeta);
    expect(created.maxQuota).toBe(2);

    const updated = await updateCategory(admin!, created.id, { isActive: false }, noMeta);
    expect(updated.isActive).toBe(false);

    await deleteCategory(admin!, created.id, noMeta);
    const list = await listCategoriesWithQuota(true);
    expect(list.find((c) => c.id === created.id)).toBeUndefined();
  });

  it("refuses a duplicate name and a non-admin", async () => {
    const created = await createCategory(admin!, { name: "Felsefe" }, noMeta);
    const duplicate = await captureError(
      createCategory(admin!, { name: "felsefe" }, noMeta),
    );
    expect(duplicate.status).toBe(409);

    const reader = await createUser();
    const refused = await captureError(
      createCategory(actorOf(reader), { name: "x" }, noMeta),
    );
    expect(refused.status).toBe(403);
  });
});

describe("the public interest form", () => {
  async function withCategories(extra: object = {}) {
    const a = await createCategory(admin!, { name: "A Kategorisi", maxQuota: 3 }, noMeta);
    const b = await createCategory(admin!, { name: "B Kategorisi", maxQuota: 3 }, noMeta);
    return { a, b, ...extra };
  }

  it("stores a lead as pending with its chosen categories", async () => {
    const { a, b } = await withCategories();
    const result = await applyAsWriterLead(
      { ...APPLICANT, categoryIds: [a.id, b.id] },
      noMeta,
    );
    expect(result.status).toBe("pending");

    const rows = await db.select().from(writerLeads).where(eq(writerLeads.id, result.id));
    expect(rows[0]!.phone).toBe("05321112233"); // normalised
  });

  it("rejects more than three categories with 400", async () => {
    const { a, b } = await withCategories();
    const c = await createCategory(admin!, { name: "C Kategorisi" }, noMeta);
    const d = await createCategory(admin!, { name: "D Kategorisi" }, noMeta);

    const error = await captureError(
      applyAsWriterLead(
        { ...APPLICANT, categoryIds: [a.id, b.id, c.id, d.id] },
        noMeta,
      ),
    );
    expect(error.status).toBe(400);
    expect(JSON.stringify(error.details?.categoryIds ?? [])).toMatch(/En fazla 3/);
  });

  it("rejects a full category with 400", async () => {
    const { a, b } = await withCategories();
    // Two other leads approved in category b fill it (quota 3 → 2/3 now)
    for (const email of ["x@example.com", "y@example.com"]) {
      const lead = await applyAsWriterLead({ ...APPLICANT, email, categoryIds: [b.id] }, noMeta);
      await updateLead(admin!, lead.id, { status: "approved" }, noMeta);
    }
    const list = await listCategoriesWithQuota(false);
    expect(list.find((c) => c.id === b.id)!.currentCount).toBe(2);

    // The third slot is still open for one more approval, but the form must
    // refuse a third approval attempt's application only when truly full:
    // approve one more, then the category is full and new applications fail
    const last = await applyAsWriterLead(
      { ...APPLICANT, email: "z@example.com", categoryIds: [b.id] },
      noMeta,
    );
    await updateLead(admin!, last.id, { status: "approved" }, noMeta);

    const error = await captureError(
      applyAsWriterLead(
        { ...APPLICANT, email: "dolu@example.com", categoryIds: [b.id] },
        noMeta,
      ),
    );
    expect(error.status).toBe(400);
    expect(JSON.stringify(error.details?.categories ?? [])).toMatch(/kontenjanı dolu/i);
  });

  it("rejects a duplicate e-mail", async () => {
    const { a } = await withCategories();
    await applyAsWriterLead({ ...APPLICANT, categoryIds: [a.id] }, noMeta);

    const error = await captureError(
      applyAsWriterLead({ ...APPLICANT, categoryIds: [a.id] }, noMeta),
    );
    expect(error.status).toBe(409);
  });
});

describe("admin lead management", () => {
  it("lists leads with their categories and approves within quota", async () => {
    const a = await createCategory(admin!, { name: "Teknoloji", maxQuota: 1 }, noMeta);
    const b = await createCategory(admin!, { name: "Sanat", maxQuota: 1 }, noMeta);

    const lead = await applyAsWriterLead(
      { ...APPLICANT, categoryIds: [a.id, b.id] },
      noMeta,
    );

    const updated = await updateLead(admin!, lead.id, { status: "approved" }, noMeta);
    expect(updated.status).toBe("approved");

    const list = await listLeads(admin!);
    expect(list).toHaveLength(1);
    expect(list[0]!.categories).toHaveLength(2);

    const quota = await listCategoriesWithQuota(false);
    expect(quota.find((c) => c.id === a.id)!.currentCount).toBe(1);
    expect(quota.find((c) => c.id === a.id)!.full).toBe(true);
  });

  it("refuses to approve beyond a category quota", async () => {
    const a = await createCategory(admin!, { name: "Teknoloji", maxQuota: 1 }, noMeta);

    // Both leads apply while the category is still open (0/1)
    const first = await applyAsWriterLead(
      { ...APPLICANT, categoryIds: [a.id] },
      noMeta,
    );
    const second = await applyAsWriterLead(
      { ...APPLICANT, email: "ikinci@example.com", categoryIds: [a.id] },
      noMeta,
    );

    await updateLead(admin!, first.id, { status: "approved" }, noMeta);

    // The category is full now: the second approval must be refused
    const error = await captureError(
      updateLead(admin!, second.id, { status: "approved" }, noMeta),
    );
    expect(JSON.stringify(error.details?.categories ?? [])).toMatch(/kontenjanı dolu/i);
  });

  it("frees the quota when an approval is moved back to rejected", async () => {
    const a = await createCategory(admin!, { name: "Teknoloji", maxQuota: 1 }, noMeta);
    const first = await applyAsWriterLead({ ...APPLICANT, categoryIds: [a.id] }, noMeta);
    const second = await applyAsWriterLead(
      { ...APPLICANT, email: "ikinci@example.com", categoryIds: [a.id] },
      noMeta,
    );

    await updateLead(admin!, first.id, { status: "approved" }, noMeta);
    await updateLead(admin!, first.id, { status: "rejected" }, noMeta);

    const approved = await updateLead(admin!, second.id, { status: "approved" }, noMeta);
    expect(approved.status).toBe("approved");
  });

  it("refuses a non-admin", async () => {
    const reader = await createUser();
    const error = await captureError(listLeads(actorOf(reader), 10));
    expect(error.status).toBe(403);
  });
});