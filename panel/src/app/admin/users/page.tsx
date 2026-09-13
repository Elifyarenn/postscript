import { UsersListPage, type UsersListSearchParams } from "./users-list";

export const metadata = { title: "Kullanıcılar" };

/** "Hepsi": every account; the other lists sit beside it by kind (D-087). */
export default function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<UsersListSearchParams>;
}) {
  return <UsersListPage segment="all" searchParams={searchParams} />;
}
