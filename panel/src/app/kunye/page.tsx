import { pageMetadata } from "@/lib/seo";
import { getAuthContext } from "@/lib/auth/session";
import { ImprintView } from "@/components/public-views/imprint";

export const metadata = pageMetadata({
  title: "Künye",
  description:
    "PostScript Dergi künyesi: 5651 sayılı Kanun kapsamında yayıncı bilgileri ve içerik kaldırma başvuruları.",
  path: "/kunye",
});

/**
 * The notice 5651 s. 3 requires (D-084). With a session it is drawn per
 * request, so an admin sees the blank lines; a visitor without one gets the
 * cached copy under /anon, rebuilt when the settings change (D-351).
 */
export default async function ImprintPage() {
  const context = await getAuthContext();
  return <ImprintView isAdmin={context?.user.role === "admin"} />;
}
