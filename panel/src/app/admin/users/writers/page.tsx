import { UsersListPage, type UsersListSearchParams } from "../users-list";

export const metadata = { title: "Yazarlar" };

export default function AdminWritersPage({
  searchParams,
}: {
  searchParams: Promise<UsersListSearchParams>;
}) {
  return <UsersListPage segment="writers" searchParams={searchParams} />;
}
