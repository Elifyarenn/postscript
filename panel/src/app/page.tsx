import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/session";

/** The root simply routes each visitor to the area their role belongs in. */
export default async function HomePage() {
  const context = await getAuthContext();
  if (!context) redirect("/login");

  const { role } = context.user;
  if (role === "admin") redirect("/admin");
  if (role === "editor") redirect("/editor");
  if (role === "writer") redirect("/writer");
  redirect("/account");
}
