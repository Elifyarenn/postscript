/**
 * Application error type.
 *
 * Every service throws `AppError` with an HTTP status, so route handlers and
 * server actions can translate failures the same way instead of each inventing
 * its own shape.
 */
import "server-only";

export type AppErrorCode =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "gone"
  | "conflict"
  | "rate_limited"
  | "two_factor_required"
  | "internal";

const STATUS_BY_CODE: Record<AppErrorCode, number> = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  gone: 410,
  conflict: 409,
  rate_limited: 429,
  two_factor_required: 403,
  internal: 500,
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  /** Field level messages, shaped like zod's flatten output. */
  readonly details?: Record<string, string[]>;

  constructor(code: AppErrorCode, message: string, details?: Record<string, string[]>) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.details = details;
  }
}

export const badRequest = (message: string, details?: Record<string, string[]>) =>
  new AppError("bad_request", message, details);
export const unauthorized = (message = "Oturum açmanız gerekiyor.") =>
  new AppError("unauthorized", message);
export const forbidden = (message = "Bu işlem için yetkiniz yok.") =>
  new AppError("forbidden", message);
export const notFound = (message = "Kayıt bulunamadı.") => new AppError("not_found", message);
export const gone = (message = "Bu içerik geri çekildi.") => new AppError("gone", message);
export const conflict = (message: string, details?: Record<string, string[]>) =>
  new AppError("conflict", message, details);
export const rateLimited = (message = "Çok fazla deneme yapıldı, lütfen bekleyin.") =>
  new AppError("rate_limited", message);

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * The error body every route handler returns: `{ error: { code, message,
 * fields? } }`, the shape CLAUDE.md names (D-075).
 *
 * It used to be `{ error: "<message>", code, details }` — a flat object with
 * the message where the contract puts the envelope, and `details` where it
 * puts `fields`. One hand-written branch in the community route already
 * answered in the documented shape, so the same API spoke two dialects.
 *
 * An unexpected failure never leaks its message: it is logged and answered
 * with a generic one.
 */
export type ErrorBody = {
  error: { code: AppErrorCode; message: string; fields?: Record<string, string[]> };
};

export function toErrorResponse(error: unknown): { status: number; body: ErrorBody } {
  if (isAppError(error)) {
    return {
      status: error.status,
      body: {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details && { fields: error.details }),
        },
      },
    };
  }
  console.error("Unhandled error:", error);
  return {
    status: 500,
    body: { error: { code: "internal", message: "Beklenmeyen bir hata oluştu." } },
  };
}
