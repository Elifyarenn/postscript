import { getAuthContext } from "@/lib/auth/session";
import { panelPathFor } from "@/lib/auth/rbac";
import { HomePage } from "@/components/homepage";
import "./homepage.css";

/**
 * The magazine front page, for everyone. A signed-in account used to be sent
 * straight to its panel (D-035); now it stays here and the header offers the
 * profile and the panel instead (D-086).
 */
export default async function HomePageRoute() {
  const context = await getAuthContext();

  // HomePage is a client component: pass the two values the header shows,
  // never the session user with its e-mail and birth date
  const account = context
    ? { displayName: context.user.displayName, panelHref: panelPathFor(context.user) }
    : null;

  return <HomePage account={account} />;
}