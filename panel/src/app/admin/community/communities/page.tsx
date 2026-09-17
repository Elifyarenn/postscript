import { guardPanel } from "@/lib/auth/guard";
import { readCsrfToken } from "@/lib/csrf";
import { listCommunitiesForAdmin } from "@/services/communities";
import { PanelForm } from "@/components/form";
import { Card, EmptyState, Field, Input, Table, Td, Th } from "@/components/ui";
import { CommunityAdminHeader } from "../community-admin-header";
import { archiveCommunityAction, createCommunityAction } from "../actions";

export const metadata = { title: "Topluluklar" };

/** The topic groups: only an admin opens and archives them (D-093, D-180). */
export default async function CommunityGroupsPage() {
  const { user } = await guardPanel("admin");
  const csrfToken = (await readCsrfToken()) ?? "";
  const communityList = await listCommunitiesForAdmin({ ...user });

  return (
    <>
      <CommunityAdminHeader title="Topluluklar" description="Konu gruplarını açın ve arşivleyin." />

      <div className="space-y-6">
        <Card>
          <h2 className="mb-1 font-serif text-lg">Topluluklar ({communityList.length})</h2>
          <p className="mb-4 text-sm text-muted">
            Konu gruplarını yalnızca yöneticiler açar ve arşivler. Arşivlenen topluluk okunur ama
            yeni üye ve gönderi almaz.
          </p>

          <div className="mb-6 max-w-md">
            <PanelForm
              action={createCommunityAction}
              csrfToken={csrfToken}
              submitLabel="Topluluk aç"
              submitVariant="secondary"
            >
              <Field label="Ad" htmlFor="communityName">
                <Input id="communityName" name="name" required minLength={3} maxLength={60} />
              </Field>
              <Field label="Açıklama (isteğe bağlı)" htmlFor="communityDescription">
                <Input id="communityDescription" name="description" maxLength={500} />
              </Field>
            </PanelForm>
          </div>

          {communityList.length === 0 ? (
            <EmptyState>Henüz topluluk yok.</EmptyState>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Topluluk</Th>
                  <Th>Üye</Th>
                  <Th>Durum</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {communityList.map((community) => (
                  <tr key={community.id}>
                    <Td>
                      <span className="text-sm">{community.name}</span>
                      <span className="block font-mono text-xs text-muted">{community.slug}</span>
                    </Td>
                    <Td className="text-xs">{community.memberCount}</Td>
                    <Td className="text-xs">{community.archived ? "arşivlendi" : "açık"}</Td>
                    <Td className="text-right">
                      {!community.archived && (
                        <PanelForm
                          action={archiveCommunityAction}
                          csrfToken={csrfToken}
                          submitLabel="Arşivle"
                          submitVariant="secondary"
                        >
                          <input type="hidden" name="communityId" value={community.id} />
                        </PanelForm>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

      </div>
    </>
  );
}
