import { MessageCircle } from "lucide-react";
import { SUPPORT_WHATSAPP_HREF } from "@/lib/support-contact";

/**
 * The floating "write to us on WhatsApp" button of the panels (D-385), for
 * contract work and website problems. A plain link: the site sends nothing,
 * the person's own WhatsApp opens the chat. Below the mobile menu drawer
 * (z-50), above the page.
 */
export function WhatsAppSupportButton() {
  return (
    <a
      href={SUPPORT_WHATSAPP_HREF}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 inline-flex min-h-12 items-center gap-2 rounded-full bg-[#25D366] px-3.5 py-3 text-sm font-medium text-[#0b141a] shadow-lg ring-1 ring-black/10 transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      title="Sözleşme işleri ve siteyle ilgili sorunlar için WhatsApp'tan yazın"
    >
      <MessageCircle className="size-5 shrink-0" aria-hidden />
      {/* On a phone the round button alone, so it covers less of the page */}
      <span className="hidden sm:inline">Sözleşme veya site sorunu? WhatsApp</span>
      <span className="sr-only sm:hidden">Sözleşme veya site sorunu için WhatsApp&apos;tan yazın</span>
      <span className="sr-only"> (yeni sekmede açılır)</span>
    </a>
  );
}
