/**
 * Licence forms accepted in the panel at submission (D-387), listed with
 * their PDF. The owner sees their own; the agreements admin sees everyone's.
 */
import { Card, Table, Td, Th } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import type { LicenceAcceptanceItem } from "@/services/licence-acceptances";

export function AcceptedLicencesCard({
  items,
  showPerson = false,
}: {
  items: LicenceAcceptanceItem[];
  showPerson?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <Card>
      <h2 className="mb-1 font-serif text-lg">Elektronik onaylı ruhsat formları ({items.length})</h2>
      <p className="mb-3 text-sm text-muted">
        Gönderim sırasında okunup onaylanan Eser Bazlı Kullanım Ruhsatı Formları. Islak imza ve imzalı kopya
        gerekmez; PDF, onaylanan metni ve onay kaydını (tarih-saat, IP) içerir.
      </p>
      <Table>
        <thead>
          <tr>
            {showPerson && <Th>Kişi</Th>}
            <Th>Eser</Th>
            <Th>Onay</Th>
            <Th>Form</Th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              {showPerson && <Td>{item.personName}</Td>}
              <Td>
                {item.workTitle}
                <span className="block text-xs text-muted">{item.kind === "drawing" ? "Çizim" : "Yazı"}</span>
              </Td>
              <Td>{formatDateTime(item.acceptedAt)}</Td>
              <Td>
                <a href={`/api/licence-acceptances/${item.id}/pdf`} className="text-accent underline">
                  PDF
                </a>
                <span className="block font-mono text-xs text-muted">
                  {item.id.slice(0, 8)} · v{item.templateVersion}
                </span>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}
