/**
 * POST /api/writers/apply — a new writer-lead from the public interest form.
 *
 * Server side, the same rules run as on the form: at most three categories,
 * only active categories, no full categories, and no duplicate e-mail.
 */
import { NextResponse } from "next/server";
import { applyAsWriterLead } from "@/services/leads";
import { errorJson } from "@/lib/api";
import { assertCsrf } from "@/lib/csrf";
import { consumeAttempt } from "@/lib/rate-limit";
import { rateLimited } from "@/lib/errors";

export async function POST(request: Request) {
  try {
    // Same-origin guard: the public form carries the double submit token
    await assertCsrf(request.headers.get("x-csrf-token"));

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const limit = await consumeAttempt("register_ip", ip);
    if (!limit.allowed) throw rateLimited("Çok fazla başvuru denemesi yapıldı, 10 dakika bekleyin.");

    const body = await request.json().catch(() => null);
    const created = await applyAsWriterLead(body ?? {}, {
      ip,
      userAgent: request.headers.get("user-agent"),
    });

    return NextResponse.json(
      { id: created.id, status: created.status },
      { status: 201, headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return errorJson(error);
  }
}