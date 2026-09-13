import { UsersListPage, type UsersListSearchParams } from "../users-list";

export const metadata = { title: "Kullanıcılar" };

export default function AdminReadersPage({
  searchParams,
}: {
  searchParams: Promise<UsersListSearchParams>;
}) {
  return <UsersListPage segment="readers" searchParams={searchParams} />;
}
