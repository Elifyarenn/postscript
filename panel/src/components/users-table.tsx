"use client";

/**
 * The admin users list table.
 *
 * Which columns are shown is the admin's choice, remembered per browser in
 * localStorage (the only client-side persistent storage the panel uses). The
 * table renders server side; this component only toggles the columns and keeps
 * the choice across visits.
 */
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Card, EmptyState, StatusBadge, Table, Td, Th } from "./ui";
import { formatDate } from "@/lib/utils";
import type { EditorStatus, Role, WriterStatus } from "@/db/schema";

export type UserListRow = {
  id: string;
  email: string;
  displayName: string;
  penName: string | null;
  role: Role;
  writerStatus: WriterStatus | null;
  editorStatus: EditorStatus | null;
  emailVerifiedAt: Date | null;
  birthDate: string | null;
  isBanned: boolean;
  writerArea: string | null;
  writerArea2: string | null;
  createdAt: Date;
};

type ColumnId = "name" | "email" | "role" | "status" | "areas" | "birthDate" | "createdAt";

const COLUMNS: { id: ColumnId; label: string }[] = [
  { id: "name", label: "Ad" },
  { id: "email", label: "E-posta" },
  { id: "role", label: "Rol" },
  { id: "status", label: "Durum" },
  { id: "areas", label: "Alanlar" },
  { id: "birthDate", label: "Doğum tarihi" },
  { id: "createdAt", label: "Kayıt" },
];

const STORAGE_KEY = "admin:users:columns";

/** Shown before the admin picks anything; a useful subset, not every column. */
const DEFAULT_VISIBLE: ColumnId[] = ["name", "email", "role", "status", "areas", "createdAt"];

/**
 * A tiny external store so the choice can live in localStorage without a
 * hydration mismatch: the server renders the defaults, the client reads the
 * saved value after hydration. The parsed value is cached so the snapshot
 * reference stays stable between changes.
 */
let cached: ColumnId[] | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(): void {
  listeners.forEach((listener) => listener());
}

function readStored(): ColumnId[] {
  if (typeof window === "undefined") return DEFAULT_VISIBLE;
  if (cached) return cached;
  let next = DEFAULT_VISIBLE;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed: unknown = JSON.parse(saved);
      if (
        Array.isArray(parsed) &&
        parsed.every((id) => COLUMNS.some((column) => column.id === id))
      ) {
        next = parsed as ColumnId[];
      }
    }
  } catch {
    // a broken stored value simply falls back to the defaults
  }
  cached = next;
  return next;
}

function getSnapshot(): ColumnId[] {
  return readStored();
}

function getServerSnapshot(): ColumnId[] {
  return DEFAULT_VISIBLE;
}

function toggleColumn(id: ColumnId): void {
  const current = readStored();
  const next = current.includes(id)
    ? current.filter((column) => column !== id)
    : [...current, id];
  cached = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // storage may be unavailable; the choice still applies for this visit
  }
  notify();
}

export function UsersTable({ rows }: { rows: UserListRow[] }) {
  const visible = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const show = (id: ColumnId) => visible.includes(id);

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-lg">{rows.length} kullanıcı</h2>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {COLUMNS.map((column) => (
            <label
              key={column.id}
              className="flex cursor-pointer items-center gap-1.5 text-xs text-muted"
            >
              <input
                type="checkbox"
                checked={visible.includes(column.id)}
                onChange={() => toggleColumn(column.id)}
                className="size-3.5 rounded border-line"
              />
              {column.label}
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
              {show("name") && <Th>Ad</Th>}
              {show("email") && <Th>E-posta</Th>}
              {show("role") && <Th>Rol</Th>}
              {show("status") && <Th>Durum</Th>}
              {show("areas") && <Th>Alanlar</Th>}
              {show("birthDate") && <Th>Doğum tarihi</Th>}
              {show("createdAt") && <Th>Kayıt</Th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                {show("name") && (
                  <Td>
                    <Link href={`/admin/users/${row.id}`} className="text-accent hover:underline">
                      {row.displayName}
                    </Link>
                    {row.penName && (
                      <span className="ml-2 text-xs text-muted">({row.penName})</span>
                    )}
                  </Td>
                )}
                {show("email") && <Td className="text-xs">{row.email}</Td>}
                {show("role") && (
                  <Td>
                    <StatusBadge status={row.role} />
                  </Td>
                )}
                {show("status") && (
                  <Td className="space-x-1 whitespace-nowrap">
                    {row.isBanned && <StatusBadge status="suspended" />}
                    {row.writerStatus && <StatusBadge status={row.writerStatus} />}
                    {row.editorStatus === "suspended" && <StatusBadge status="suspended" />}
                    {!row.emailVerifiedAt && <span className="text-xs text-warning">e-posta ✗</span>}
                  </Td>
                )}
                {show("areas") && (
                  <Td className="text-xs">
                    {row.writerArea ?? "—"}
                    {row.writerArea2 && <span className="text-muted"> · {row.writerArea2}</span>}
                  </Td>
                )}
                {show("birthDate") && <Td className="text-xs">{row.birthDate ?? "—"}</Td>}
                {show("createdAt") && <Td className="text-xs">{formatDate(row.createdAt)}</Td>}
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}