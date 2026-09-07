"use client";

/**
 * The public writer interest form. Categories load from GET /api/categories,
 * so a category that just filled up is already disabled when the page opens.
 * At most three selections are kept; the form posts to POST /api/writers/apply
 * with the double submit token, and the server re-runs every rule.
 */
import { useEffect, useState } from "react";
import { Alert, Button, Field, Input } from "@/components/ui";

type CategoryOption = {
  id: string;
  name: string;
  maxQuota: number;
  currentCount: number;
  isActive: boolean;
  full: boolean;
};

const MAX_SELECTIONS = 3;

export function LeadForm({ csrfToken }: { csrfToken: string }) {
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/categories", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { categories?: CategoryOption[] }) => {
        setCategories(data.categories ?? []);
      })
      .catch(() => setError("Kategoriler yüklenemedi, sayfayı yenileyin."));
  }, []);

  function toggle(categoryId: string) {
    if (selected.includes(categoryId)) {
      setSelected(selected.filter((id) => id !== categoryId));
    } else if (selected.length < MAX_SELECTIONS) {
      setSelected([...selected, categoryId]);
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const form = event.currentTarget;
    const payload = {
      fullName: (form.elements.namedItem("fullName") as HTMLInputElement).value,
      birthDate: (form.elements.namedItem("birthDate") as HTMLInputElement).value,
      phone: (form.elements.namedItem("phone") as HTMLInputElement).value,
      email: (form.elements.namedItem("email") as HTMLInputElement).value,
      categoryIds: selected,
    };

    setSubmitting(true);
    try {
      const response = await fetch("/api/writers/apply", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message =
          (body as { error?: string }).error ?? "Başvuru alınamadı, tekrar deneyin.";
        setError(message);
        return;
      }
      setSuccess("Başvurunuz alındı. Değerlendirme sonrası sizinle iletişime geçeceğiz.");
      setSelected([]);
      form.reset();
    } catch {
      setError("Bağlantı hatası, tekrar deneyin.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {success && <Alert tone="success">{success}</Alert>}
      {error && <Alert tone="danger">{error}</Alert>}

      <Field label="Ad Soyad" htmlFor="fullName">
        <Input id="fullName" name="fullName" required maxLength={80} autoFocus />
      </Field>

      <Field label="Doğum Tarihi" htmlFor="birthDate">
        <Input id="birthDate" name="birthDate" type="date" required />
      </Field>

      <Field label="Telefon" htmlFor="phone">
        <Input id="phone" name="phone" type="tel" required maxLength={20} placeholder="05XX XXX XX XX" />
      </Field>

      <Field label="E-posta" htmlFor="email">
        <Input id="email" name="email" type="email" required maxLength={254} autoComplete="email" />
      </Field>

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">
          İlgi alanlarınız <span className="text-muted">(en fazla {MAX_SELECTIONS})</span>
        </legend>

        {selected.length === MAX_SELECTIONS && (
          <p className="mb-2 text-xs text-muted">
            En fazla {MAX_SELECTIONS} kategori seçebilirsiniz; yeni seçim için birini bırakın.
          </p>
        )}

        <div className="grid gap-2">
          {categories.map((category) => {
            const isSelected = selected.includes(category.id);
            const locked = category.full || (!isSelected && selected.length >= MAX_SELECTIONS);
            return (
              <label
                key={category.id}
                className={
                  "flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm " +
                  (category.full
                    ? "cursor-not-allowed border-line bg-paper text-muted/50"
                    : isSelected
                      ? "border-accent bg-accent-soft text-ink"
                      : "border-line bg-surface hover:bg-paper")
                }
              >
                <span className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={category.full || locked}
                    onChange={() => toggle(category.id)}
                    className="size-4 rounded border-line disabled:opacity-40"
                  />
                  {category.name}
                </span>
                <span className="text-xs">
                  {category.full ? (
                    <span className="font-medium text-danger">Kontenjan Dolu</span>
                  ) : (
                    <span className="text-muted">
                      {category.currentCount}/{category.maxQuota}
                    </span>
                  )}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <Button type="submit" disabled={submitting || selected.length === 0}>
        {submitting ? "Gönderiliyor…" : "Başvuruyu gönder"}
      </Button>
    </form>
  );
}