import { guardWriterInnerPages } from "@/lib/auth/guard";
import { selectableWriterCategories } from "@/services/editor-categories";
import { readCsrfToken } from "@/lib/csrf";
import { PanelForm } from "@/components/form";
import { Field, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { createArticleAsWriterAction } from "../../actions";

export const metadata = { title: "Yeni yazı" };

export default async function WriterNewArticlePage() {
  const { user } = await guardWriterInnerPages();
  const csrfToken = (await readCsrfToken()) ?? "";
  const categories = await selectableWriterCategories({ ...user });

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