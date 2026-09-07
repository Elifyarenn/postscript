import { readCsrfToken } from "@/lib/csrf";
import { Alert, Card } from "@/components/ui";
import { LeadForm } from "./lead-form";

export const metadata = { title: "Yazar ilgi formu" };

/**
 * The public writer interest form. No session required: anyone can tell the
 * magazine which categories they would write for. Submissions land as pending
 * leads (module 5); the contract pipeline itself lives elsewhere.
 */
export default async function WriterLeadPage() {
  const csrfToken = (await readCsrfToken()) ?? "";

  return (
    <Card>
      <h1 className="mb-1 font-serif text-xl">Yazar ilgi formu</h1>
      <p className="mb-5 text-sm text-muted">
        Hangi alanlarda yazabileceğinizi bize bırakın. En fazla 3 kategori seçebilirsiniz;
        kontenjanı dolan kategoriler seçilemez.
      </p>

      <LeadForm csrfToken={csrfToken} />

      <div className="mt-5">
        <Alert tone="info">
          Bu form yalnızca ilginizi kaydeder. Yazarlık sürecinin kendisi kayıtlı
          kullanıcılara açıktır: Hesabım sayfasından yazar başvurusu yapabilirsiniz.
        </Alert>
      </div>
    </Card>
  );
}