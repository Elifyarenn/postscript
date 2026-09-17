import { Card } from "@/components/ui";

/**
 * Shown inside the magazine frame the moment a community link is followed,
 * until the page's own data is ready (D-172). Without it the previous page
 * stayed on screen with no sign that anything was happening.
 */
export default function SocialLoading() {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-6">
      <p className="sr-only">Yükleniyor…</p>
      {[0, 1, 2].map((index) => (
        <Card key={index} className="animate-pulse">
          <div className="mb-3 h-4 w-32 rounded bg-line" />
          <div className="mb-2 h-3 w-full rounded bg-line" />
          <div className="h-3 w-2/3 rounded bg-line" />
        </Card>
      ))}
    </div>
  );
}
