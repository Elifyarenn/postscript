/**
 * Live availability of the writing areas (D-052).
 *
 * Every area holds at most `AREA_QUOTA` writers; the count means approved
 * writers (role `writer`, not deleted) — the same "approved count" the old
 * lead quotas used. The public form disables a full area and the registration
 * service refuses it, both from this one query.
 */
import "server-only";
import { and, count, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { AREA_QUOTA, WRITER_AREAS, type WriterAreaQuota } from "@/lib/writer-areas";

export async function listWriterAreasWithQuota(): Promise<WriterAreaQuota[]> {
  const rows = await db
    .select({ area: users.writerArea, n: count() })
    .from(users)
    .where(and(eq(users.role, "writer"), isNull(users.deletedAt)))
    .groupBy(users.writerArea);

  const countByArea = new Map(rows.map((row) => [row.area, Number(row.n)]));

  return WRITER_AREAS.map((name) => {
    const currentCount = countByArea.get(name) ?? 0;
    return { name, currentCount, full: currentCount >= AREA_QUOTA };
  });
}
