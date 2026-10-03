/**
 * Team membership periods (D-302): when someone held a team duty, worked out
 * from the records that already exist — `role_changes` for the roles and the
 * audit log for the çizer and Yetkili marks.
 *
 * A start or end the records do not hold stays null. Account creation is not
 * a membership start and is never put in its place: the export would then
 * state a date the magazine never recorded.
 */
import type { Role } from "@/db/schema";

export const TEAM_ROLES = ["writer", "editor", "admin"] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];
export type Duty = TeamRole | "illustrator" | "authorized";

export type MembershipPeriod = {
  duty: Duty;
  startedAt: string | null;
  endedAt: string | null;
};

export type RoleEvent = { at: Date; oldRole: Role; newRole: Role };
export type MarkEvent = { at: Date; before: boolean | null; after: boolean };

function isTeamRole(role: Role): role is TeamRole {
  return (TEAM_ROLES as readonly string[]).includes(role);
}

/** Role history, oldest first, into one period per held team role. */
export function rolePeriods(events: RoleEvent[], currentRole: Role): MembershipPeriod[] {
  const periods: MembershipPeriod[] = [];
  let open: MembershipPeriod | null = null;

  // Already in the team before the first recorded change: the start is unknown
  const first = events[0];
  if (first && isTeamRole(first.oldRole)) {
    open = { duty: first.oldRole, startedAt: null, endedAt: null };
  }

  for (const event of events) {
    if (open && open.duty !== event.newRole) {
      periods.push({ ...open, endedAt: event.at.toISOString() });
      open = null;
    }
    if (!open && isTeamRole(event.newRole)) {
      open = { duty: event.newRole, startedAt: event.at.toISOString(), endedAt: null };
    }
  }
  if (open) periods.push(open);

  // A team role with no matching record (the seeded first admin): held, start unknown
  if (isTeamRole(currentRole) && open?.duty !== currentRole) {
    periods.push({ duty: currentRole, startedAt: null, endedAt: null });
  }
  return periods;
}

/** A yes/no duty mark's audit history, oldest first, into periods. */
export function markPeriods(duty: Duty, events: MarkEvent[], current: boolean): MembershipPeriod[] {
  const periods: MembershipPeriod[] = [];
  let open: MembershipPeriod | null = null;

  if (events[0]?.before === true) open = { duty, startedAt: null, endedAt: null };

  for (const event of events) {
    if (event.after && !open) {
      open = { duty, startedAt: event.at.toISOString(), endedAt: null };
    } else if (!event.after && open) {
      periods.push({ ...open, endedAt: event.at.toISOString() });
      open = null;
    }
  }
  if (open) periods.push(open);

  if (current && !open) periods.push({ duty, startedAt: null, endedAt: null });
  return periods;
}
