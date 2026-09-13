/**
 * The admin users list is split by the kind of account (D-087). Defined once
 * here so the sidebar, the pages, the service and the table agree on the names
 * and paths. No server-only import: the table is a client component.
 */
import type { EditorStatus, Role, WriterApplicationStatus, WriterStatus } from "@/db/schema";

export const USER_SEGMENTS = ["all", "writers", "editors", "illustrators", "readers"] as const;

export type UserSegment = (typeof USER_SEGMENTS)[number];

export const USER_SEGMENT_META: Record<
  UserSegment,
  { href: string; navLabel: string; title: string; description: string; countNoun: string }
> = {
  all: {
    href: "/admin/users",
    navLabel: "Hepsi",
    title: "Tüm kullanıcılar",
    description: "Rol değiştirme, kimlik doğrulama ve hesap işlemleri.",
    countNoun: "kullanıcı",
  },
  writers: {
    href: "/admin/users/writers",
    navLabel: "Yazarlar",
    title: "Yazarlar",
    description: "Yazar durumu, alanlar ve yazı sayıları. Editor & Yazar hesapları da burada.",
    countNoun: "yazar",
  },
  editors: {
    href: "/admin/users/editors",
    navLabel: "Editörler",
    title: "Editörler",
    description: "Editör durumu, sorumlu olunan alanlar ve iki adımlı doğrulama.",
    countNoun: "editör",
  },
  illustrators: {
    href: "/admin/users/illustrators",
    navLabel: "Çizerler",
    title: "Çizerler",
    description: "Dergiye görsel üreten hesaplar.",
    countNoun: "çizer",
  },
  readers: {
    href: "/admin/users/readers",
    navLabel: "Kullanıcılar",
    title: "Kullanıcılar",
    description: "Rolü olmayan okuyucu hesapları: doğrulama, yaş, KVKK onayı ve yazar başvurusu.",
    countNoun: "kullanıcı",
  },
};

/** One row of an admin users list. Segment-specific figures stay empty elsewhere. */
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
  isMainEditor: boolean;
  /** Only whether 2FA is on; the secret never leaves the service. */
  totpEnabled: boolean;
  kvkkConsentAt: Date | null;
  kvkkConsentVersion: number | null;
  age: number | null;
  /** Below the writer promotion age, worked out on the server where the rule lives. */
  underAge: boolean;
  /** Writers list only. */
  articleCount: number;
  publishedCount: number;
  /** Editors list only, in slot order. */
  editorAreas: string[];
  /** Readers list only: the most recent writer application. */
  applicationStatus: WriterApplicationStatus | null;
};
