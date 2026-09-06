/**
 * Filters for the audit log, shared by the admin page and the CSV export so the
 * download always matches what the screen shows.
 */
import "server-only";
import { and, desc, eq, gte, ilike, lte, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLog, users } from "@/db/schema";
import { canAccessAdminPanel, type Actor } from "@/lib/auth/rbac";
import { forbidden } from "@/lib/errors";

export type AuditFilters = {
  action?: string;
  entityType?: string;
  from?: string;
  to?: string;
};

export function auditConditions(filters: AuditFilters): SQL[] {
  const conditions: SQL[] = [];
  if (filters.action) conditions.push(ilike(auditLog.action, `%${filters.action}%`));
  if (filters.entityType) conditions.push(eq(auditLog.entityType, filters.entityType));
  if (filters.from) conditions.push(gte(auditLog.createdAt, new Date(filters.from)));
  // The "to" day is inclusive, which is what a person filling in a date expects
  if (filters.to) conditions.push(lte(auditLog.createdAt, new Date(`${filters.to}T23:59:59Z`)));
  return conditions;
}

export async function queryAuditLog(actor: Actor, filters: AuditFilters, limit = 300) {
  if (!canAccessAdminPanel(actor)) throw forbidden();

  const conditions = auditConditions(filters);

  return db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      entityType: auditLog.entityType,
      entityId: auditLog.entityId,
      ip: auditLog.ip,
      createdAt: auditLog.createdAt,
      actorName: users.displayName,
    })
    .from(auditLog)
    .leftJoin(users, eq(auditLog.actorId, users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(auditLog.createdAt))
    .limit(limit);
}
