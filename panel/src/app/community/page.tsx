import { notFound } from "next/navigation";

/**
 * The community chat is removed from the panel (D-056): the sidebar tabs are
 * gone and this route answers 404, so the room is not readable. The comment
 * action in this folder (`actions.ts`) stays, because article pages use it.
 */
export default function CommunityPage() {
  notFound();
}