import { redirect } from "next/navigation";

/** The topic groups are a tab of the community page now (D-178); old links still land on it. */
export default function CommunitiesPage() {
  redirect("/social?sekme=topluluklar");
}
