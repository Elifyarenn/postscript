import type { Metadata } from "next";
import { notFound } from "next/navigation";
import KvkkPage, { metadata as kvkkMetadata } from "@/app/kvkk/page";
import TermsPage, { metadata as termsMetadata } from "@/app/kullanim-sartlari/page";
import MagazinePage, { metadata as magazineMetadata } from "@/app/magazine/page";
import { metadata as issuesMetadata } from "@/app/magazine/issues/page";
import { metadata as homeMetadata } from "@/app/page";
import { metadata as categoriesMetadata } from "@/app/kategoriler/page";
import { metadata as imprintMetadata } from "@/app/kunye/page";
import { CategoriesView } from "@/components/public-views/categories";
import { HomeView } from "@/components/public-views/home";
import { ImprintView } from "@/components/public-views/imprint";
import { IssuesView } from "@/components/public-views/issues";
import { SiteShell } from "@/components/site-shell";

/**
 * The cached copies of the public pages that have no address parameter
 * (D-351), served to visitors without a session by the rewrites in
 * next.config.ts. They sit behind one dynamic segment on purpose: nothing here
 * is drawn at build time, so the build never needs the database, and each copy
 * is drawn on its first visit and then kept for a minute.
 */
const PAGES = {
  "ana-sayfa": { metadata: homeMetadata, render: () => <HomeView user={null} /> },
  kategoriler: { metadata: categoriesMetadata, render: () => <CategoriesView user={null} /> },
  kunye: { metadata: imprintMetadata, render: () => <ImprintView isAdmin={false} /> },
  kvkk: { metadata: kvkkMetadata, render: () => <KvkkPage /> },
  "kullanim-sartlari": { metadata: termsMetadata, render: () => <TermsPage /> },
  // The magazine's own pages sit in its frame, as /magazine's layout draws it
  dergi: {
    metadata: magazineMetadata,
    render: () => (
      <SiteShell user={null}>
        <MagazinePage searchParams={Promise.resolve({})} />
      </SiteShell>
    ),
  },
  sayilar: {
    metadata: issuesMetadata,
    render: () => (
      <SiteShell user={null}>
        <IssuesView user={null} />
      </SiteShell>
    ),
  },
} satisfies Record<string, { metadata: Metadata; render: () => React.ReactNode }>;

type PageKey = keyof typeof PAGES;

function pageOf(key: string): (typeof PAGES)[PageKey] | null {
  return Object.hasOwn(PAGES, key) ? PAGES[key as PageKey] : null;
}

export const revalidate = 60;

export function generateStaticParams(): { key: string }[] {
  return [];
}

export async function generateMetadata({ params }: { params: Promise<{ key: string }> }): Promise<Metadata> {
  return pageOf((await params).key)?.metadata ?? {};
}

export default async function AnonymousStaticPage({ params }: { params: Promise<{ key: string }> }) {
  const page = pageOf((await params).key);
  if (!page) notFound();
  return page.render();
}
