/**
 * The error envelope every route handler returns (D-075).
 *
 * CLAUDE.md names the shape `{ error: { code, message, fields? } }`. It is the
 * contract a front end reads, so it is pinned here rather than left to whoever
 * edits `toErrorResponse` next.
 */
import { describe, expect, it, vi } from "vitest";
import {
  AppError,
  badRequest,
  conflict,
  gone,
  isAppError,
  notFound,
  toErrorResponse,
} from "@/lib/errors";

describe("toErrorResponse", () => {
  it("wraps the code and message in the documented envelope", () => {
    const { status, body } = toErrorResponse(notFound("Yazı bulunamadı."));

    expect(status).toBe(404);
    expect(body).toEqual({ error: { code: "not_found", message: "Yazı bulunamadı." } });
  });

  it("carries field errors as `fields`, not `details`", () => {
    const { status, body } = toErrorResponse(
      badRequest("Kayıt bilgileri geçersiz.", { email: ["Geçerli bir e-posta adresi girin."] }),
    );

    expect(status).toBe(400);
    expect(body.error.fields).toEqual({ email: ["Geçerli bir e-posta adresi girin."] });
    expect(body).not.toHaveProperty("details");
    expect(body).not.toHaveProperty("code");
  });

  it("omits `fields` when there are none", () => {
    const { body } = toErrorResponse(conflict("Makale zaten bu durumda."));
    expect("fields" in body.error).toBe(false);
  });

  it("maps each code to its status", () => {
    expect(toErrorResponse(gone()).status).toBe(410);
    expect(toErrorResponse(conflict("x")).status).toBe(409);
    expect(toErrorResponse(new AppError("rate_limited", "x")).status).toBe(429);
    expect(toErrorResponse(new AppError("two_factor_required", "x")).status).toBe(403);
  });

  it("never leaks the message of an unexpected failure", () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    const { status, body } = toErrorResponse(new Error("connection string: postgres://secret"));

    expect(status).toBe(500);
    expect(body).toEqual({ error: { code: "internal", message: "Beklenmeyen bir hata oluştu." } });
    expect(JSON.stringify(body)).not.toContain("secret");
    expect(logged).toHaveBeenCalled();

    logged.mockRestore();
  });
});

describe("isAppError", () => {
  it("tells an AppError from a plain one", () => {
    expect(isAppError(notFound())).toBe(true);
    expect(isAppError(new Error("nope"))).toBe(false);
    expect(isAppError(null)).toBe(false);
    expect(isAppError({ code: "not_found", status: 404 })).toBe(false);
  });
});
