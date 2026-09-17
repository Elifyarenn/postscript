import { redirect } from "next/navigation";

/** Keşfet is a tab of the community page now (D-178); old links still land on it. */
export default function ExplorePage() {
  redirect("/social?sekme=kesfet");
}
