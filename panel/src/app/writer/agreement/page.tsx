import { guardPanel } from "@/lib/auth/guard";
import { Card, EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "Yazar sözleşmesi" };

/**
 * The contract page stays empty for now: contracts are sent outside the panel
 * and will be linked here later (D-050).
 */
export default async function WriterAgreementPage() {
  await guardPanel("writer");

  return (
    <>
      <PageHeader
        title="Yazar sözleşmesi ve kullanım ruhsatı taahhüdü"
        description="Sözleşme metni şu anda hazır değil; size ayrıca iletilecek."
      />

      <Card>
        <EmptyState>
          Sözleşme metni henüz eklenmedi. Sözleşmeniz hazır olduğunda buradan
          görüntüleyip onaylayabileceksiniz.
        </EmptyState>
      </Card>
    </>
  );
}
