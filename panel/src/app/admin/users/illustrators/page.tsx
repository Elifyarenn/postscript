import { UsersListPage, type UsersListSearchParams } from "../users-list";

export const metadata = { title: "Çizerler" };

export default function AdminIllustratorsPage({
  searchParams,
}: {
  searchParams: Promise<UsersListSearchParams>;
}) {
  return <UsersListPage segment="illustrators" searchParams={searchParams} />;
}
