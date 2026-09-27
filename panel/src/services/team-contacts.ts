/**
 * The main editor's contact list (D-267).
 *
 * Only the team is listed — writers, editors, admins and the accounts marked
 * as çizer, hukuk danışmanı or asistan — because the privacy notice gives the
 * phone number one purpose: reaching a team member about the magazine's work.
 * A plain reader's number has no such purpose, so it is not offered here.
 *
 * Each row carries just what a call needs: the name, what the person does and
 * the number. Birth date, e-mail and consent records stay on the admin's page.
 */
import "server-only";
import { and, asc, eq, ilike, inArray, isNull, or, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { users, type Role } from "@/db/schema";
import { forbidden } from "@/lib/errors";
import { canContactTeam, type Actor } from "@/lib/auth/rbac";
import { getEditorAssignment } from "./editor-categories";

export type TeamContact = {
  id: string;
  displayName: string;
  penName: string | null;
  penNameSlug: string | null;
  username: string | null;
  role: Role;
  writerStatus: string | null;
  isMainEditor: boolean;
  isIllustrator: boolean;
  isLegalAdvisor: boolean;
  isAssistant: boolean;
  phone: string | null;
};

export async function listTeamContacts(
  actor: Actor,
  filters: { query?: string } = {},
): Promise<TeamContact[]> {
  if (!canContactTeam(actor, await getEditorAssignment(actor.id))) {
    throw forbidden("Ekip iletişim bilgilerini yalnızca ana editör ve yöneticiler görür.");
  }

  const team = or(
    inArray(users.role, ["writer", "editor", "admin"]),
    eq(users.isIllustrator, true),
    eq(users.isLegalAdvisor, true),
    eq(users.isAssistant, true),
  );
  const conditions: (SQL | undefined)[] = [isNull(users.deletedAt), eq(users.isBanned, false), team];

  const query = filters.query?.trim();
  if (query) {
    const pattern = `%${query}%`;
    conditions.push(or(ilike(users.displayName, pattern), ilike(users.penName, pattern)));
  }

  return db
    .select({
      id: users.id,
      displayName: users.displayName,
      penName: users.penName,
      penNameSlug: users.penNameSlug,
      username: users.username,
      role: users.role,
      writerStatus: users.writerStatus,
      isMainEditor: users.isMainEditor,
      isIllustrator: users.isIllustrator,
      isLegalAdvisor: users.isLegalAdvisor,
      isAssistant: users.isAssistant,
      phone: users.phone,
    })
    .from(users)
    .where(and(...conditions))
    .orderBy(asc(users.displayName));
}
