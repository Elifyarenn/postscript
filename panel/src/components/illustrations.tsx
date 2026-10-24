/**
 * One handed-in drawing as a card (D-362), shared by the çizer's own list and
 * the reviewers' page. The actions under it are the caller's.
 */
import type { ReactNode } from "react";
import { formatDateTime } from "@/lib/utils";
import type { IllustrationListItem } from "@/services/illustrations";

function megabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} MB`;
}

export function IllustrationCard({
  item,
  showIllustrator = false,
  children,
}: {
  item: IllustrationListItem;
  showIllustrator?: boolean;
  children?: ReactNode;
}) {
  const href = `/api/illustrations/${item.id}`;
  return (
    <li className="flex flex-col overflow-hidden rounded-md border border-line bg-surface">
      <a href={href} target="_blank" rel="noopener" className="block bg-paper">
        {/* eslint-disable-next-line @next/next/no-img-element -- served by our own private route, not optimised */}
        <img
          src={href}
          alt={item.title}
          loading="lazy"
          decoding="async"
          width={item.width ?? undefined}
          height={item.height ?? undefined}
          className="h-48 w-full object-contain"
        />
      </a>
      <div className="flex flex-1 flex-col gap-1 p-3 text-sm">
        <p className="font-medium">{item.title}</p>
        {showIllustrator && <p className="text-muted">{item.illustratorName}</p>}
        <p className="text-xs text-muted">
          {formatDateTime(item.createdAt)}
          {item.issueNumber !== null && ` · Sayı ${item.issueNumber}`}
          {` · ${megabytes(item.size)}`}
          {item.width && item.height ? ` · ${item.width}×${item.height}` : ""}
        </p>
        {item.note && <p className="whitespace-pre-wrap text-xs">{item.note}</p>}
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
          <a href={`${href}?indir`} className="text-xs text-accent underline">
            İndir
          </a>
          {children}
        </div>
      </div>
    </li>
  );
}
