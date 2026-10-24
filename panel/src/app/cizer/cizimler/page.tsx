import { guardIllustratorPanel } from "@/lib/auth/guard";
import { readCsrfToken } from "@/lib/csrf";
import { MAX_ILLUSTRATION_MB } from "@/lib/illustration";
import { listIssuesForIllustrations, listOwnIllustrations } from "@/services/illustrations";
import { ActionButton, PanelForm } from "@/components/form";
import { ImageFileInput } from "@/components/image-file-input";
import { IllustrationCard } from "@/components/illustrations";
import { Alert, Card, EmptyState, Field, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { removeIllustrationAction, uploadIllustrationAction } from "../actions";

export const metadata = { title: "Çizimlerim" };

export const dynamic = "force-dynamic";

/** The çizer hands drawings in and sees what they handed in (D-362). */
export default async function IllustrationsPage() {
  const { user } = await guardIllustratorPanel();
  const csrfToken = (await readCsrfToken()) ?? "";
  const [items, issueOptions] = await Promise.all([listOwnIllustrations({ ...user }), listIssuesForIllustrations()]);

  return (
    <>
      <PageHeader
        title="Çizimlerim"
        description="Dergi için hazırladığınız çizimleri buradan yükleyin; yöneticiler ve ana editör görür."
      />

      <div className="space-y-6">
        <Card>
          <h2 className="mb-1 font-serif text-lg">Çizim yükle</h2>
          <p className="mb-4 text-sm text-muted">
            JPG, PNG ya da WEBP; en çok {MAX_ILLUSTRATION_MB} MB. Daha büyük bir dosyayı JPG ya da WEBP olarak
            küçültüp yükleyin.
          </p>

          {/* Said before the upload, as the writers' declaration is (D-238) */}
          <Alert tone="info" title="Yüklemek yayın izni değildir">
            Çiziminizi değerlendirilmesi için dergiye iletirsiniz; yalnızca yöneticiler ve ana editör görür, sitede
            yayımlanmaz. Bir çizim dergide kullanılacaksa onun için ayrıca ruhsat formu hazırlanır ve siz
            imzalamadan yayımlanmaz. Haklarınız sizde kalır.
          </Alert>

          <div className="mt-4">
            <PanelForm action={uploadIllustrationAction} csrfToken={csrfToken} submitLabel="Yükle">
              <Field label="Dosya" htmlFor="file">
                <ImageFileInput id="file" maxMb={MAX_ILLUSTRATION_MB} />
              </Field>
              <Field label="Çizimin adı" htmlFor="title">
                <Input id="title" name="title" required maxLength={200} />
              </Field>
              <Field label="Hangi sayı için? (isteğe bağlı)" htmlFor="issueId">
                <Select id="issueId" name="issueId" defaultValue="">
                  <option value="">Belirtmiyorum</option>
                  {issueOptions.map((issue) => (
                    <option key={issue.id} value={issue.id}>
                      Sayı {issue.number} · {issue.title}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Not (isteğe bağlı)"
                htmlFor="note"
                hint="Hangi yazı ya da bölüm için çizdiğinizi, teknik notları yazabilirsiniz."
              >
                <Textarea id="note" name="note" rows={3} maxLength={1000} />
              </Field>
            </PanelForm>
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 font-serif text-lg">Yüklediğim çizimler</h2>
          {items.length === 0 ? (
            <EmptyState>Henüz çizim yüklemediniz.</EmptyState>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <IllustrationCard key={item.id} item={item}>
                  <ActionButton
                    action={removeIllustrationAction}
                    csrfToken={csrfToken}
                    label="Kaldır"
                    variant="danger"
                    fields={{ illustrationId: item.id }}
                    confirmMessage={`"${item.title}" kaldırılsın mı? Dosya silinir, geri alınamaz.`}
                  />
                </IllustrationCard>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
