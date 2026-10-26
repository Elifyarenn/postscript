import { redirect } from "next/navigation";

/** The drawings moved to the admin panel (D-372); older notifications still link here. */
export default function EditorIllustrationsPage() {
  redirect("/admin/cizimler");
}
