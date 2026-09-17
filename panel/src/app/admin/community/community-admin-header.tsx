import Link from "next/link";
import { PageHeader } from "@/components/ui";

/** Each part of the community panel names itself and leads back to its overview (D-180). */
export function CommunityAdminHeader({ title, description }: { title: string; description: string }) {
  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/admin/community" className="text-accent hover:underline">
          ← Topluluk yönetimi
        </Link>
      </p>
      <PageHeader title={title} description={description} />
    </>
  );
}
