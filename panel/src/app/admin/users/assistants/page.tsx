import { UsersListPage, type UsersListSearchParams } from "../users-list";

export const metadata = { title: "Asistanlar" };

export default function AdminAssistantsPage({
  searchParams,
}: {
  searchParams: Promise<UsersListSearchParams>;
}) {
  return <UsersListPage segment="assistants" searchParams={searchParams} />;
}
