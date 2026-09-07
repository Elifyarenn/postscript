import { guardPanel } from "@/lib/auth/guard";
import { readCsrfToken } from "@/lib/csrf";
import { PanelForm } from "@/components/form";
import {
  Alert,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  StatusBadge,
} from "@/components/ui";
import { formatDate, formatDateTime } from "@/lib/utils";
import { listCategoriesWithQuota, listLeads } from "@/services/leads";
import { updateLeadAction } from "../actions";

export const metadata = { title: "Yazar adayları" };

/**
 * The public interest form's inbox (module 5): every lead with its contact
 * details and chosen categories, editable, with a pending → approved/rejected
 * status that feeds the category quotas.
 */
export default async function AdminWriterLeadsPage() {
  const { user } = await guardPanel("admin");
  const csrfToken = (await readCsrfToken()) ?? "";

  const [leads, categories] = await Promise.all([
    listLeads({ ...user }, 200),
    listCategoriesWithQuota(true),
  ]);
  const categoryById = new Map(categories.map((category) => [category.id, category]));

  return (
    <>
      <PageHeader
        title="Yazar adayları"
        description="İlgi formundan gelen başvurular. Onaylanan adaylar kategori kontenjanına sayılır."
      />

      <div className="space-y-6">
        <Card>
          <h2 className="mb-4 font-serif text-lg">Başvurular ({leads.length})</h2>

          {leads.length === 0 ? (
            <EmptyState>Henüz başvuru yok.</EmptyState>
          ) : (
            <div className="space-y-6">
              {leads.map((lead) => (
                <article key={lead.id} className="rounded-md border border-line bg-paper p-5">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-medium">{lead.fullName}</h3>
                      <p className="text-xs text-muted">
                        {lead.email} · {lead.phone} · doğum {formatDate(lead.birthDate)} ·{" "}
                        başvuru {formatDateTime(lead.createdAt)}
                      </p>
                    </div>
                    <StatusBadge status={lead.status} />
                  </div>

                  <PanelForm
                    action={updateLeadAction}
                    csrfToken={csrfToken}
                    submitLabel="Kaydet"
                    submitVariant="secondary"
                  >
                    <input type="hidden" name="leadId" value={lead.id} />

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <Field label="Ad Soyad" htmlFor={`fullName-${lead.id}`}>
                        <Input id={`fullName-${lead.id}`} name="fullName" defaultValue={lead.fullName} required maxLength={80} />
                      </Field>
                      <Field label="E-posta" htmlFor={`email-${lead.id}`}>
                        <Input id={`email-${lead.id}`} name="email" type="email" defaultValue={lead.email} required maxLength={254} />
                      </Field>
                      <Field label="Telefon" htmlFor={`phone-${lead.id}`}>
                        <Input id={`phone-${lead.id}`} name="phone" defaultValue={lead.phone} required maxLength={20} />
                      </Field>
                      <Field label="Doğum tarihi" htmlFor={`birthDate-${lead.id}`}>
                        <Input id={`birthDate-${lead.id}`} name="birthDate" type="date" defaultValue={lead.birthDate} required />
                      </Field>
                    </div>

                    <Field label="Durum" htmlFor={`status-${lead.id}`}>
                      <Select id={`status-${lead.id}`} name="status" defaultValue={lead.status}>
                        <option value="pending">Bekliyor</option>
                        <option value="approved">Onaylandı</option>
                        <option value="rejected">Reddedildi</option>
                      </Select>
                    </Field>

                    <fieldset>
                      <legend className="mb-1.5 text-sm font-medium">
                        Kategori <span className="text-muted">(tek seçim)</span>
                      </legend>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {categories.map((category) => {
                          const checked = lead.categories.some((c) => c.id === category.id);
                          const full = category.full && !checked;
                          return (
                            <label
                              key={category.id}
                              className={
                                "flex items-center gap-2 rounded-md border px-3 py-2 text-sm " +
                                (full
                                  ? "cursor-not-allowed border-line bg-paper text-muted/50"
                                  : "border-line bg-surface")
                              }
                            >
                              <input
                                type="radio"
                                name="categoryId"
                                value={category.id}
                                defaultChecked={checked}
                                disabled={full}
                                className="size-4"
                              />
                              <span className="flex-1">{category.name}</span>
                              {full && (
                                <span className="text-xs font-medium text-danger">
                                  Kontenjan Dolu
                                </span>
                              )}
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>
                  </PanelForm>
                </article>
              ))}
            </div>
          )}
        </Card>

        <Alert tone="info">
          Onay, seçili kategorilerin kontenjanına sayılır; dolu bir kategoriye onay
          verilemez. Kontenjan listesi{" "}
          <a href="/admin/categories" className="text-accent underline">
            Kategoriler
          </a>{" "}
          sayfasındadır.
        </Alert>
      </div>
    </>
  );
}