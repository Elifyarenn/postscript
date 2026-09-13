import { MemberGraphPage } from "../member-graph-page";

export const metadata = { title: "Takip edilenler" };

export default async function FollowingPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return <MemberGraphPage username={username} direction="following" />;
}
