/**
 * The team memberships export for the owner's agenda app (D-302).
 *
 * Only who held which team duty and when leaves this service: the account
 * name, the pen name and the periods. E-mail, phone, birth date, consent
 * records, articles and every other project record stay in the panel — the
 * agenda needs to know who is on the team, not anything about them.
 */
import "server-only";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLog, roleChanges, users } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { forbidden } from "@/lib/errors";
import { canAccessAdminPanel, type Actor } from "@/lib/auth/rbac";
import {
  TEAM_ROLES,
  markPeriods,
  rolePeriods,
  type MarkEvent,
  type MembershipPeriod,
  type RoleEvent,
} from "@/lib/team-membership";

export type TeamMembershipExport = {
  source: "postscript";
  kind: "team-memberships";
  version: 1;
  generatedAt: string;
  members: { id: string; name: string; penName: string | null; memberships: MembershipPeriod[] }[];
};

const MARK_ACTIONS = {
  "user.illustrator_changed": { duty: "illustrator", key: "isIllustrator" },
  "user.authorized_changed": { duty: "authorized", key: "isAuthorized" },
} as const;

function flag(value: unknown, key: string): boolean | null {
  if (!value || typeof value !== "object") return null;
  const raw = (value as Record<string, unknown>)[key];
  return typeof raw === "boolean" ? raw : null;
}

export async function exportTeamMemberships(
  actor: Actor,
  meta: { ip: string | null },
  now: Date = new Date(),
): Promise<TeamMembershipExport> {
  if (!canAccessAdminPanel(actor)) throw forbidden("Ekip üyeliklerini yalnızca yöneticiler dışa aktarır.");

  const roleRows = await db
    .select({ userId: roleChanges.userId, at: roleChanges.createdAt, oldRole: roleChanges.oldRole, newRole: roleChanges.newRole })
    .from(roleChanges)
    .orderBy(asc(roleChanges.createdAt));

  const markRows = await db
    .select({ userId: auditLog.entityId, action: auditLog.action, at: auditLog.createdAt, before: auditLog.before, after: auditLog.after })
    .from(auditLog)
    .where(and(eq(auditLog.entityType, "users"), inArray(auditLog.action, Object.keys(MARK_ACTIONS))))
    .orderBy(asc(auditLog.createdAt));

  // Former members count too, so the candidates are everyone any record mentions
  const candidateIds = new Set<string>();
  for (const row of roleRows) candidateIds.add(row.userId);
  for (const row of markRows) if (row.userId) candidateIds.add(row.userId);

  // Deleted, anonymised and banned accounts are left out entirely
  const people = await db
    .select({
      id: users.id,
      name: users.displayName,
      penName: users.penName,
      role: users.role,
      isIllustrator: users.isIllustrator,
      isAuthorized: users.isAuthorized,
    })
    .from(users)
    .where(and(isNull(users.deletedAt), isNull(users.anonymizedAt), eq(users.isBanned, false)))
    .orderBy(asc(users.displayName));

  const members: TeamMembershipExport["members"] = [];
  for (const person of people) {
    const current =
      (TEAM_ROLES as readonly string[]).includes(person.role) || person.isIllustrator || person.isAuthorized;
    if (!current && !candidateIds.has(person.id)) continue;

    const roleEvents: RoleEvent[] = roleRows.filter((row) => row.userId === person.id);
    const memberships = rolePeriods(roleEvents, person.role);

    for (const [action, { duty, key }] of Object.entries(MARK_ACTIONS)) {
      const events: MarkEvent[] = markRows
        .filter((row) => row.userId === person.id && row.action === action)
        .map((row) => ({ at: row.at, before: flag(row.before, key), after: flag(row.after, key) === true }));
      memberships.push(...markPeriods(duty, events, person[key]));
    }

    if (memberships.length > 0) {
      members.push({ id: person.id, name: person.name, penName: person.penName, memberships });
    }
  }

  // Personal data leaving the panel leaves a trace, like the CSV downloads
  await writeAudit({
    actorId: actor.id,
    action: "team_memberships.exported",
    entityType: "users",
    after: { memberCount: members.length },
    ip: meta.ip,
  });

  return { source: "postscript", kind: "team-memberships", version: 1, generatedAt: now.toISOString(), members };
}
