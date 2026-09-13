import { UsersListPage, type UsersListSearchParams } from "../users-list";

export const metadata = { title: "Editörler" };

export default function AdminEditorsPage({
  searchParams,
}: {
  searchParams: Promise<UsersListSearchParams>;
}) {
  return <UsersListPage segment="editors" searchParams={searchParams} />;
}
