import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/session";
import { HomePage } from "@/components/homepage";
import "./homepage.css";

/**
 * The public homepage: anonymous visitors get the marketing page; a signed-in
 * account is routed straight to the area its role belongs in (D-035).
 */
export default async function HomePageRoute() {
  const context = await getAuthContext();
  if (context) {
    const { role } = context.user;
    if (role === "admin") redirect("/admin");
    if (role === "editor") redirect("/editor");
    if (role === "writer") redirect("/writer");
    redirect("/magazine");
  }

  return <HomePage />;
}