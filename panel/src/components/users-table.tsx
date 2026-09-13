"use client";

/**
 * The admin users list table.
 *
 * Each list has its own columns (D-087): a writer is described by areas and
 * output, an editor by duties and 2FA, a reader by consent and application.
 * Which of them are shown is the admin's choice, remembered per list and per
 * browser in localStorage (the only client-side persistent storage the panel
 * uses). The rows arrive from the server; this component only toggles columns.
 */
import Link from "next/link";
import { useCallback, useSyncExternalStore, type ReactNode } from "react";
import { Card, EmptyState, StatusBadge, Table, Td, Th } from "./ui";
import { formatDate } from "@/lib/utils";
import { USER_SEGMENT_META, type UserListRow, type UserSegment } from "@/lib/user-segments";

type ColumnId =
  | "name"
  | "email"
  | "role"
  | "status"
  | "areas"
  | "birthDate"
  | "createdAt"
  | "writerStatus"
  | "articles"
  | "editorStatus"
  | "editorAreas"
  | "mainEditor"
  | "twoFactor"
  | "verified"
  | "age"
  | "kvkk"
  | "application";

type Column = { label: string; className?: string; cell: (row: UserListRow) => ReactNode };

const COLUMNS: Record<ColumnId, Column> = {
  name: {
    label: "Ad",
    cell: (row) => (
      <>
        <Link href={`/admin/users/${row.id}`} className="text-accent hover:underline">
          {row.displayName}
        </Link>
        {row.penName && <span className="ml-2 text-xs text-muted">({row.penName})</span>}
      </>
    ),
  },
  email: { label: "E-posta", className: "text-xs", cell: (row) => row.email },
  role: {
    label: "Rol",
    // A hybrid editor holds both duties; their combined title (D-060)
    cell: (row) =>
      row.role === "editor" && row.writerStatus !== null ? (
        <StatusBadge status="editor_writer" />
      ) : (
        <StatusBadge status={row.role} />
      ),
  },
  status: {
    label: "Durum",
    className: "space-x-1 whitespace-nowrap",
    cell: (row) => (
      <>
        {row.isBanned && <StatusBadge status="suspended" />}
        {row.writerStatus && <StatusBadge status={row.writerStatus} />}
        {row.editorStatus === "suspended" && <StatusBadge status="suspended" />}
        {!row.emailVerifiedAt && <span className="text-xs text-warning">e-posta ✗</span>}
      </>
    ),
  },
  areas: {
    label: "Alanlar",
    className: "text-xs",
    cell: (row) => (
      <>
        {row.writerArea ?? "—"}
        {row.writerArea2 && <span className="text-muted"> · {row.writerArea2}</span>}
      </>
    ),
  },
  birthDate: { label: "Doğum tarihi", className: "text-xs", cell: (row) => row.birthDate ?? "—" },
  createdAt: { label: "Kayıt", className: "text-xs", cell: (row) => formatDate(row.createdAt) },
  writerStatus: {
    label: "Yazar durumu",
    className: "space-x-1 whitespace-nowrap",
    cell: (row) => (
      <>
        {row.writerStatus ? <StatusBadge status={row.writerStatus} /> : "—"}
        {/* An editor in this list is a hybrid; the badge says why it is here */}
        {row.role === "editor" && <StatusBadge status="editor_writer" />}
        {row.isBanned && <span className="text-xs text-danger">yasaklı</span>}
      </>
    ),
  },
  articles: {
    label: "Yazılar",
    className: "text-xs whitespace-nowrap",
    cell: (row) => (
      <>
        {row.articleCount}
        <span className="text-muted"> · {row.publishedCount} yayında</span>
      </>
    ),
  },
  editorStatus: {
    label: "Editör durumu",
    className: "space-x-1 whitespace-nowrap",
    cell: (row) => (
      <>
        <StatusBadge status={row.editorStatus ?? "active"} />
        {row.writerStatus !== null && <StatusBadge status="editor_writer" />}
        {row.isBanned && <span className="text-xs text-danger">yasaklı</span>}
      </>
    ),
  },
  editorAreas: {
    label: "Sorumlu alanlar",
    className: "text-xs",
    cell: (row) => (row.editorAreas.length > 0 ? row.editorAreas.join(" · ") : "—"),
  },
  mainEditor: {
    label: "Ana editör",
    className: "text-xs",
    cell: (row) => (row.isMainEditor ? "Evet" : "—"),
  },
  twoFactor: {
    label: "2FA",
    className: "text-xs whitespace-nowrap",
    // Without it the editor panel stays shut (D-048), so "off" is a warning
    cell: (row) => (row.totpEnabled ? "Açık" : <span className="text-warning">Kapalı</span>),
  },
  verified: {
    label: "Doğrulama",
    className: "text-xs whitespace-nowrap",
    cell: (row) =>
      row.emailVerifiedAt ? (
        formatDate(row.emailVerifiedAt)
      ) : (
        <span className="text-warning">doğrulanmadı</span>
      ),
  },
  age: {
    label: "Yaş",
    className: "text-xs whitespace-nowrap",
    cell: (row) =>
      row.age === null ? (
        "—"
      ) : (
        <>
          {row.age}
          {row.underAge && <span className="text-warning"> · reşit değil</span>}
        </>
      ),
  },
  kvkk: {
    label: "KVKK onayı",
    className: "text-xs whitespace-nowrap",
    cell: (row) =>
      row.kvkkConsentAt ? (
        `v${row.kvkkConsentVersion ?? "?"} · ${formatDate(row.kvkkConsentAt)}`
      ) : (
        <span className="text-warning">yok</span>
      ),
  },
  application: {
    label: "Yazar başvurusu",
    cell: (row) =>
      row.applicationStatus ? <StatusBadge status={row.applicationStatus} /> : "—",
  },
};

/** The columns each list offers, and the ones shown before the admin picks. */
const SEGMENT_COLUMNS: Record<UserSegment, { available: ColumnId[]; defaults: ColumnId[] }> = {
  all: {
    available: ["name", "email", "role", "status", "areas", "birthDate", "createdAt"],
    defaults: ["name", "email", "role", "status", "areas", "createdAt"],
  },
  writers: {
    available: ["name", "email", "writerStatus", "areas", "articles", "birthDate", "createdAt"],
    defaults: ["name", "email", "writerStatus", "areas", "articles", "createdAt"],
  },
  editors: {
    available: ["name", "email", "editorStatus", "editorAreas", "mainEditor", "twoFactor", "createdAt"],
    defaults: ["name", "email", "editorStatus", "editorAreas", "mainEditor", "twoFactor", "createdAt"],
  },
  // The page shows an empty state until an illustrator role exists (D-087)
  illustrators: {
    available: ["name", "email", "createdAt"],
    defaults: ["name", "email", "createdAt"],
  },
  readers: {
    available: ["name", "email", "verified", "age", "birthDate", "kvkk", "application", "status", "createdAt"],
    defaults: ["name", "email", "verified", "age", "kvkk", "application", "createdAt"],
  },
};

/**
 * A tiny external store so the choice can live in localStorage without a
 * hydration mismatch: the server renders the defaults, the client reads the
 * saved value after hydration. The parsed value is cached per list so the
 * snapshot reference stays stable between changes.
 */
const cache = new Map<UserSegment, ColumnId[]>();
const listeners = new Set<() => void>();

// "Hepsi" keeps the key of the single list it replaced, so an earlier choice survives
function storageKey(segment: UserSegment): string {
  return segment === "all" ? "admin:users:columns" : `admin:users:columns:${segment}`;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(): void {
  listeners.forEach((listener) => listener());
}

function readStored(segment: UserSegment): ColumnId[] {
  const { available, defaults } = SEGMENT_COLUMNS[segment];
  if (typeof window === "undefined") return defaults;
  const cached = cache.get(segment);
  if (cached) return cached;
  let next = defaults;
  try {
    const saved = localStorage.getItem(storageKey(segment));
    if (saved) {
      const parsed: unknown = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.every((id) => available.includes(id as ColumnId))) {
        next = parsed as ColumnId[];
      }
    }
  } catch {
    // a broken stored value simply falls back to the defaults
  }
  cache.set(segment, next);
  return next;
}

function toggleColumn(segment: UserSegment, id: ColumnId): void {
  const current = readStored(segment);
  const next = current.includes(id)
    ? current.filter((column) => column !== id)
    : [...current, id];
  cache.set(segment, next);
  try {
    localStorage.setItem(storageKey(segment), JSON.stringify(next));
  } catch {
    // storage may be unavailable; the choice still applies for this visit
  }
  notify();
}

export function UsersTable({ rows, segment }: { rows: UserListRow[]; segment: UserSegment }) {
  const getSnapshot = useCallback(() => readStored(segment), [segment]);
  const getServerSnapshot = useCallback(() => SEGMENT_COLUMNS[segment].defaults, [segment]);
  const visible = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const { available } = SEGMENT_COLUMNS[segment];
  // The table keeps its own column order, whatever order the boxes were ticked in
  const shown = available.filter((id) => visible.includes(id));

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-lg">
          {rows.length} {USER_SEGMENT_META[segment].countNoun}
        </h2>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {available.map((id) => (
            <label key={id} className="flex cursor-pointer items-center gap-1.5 text-xs text-muted">
              <input
                type="checkbox"
                checked={visible.includes(id)}
                onChange={() => toggleColumn(segment, id)}
                className="size-3.5 rounded border-line"
              />
              {COLUMNS[id].label}
            </label>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState>Bu filtreye uyan kullanıcı yok.</EmptyState>
      ) : (
        <Table>
          <thead>
            <tr>
              {shown.map((id) => (
                <Th key={id}>{COLUMNS[id].label}</Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                {shown.map((id) => (
                  <Td key={id} className={COLUMNS[id].className}>
                    {COLUMNS[id].cell(row)}
                  </Td>
                ))}
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}
