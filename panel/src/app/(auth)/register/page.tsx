import { redirect } from "next/navigation";

export const metadata = { title: "Yazar hesabı oluştur" };

/**
 * The reader sign-up is retired for now: new accounts are only taken through
 * the public writer registration at /yazar-basvuru (D-049).
 */
export default function RegisterPage() {
  redirect("/yazar-basvuru");
}
