/**
 * Admin-managed writing areas (D-055): create, rename (which keeps the
 * writers in step), quota guards, disable, and the delete-only-when-empty
 * rule.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { users, writerAreas } from "@/db/schema";
import { db, type Database } from "@/db/client";
import {
  createWriterArea,
  deleteWriterArea,
  listAllWriterAreasWithQuota,
  listWriterAreasWithQuota,
  setWriterAreas,
  updateWriterArea,
} from "@/services/writer-areas";
import { isAppError } from "@/lib/errors";
import { resetTables, seedDefaultWriterAreas, setupTestDatabase, teardownTestDatabase } from "../helpers/db";
import { actorOf, createUser, noMeta, reloadUser } from "../helpers/factories";

let database: Database;
let actor: ReturnType<typeof actorOf>;

beforeAll(async () => {
  database = await setupTestDatabase();
});

afterAll(async () => {
  await teardownTestDatabase();
});

beforeEach(async () => {
  await resetTables(database);
  await seedDefaultWriterAreas();
  // A real admin row: the audit trail references the actor by id
  actor = actorOf(await createUser({ role: "admin" }));
});

async function captureError(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    if (isAppError(error)) return error;
    throw error;
  }
  throw new Error("expected the promise to reject");
}

async function areaByName(name: string) {
  const rows = await db.select().from(writerAreas).where(eq(writerAreas.name, name)).limit(1);
  return rows[0]!;
}

describe("creating areas", () => {
  it("adds an area at the end of the list", async () => {
    await createWriterArea(actor, { name: "  Yemek & Seyahat  ", quota: 5 }, noMeta);

    const row = await areaByName("Yemek & Seyahat");
    expect(row.quota).toBe(5);
    expect(row.isActive).toBe(true);

    const all = await listAllWriterAreasWithQuota();
    expect(all.at(-1)?.name).toBe("Yemek & Seyahat");
    expect(all.at(-1)?.sortOrder).toBeGreaterThan(all.at(-2)?.sortOrder ?? 0);
  });

  it("refuses a duplicate name", async () => {
    const error = await captureError(
      createWriterArea(actor, { name: "Sanat & Edebiyat", quota: 3 }, noMeta),
    );
    expect(error.code).toBe("conflict");
  });
});

describe("updating areas", () => {
  it("renames an area and keeps its writers in step", async () => {
    const writer = await createUser({ role: "writer", writerStatus: "active" });
    await db.update(users).set({ writerArea: "Sanat & Edebiyat" }).where(eq(users.id, writer.id));

    const row = await areaByName("Sanat & Edebiyat");
    await updateWriterArea(actor, { id: row.id, name: "Sanat & Kültür" }, noMeta);

    expect(await areaByName("Sanat & Kültür")).toBeTruthy();
    const held = await db.select().from(users).where(eq(users.id, writer.id)).limit(1);
    expect(held[0]!.writerArea).toBe("Sanat & Kültür");
  });

  it("keeps a writer's second slot in step when its area is renamed", async () => {
    const writer = await createUser({ role: "writer", writerStatus: "active" });
    await db
      .update(users)
      .set({ writerArea2: "Sanat & Edebiyat" })
      .where(eq(users.id, writer.id));

    const row = await areaByName("Sanat & Edebiyat");
    await updateWriterArea(actor, { id: row.id, name: "Sanat & Kültür" }, noMeta);

    const held = await reloadUser(writer.id);
    expect(held.writerArea2).toBe("Sanat & Kültür");
  });

  it("refuses to lower the quota below the writer count", async () => {
    const row = await areaByName("Sanat & Edebiyat");
    for (let index = 0; index < 2; index += 1) {
      const writer = await createUser({ role: "writer", writerStatus: "active" });
      await db.update(users).set({ writerArea: "Sanat & Edebiyat" }).where(eq(users.id, writer.id));
    }

    // 3 holds 2, but 1 does not
    await updateWriterArea(actor, { id: row.id, quota: 2 }, noMeta);
    const error = await captureError(
      updateWriterArea(actor, { id: row.id, quota: 1 }, noMeta),
    );
    expect(error.code).toBe("conflict");
  });

  it("disables an area so the public form stops offering it", async () => {
    const row = await areaByName("Eğlence & Dedikodu");
    await updateWriterArea(actor, { id: row.id, isActive: false }, noMeta);

    const publicAreas = await listWriterAreasWithQuota();
    expect(publicAreas.some((area) => area.name === "Eğlence & Dedikodu")).toBe(false);
    expect((await listAllWriterAreasWithQuota()).some((area) => area.name === "Eğlence & Dedikodu")).toBe(true);
  });
});

describe("deleting areas", () => {
  it("deletes an empty area", async () => {
    const row = await areaByName("Pop Culture");
    await deleteWriterArea(actor, row.id, noMeta);
    expect(await listAllWriterAreasWithQuota()).toHaveLength(10);
  });

  it("refuses to delete an area that has writers", async () => {
    const writer = await createUser({ role: "writer", writerStatus: "active" });
    await db.update(users).set({ writerArea: "Pop Culture" }).where(eq(users.id, writer.id));

    const row = await areaByName("Pop Culture");
    const error = await captureError(deleteWriterArea(actor, row.id, noMeta));
    expect(error.code).toBe("conflict");
    expect(await listAllWriterAreasWithQuota()).toHaveLength(11);
  });

  it("refuses to delete an unknown area", async () => {
    const error = await captureError(deleteWriterArea(actor, "00000000-0000-0000-0000-000000000000", noMeta));
    expect(error.code).toBe("not_found");
  });
});

describe("permissions", () => {
  it("refuses a non-admin actor", async () => {
    const editor = await createUser({ role: "editor" });
    const error = await captureError(
      createWriterArea(actorOf(editor), { name: "X", quota: 3 }, noMeta),
    );
    expect(error.code).toBe("forbidden");
  });
});

describe("setting a writer's own areas (admin only, D-057)", () => {
  it("changes the first area and adds a second one", async () => {
    const writer = await createUser({ role: "writer", writerStatus: "active" });
    await db
      .update(users)
      .set({ writerArea: "Sanat & Edebiyat" })
      .where(eq(users.id, writer.id));

    await setWriterAreas(
      actor,
      writer.id,
      { area: "Bilim & Teknoloji", area2: "Felsefe & Düşünce" },
      noMeta,
    );

    const held = await reloadUser(writer.id);
    expect(held.writerArea).toBe("Bilim & Teknoloji");
    expect(held.writerArea2).toBe("Felsefe & Düşünce");
  });

  it("clears both areas when nulls are passed", async () => {
    const writer = await createUser({ role: "writer", writerStatus: "active" });
    await db
      .update(users)
      .set({ writerArea: "Sanat & Edebiyat", writerArea2: "Tarih & Dünya" })
      .where(eq(users.id, writer.id));

    await setWriterAreas(actor, writer.id, { area: null, area2: null }, noMeta);

    const held = await reloadUser(writer.id);
    expect(held.writerArea).toBeNull();
    expect(held.writerArea2).toBeNull();
  });

  it("refuses an unknown area name", async () => {
    const writer = await createUser({ role: "writer", writerStatus: "active" });
    const error = await captureError(
      setWriterAreas(actor, writer.id, { area: "Yok boyle bir alan", area2: null }, noMeta),
    );
    expect(error.code).toBe("bad_request");
  });

  it("refuses the same area in both slots", async () => {
    const writer = await createUser({ role: "writer", writerStatus: "active" });
    const error = await captureError(
      setWriterAreas(
        actor,
        writer.id,
        { area: "Sanat & Edebiyat", area2: "Sanat & Edebiyat" },
        noMeta,
      ),
    );
    expect(error.code).toBe("bad_request");
  });

  it("refuses a second area whose quota is full", async () => {
    for (let index = 0; index < 3; index += 1) {
      const holder = await createUser({ role: "writer", writerStatus: "active" });
      await db
        .update(users)
        .set({ writerArea: "Eğlence & Dedikodu" })
        .where(eq(users.id, holder.id));
    }
    const writer = await createUser({ role: "writer", writerStatus: "active" });

    const error = await captureError(
      setWriterAreas(
        actor,
        writer.id,
        { area: "Sanat & Edebiyat", area2: "Eğlence & Dedikodu" },
        noMeta,
      ),
    );
    expect(error.code).toBe("conflict");
  });

  it("counts a second-slot holder towards that area's quota", async () => {
    const writer = await createUser({ role: "writer", writerStatus: "active" });
    await db
      .update(users)
      .set({ writerArea: "Sanat & Edebiyat", writerArea2: "Eğlence & Dedikodu" })
      .where(eq(users.id, writer.id));

    const areas = await listWriterAreasWithQuota();
    expect(areas.find((area) => area.name === "Eğlence & Dedikodu")?.currentCount).toBe(1);
  });

  it("refuses a non-writer target", async () => {
    const reader = await createUser({ role: "user" });
    const error = await captureError(
      setWriterAreas(actor, reader.id, { area: "Sanat & Edebiyat", area2: null }, noMeta),
    );
    expect(error.code).toBe("conflict");
  });

  it("refuses a non-admin actor", async () => {
    const editor = await createUser({ role: "editor" });
    const writer = await createUser({ role: "writer", writerStatus: "active" });
    const error = await captureError(
      setWriterAreas(actorOf(editor), writer.id, { area: "Sanat & Edebiyat", area2: null }, noMeta),
    );
    expect(error.code).toBe("forbidden");
  });
});
