import { forbidden } from "next/navigation";
import { guardPanel } from "@/lib/auth/guard";
import { canContactTeam } from "@/lib/auth/rbac";
import { telHref, whatsappHref } from "@/lib/whatsapp";
import { getEditorAssignment } from "@/services/editor-categories";
import { listTeamContacts, type TeamContact } from "@/services/team-contacts";
import { Button, Card, EmptyState, Field, Input, PageHeader, PersonName, StatusBadge } from "@/components/ui";

export const metadata = { title: "Ekip iletişimi" };

/** A hybrid editor reads as "Editor & Yazar", the same badge the admin card shows. */
function badgesFor(contact: TeamContact): string[] {
  const badges = [
    contact.role === "editor" && contact.writerStatus !== null ? "editor_writer" : contact.role,
  ].filter((badge) => badge !== "user");
  if (contact.isIllustrator) badges.push("illustrator");
  if (contact.isLegalAdvisor) badges.push("legal_advisor");
  if (contact.isAssistant) badges.push("assistant");
  return badges;
}

/**
 * The team's phone numbers for the main editor (D-267): one card per person
 * with a call link and a WhatsApp button. Nothing is sent from the server; the
 * links open the phone or WhatsApp on the editor's own device.
 */
export default async function TeamContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { user } = await guardPanel("editor");
  const actor = { ...user };
  // The service refuses too; this turns the refusal into a real 403 page
  if (!canContactTeam(actor, await getEditorAssignment(user.id))) forbidden();

  const { q } = await searchParams;
  const contacts = await listTeamContacts(actor, { query: q });

  return (
    <>
      <PageHeader
        title="Ekip iletişimi"
        description="Yazarlara ve ekibe telefonla ya da WhatsApp'tan ulaşın. Numarayı yalnızca ana editör ve yöneticiler görür."
      />

      <div className="space-y-6">
        <Card>
          {/* A plain GET form: searching changes nothing */}
          <form method="get" className="flex flex-wrap items-end gap-3">
            <Field label="Ara" htmlFor="q">
              <Input id="q" name="q" defaultValue={q ?? ""} placeholder="Ad veya mahlas" />
            </Field>
            <Button type="submit" variant="secondary">
              Ara
            </Button>
          </form>
        </Card>

        {contacts.length === 0 ? (
          <EmptyState>Aramaya uyan ekip üyesi yok.</EmptyState>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {contacts.map((contact) => {
              const call = telHref(contact.phone);
              const chat = whatsappHref(contact.phone);
              return (
                <Card key={contact.id}>
                  <h2 className="font-serif text-lg">
                    <PersonName person={contact} name={contact.displayName} />
                  </h2>
                  {contact.penName && <p className="text-sm text-muted">{contact.penName}</p>}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {badgesFor(contact).map((badge) => (
                      <StatusBadge key={badge} status={badge} />
                    ))}
                    {contact.isMainEditor && <span className="text-xs text-muted">· ana editör</span>}
                  </div>

                  <dl className="mt-4 text-sm">
                    <dt className="text-muted">Telefon</dt>
                    <dd className="text-ink">
                      {/* A number too broken to read stays plain text, as on the admin card (D-231) */}
                      {call ? (
                        <a href={call} className="underline">
                          {contact.phone}
                        </a>
                      ) : (
                        (contact.phone ?? "Girilmemiş")
                      )}
                    </dd>
                  </dl>

                  {chat && (
                    <a
                      href={chat}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 inline-flex items-center justify-center rounded-md border border-accent bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-accent/90"
                    >
                      WhatsApp&apos;tan yaz
                    </a>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
