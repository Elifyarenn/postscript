import { UsersListPage, type UsersListSearchParams } from "../users-list";

export const metadata = { title: "Yetkililer" };

/** The accounts marked "Yetkili" (D-295), which replaced the assistants list. */
export default function AdminAuthorizedPage({
  searchParams,
}: {
  searchParams: Promise<UsersListSearchParams>;
}) {
  return <UsersListPage segment="authorized" searchParams={searchParams} />;
}
