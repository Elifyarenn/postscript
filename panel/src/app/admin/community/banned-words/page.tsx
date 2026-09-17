import { guardPanel } from "@/lib/auth/guard";
import { readCsrfToken } from "@/lib/csrf";
import { formatDateTime } from "@/lib/utils";
import { listAllBannedWords } from "@/services/community";
import { PanelForm } from "@/components/form";
import { Alert, Card, EmptyState, Field, Input, Table, Td, Th } from "@/components/ui";
import { CommunityAdminHeader } from "../community-admin-header";
import { addBannedWordAction, removeBannedWordAction } from "../../actions";

export const metadata = { title: "Yasaklı kelimeler" };

/** The blacklist that masks words in member content (D-040, D-180). */
export default async function CommunityBannedWordsPage() {
  const { user } = await guardPanel("admin");
  const csrfToken = (await readCsrfToken()) ?? "";
  const banned = await listAllBannedWords({ ...user });
  const liveBanned = banned.filter((row) => row.deletedAt === null);

  return (
    <>
      <CommunityAdminHeader title="Yasaklı kelimeler" description="Üye içeriğinde otomatik yıldızlanan kelimeler." />

      <div className="space-y-6">
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-serif text-lg">Yasaklı kelimeler ({liveBanned.length})</h2>

            <PanelForm
              action={addBannedWordAction}
              csrfToken={csrfToken}
              submitLabel="Ekle"
              submitVariant="secondary"
            >
              <Field label="Kelime" htmlFor="word">
                <Input id="word" name="word" required minLength={2} maxLength={100} placeholder="ör. küfür" />
              </Field>
            </PanelForm>
          </div>

          <Alert tone="info">
            Bu listedeki kelimeler yorumlarda ve sohbette otomatik yıldızlanır. Eşleştirme
            büyük/küçük harfe duyarsız ve ek almış biçimleri de yakalar; liste bu yüzden
            yönetici tarafından denetlenir.
          </Alert>

          <div className="mt-4">
            {banned.length === 0 ? (
              <EmptyState>Listede kelime yok.</EmptyState>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Kelime</Th>
                    <Th>Eklendi</Th>
                    <Th>Durum</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {banned.map((row) => (
                    <tr key={row.id}>
                      <Td className="font-mono">{row.word}</Td>
                      <Td className="text-xs">{formatDateTime(row.createdAt)}</Td>
                      <Td>
                        {row.deletedAt ? (
                          <span className="text-xs text-danger">kaldırıldı</span>
                        ) : (
                          <span className="text-xs text-accent">aktif</span>
                        )}
                      </Td>
                      <Td className="text-right">
                        {!row.deletedAt && (
                          <PanelForm
                            action={removeBannedWordAction}
                            csrfToken={csrfToken}
                            submitLabel="Kaldır"
                            submitVariant="secondary"
                          >
                            <input type="hidden" name="wordId" value={row.id} />
                          </PanelForm>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </div>
        </Card>

      </div>
    </>
  );
}
