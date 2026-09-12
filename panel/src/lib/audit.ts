/**
 * Append-only audit trail (DECISIONS.md D-015).
 *
 * These helpers are the only supported way to write to `audit_log` and
 * `role_changes`. A database trigger blocks UPDATE and DELETE on both tables,
 * so a mistake here cannot quietly rewrite history.
 */
import "server-only";
import { db, type Database } from "@/db/client";
import { auditLog, roleChanges, type Role } from "@/db/schema";

/**
 * Either the ambient connection or an open transaction.
 *
 * A role change and its `role_changes` row must land together or not at all
 * (CLAUDE.md security rules), which means the caller has to be able to hand its
 * transaction down. Everything else keeps calling these without an executor and
 * writes on the ambient connection as before.
 */
export type Executor = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

export type AuditEntry = {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
};

/** Values that must never reach the audit trail or the logs. */
const REDACTED_KEYS = new Set([
  "password",
  "passwordHash",
  "password_hash",
  "token",
  "tokenHash",
  "token_hash",
  "totpSecret",
  "totp_secret",
  "codeHash",
  "code_hash",
  "storageKey",
  "storage_key",
]);

/** Recursively replaces secret-looking values with a marker. */
export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object" && !(value instanceof Date)) {
    const output: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      output[key] = REDACTED_KEYS.has(key) ? "[redacted]" : redact(inner);
    }
    return output;
  }
  return value;
}

export async function writeAudit(entry: AuditEntry, executor: Executor = db): Promise<void> {
  await executor.insert(auditLog).values({
    actorId: entry.actorId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    before: entry.before === undefined ? null : redact(entry.before),
    after: entry.after === undefined ? null : redact(entry.after),
    ip: entry.ip ?? null,
  });
}

/**
 * A role change is only legal together with its `role_changes` row, so the two
 * always happen in the same call.
 *
 * Pass the caller's transaction as `executor`: the `users.role` write and this
 * record must commit together, or a crash between them would leave a changed
 * role with no trace of who changed it.
 */
export async function recordRoleChange(
  input: {
    userId: string;
    oldRole: Role;
    newRole: Role;
    changedBy: string | null;
    note?: string | null;
    ip?: string | null;
  },
  executor: Executor = db,
): Promise<void> {
  await executor.insert(roleChanges).values({
    userId: input.userId,
    oldRole: input.oldRole,
    newRole: input.newRole,
    changedBy: input.changedBy,
    note: input.note ?? null,
  });

  await writeAudit(
    {
      actorId: input.changedBy,
      action: "user.role_changed",
      entityType: "users",
      entityId: input.userId,
      before: { role: input.oldRole },
      after: { role: input.newRole },
      ip: input.ip ?? null,
    },
    executor,
  );
}
