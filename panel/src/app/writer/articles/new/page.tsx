import { guardWriterInnerPages } from "@/lib/auth/guard";
import { selectableWriterCategories } from "@/services/editor-categories";
import { listWriterAreasWithQuota } from "@/services/writer-areas";
import { readCsrfToken } from "@/lib/csrf";
import { PanelForm } from "@/components/form";
import { Field, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { createArticleAsWriterAction } from "../../actions";

export const metadata = { title: "Yeni yazı" };

export default async function WriterNewArticlePage() {
  const { user } = await guardWriterInnerPages();
  const csrfToken = (await readCsrfToken()) ?? "";
  const [categories, areas] = await Promise.all([
    selectableWriterCategories({ ...user }),
    listWriterAreasWithQuota(),
  ]);

  return (
    <>
      <PageHeader
        title="Yeni yazı"
        description="Taslağınızı kaydedin; hazır olunca “İncelemeye gönder” ile kategorinizin editörüne iletirsiniz."
      />

      <PanelForm action={createArticleAsWriterAction} csrfToken={csrfToken} submitLabel="Taslak olarak kaydet">
        <>
          <Field label="Başlık" htmlFor="title">
            <Input id="title" name="title" required maxLength={200} />
          </Field>

          <Field
            label="Slug"
            htmlFor="slug"
            hint="Boş bırakılırsa başlıktan üretilir. Küçük harf, rakam ve tire kullanın."
          >
            <Input id="slug" name="slug" maxLength={120} placeholder="yazinin-adi" />
          </Field>

          <Field label="Özet" htmlFor="summary">
            <Input id="summary" name="summary" maxLength={600} />
          </Field>

          <Field
            label="Kategori"
            htmlFor="category"
            hint="Yalnızca size tanımlı alanları seçebilirsiniz; yazı o alanın editörüne düşer."
          >
            <Select id="category" name="category" required defaultValue="">
              <option value="">Seçin…</option>
              {categories.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Alt köşe"
            htmlFor="subcategory"
            hint="İsteğe bağlı; yazının ikincil köşesi (11 ana kategoriden)."
          >
            <Select id="subcategory" name="subcategory" defaultValue="">
              <option value="">Yok</option>
              {areas.map((area) => (
                <option key={area.name} value={area.name}>
                  {area.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Etiketler" htmlFor="tags" hint="Virgülle ayırın.">
            <Input id="tags" name="tags" placeholder="deneme, çeviri" />
          </Field>

          <Field label="Gövde (markdown)" htmlFor="bodyMarkdown">
            <Textarea id="bodyMarkdown" name="bodyMarkdown" rows={18} />
          </Field>
        </>
      </PanelForm>
    </>
  );
}