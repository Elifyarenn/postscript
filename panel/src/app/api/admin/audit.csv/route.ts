/**
 * GET /api/admin/audit.csv — the filtered audit log as CSV (§9.3).
 * Same filters as the screen, so the download matches what was on it.
 */
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { queryAuditLog } from "@/services/audit-query";
import { errorJson } from "@/lib/api";

/** Quotes a value for CSV, doubling any quote inside it. */
function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  try {
    const { user } = await requireRole("admin");
    const url = new URL(request.url);

    const rows = await queryAuditLog(
      { ...user },
      {
        action: url.searchParams.get("action") ?? undefined,
        entityType: url.searchParams.get("entityType") ?? undefined,
        from: url.searchParams.get("from") ?? undefined,
        to: url.searchParams.get("to") ?? undefined,
      },
      5000,
    );

    const header = ["created_at", "action", "entity_type", "entity_id", "actor", "ip"];
    const lines = [
      header.join(","),
      ...rows.map((row) =>
        [
          row.createdAt.toISOString(),
          row.action,
          row.entityType,
          row.entityId,
          row.actorName ?? "system",
          row.ip,
        ]
          .map(csvCell)
          .join(","),
      ),
    ];

    // The BOM makes Excel open UTF-8 Turkish characters correctly
    return new NextResponse(`﻿${lines.join("\r\n")}`, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="audit-log-${new Date()
          .toISOString()
          .slice(0, 10)}.csv"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return errorJson(error);
  }
}
