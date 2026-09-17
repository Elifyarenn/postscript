import { redirect } from "next/navigation";

/** The member boxes closed (D-185); an old link to one lands on the magazine's box. */
export default function OldMemberAnonBoxPage() {
  redirect("/social/anon");
}
