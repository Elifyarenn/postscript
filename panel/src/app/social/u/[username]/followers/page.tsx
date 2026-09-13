import { MemberGraphPage } from "../member-graph-page";

export const metadata = { title: "Takipçiler" };

export default async function FollowersPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return <MemberGraphPage username={username} direction="followers" />;
}
