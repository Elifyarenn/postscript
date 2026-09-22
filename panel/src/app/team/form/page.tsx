import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/auth/guard";
import { readCsrfToken } from "@/lib/csrf";
import { MOTTO_MAX, ZODIAC_SIGNS } from "@/lib/zodiac";
import { mottoGroupsFor } from "@/lib/motto-suggestions";
import { getOwnTeamAvatar, getOwnTeamForm, isTeamMember, teamDutyOf } from "@/services/team-avatars";
import { PanelForm } from "@/components/form";
import { Alert, Card, Field, Select } from "@/components/ui";
import { MottoField } from "@/components/motto-field";
import { saveTeamFormAction } from "./actions";

export const metadata: Metadata = {
  title: "Ekip formu",
  robots: { index: false, follow: false },
};

/**
 * The team form (D-226): one line of their own, how they want to be named on
 * the team page, and their star sign.
 *
 * It is open only to a member who has already sent an avatar: the answers are
 * kept on that record and belong beside the drawing.
 */
export default async function TeamFormPage() {
  const { user } = await requireSession();

  if (!(await isTeamMember({ ...user }))) {
    return (
      <main className="mx-auto max-w-xl p-6">
        <Card>
          <h1 className="mb-2 font-serif text-xl">Bu sayfa yalnızca dergi ekibine açık</h1>
          <p className="text-sm text-muted">
            Ekipte olduğunuz hâlde bu mesajı görüyorsanız yönetimle iletişime geçin.
          </p>
        </Card>
      </main>
    );
  }

  const [avatar, form, duty, csrfToken] = await Promise.all([
    getOwnTeamAvatar({ ...user }),
    getOwnTeamForm({ ...user }),
    // The ready lines follow what the person does (D-227)
    teamDutyOf({ ...user }),
    readCsrfToken(),
  ]);

  return (
    <main className="mx-auto max-w-xl space-y-4 p-6">
      <header>
        <p className="font-serif text-xs tracking-[0.2em] text-accent uppercase">postscript · ekip</p>
        <h1 className="mt-1 font-serif text-2xl">Ekip formu</h1>
        <p className="mt-2 text-sm text-muted">
          Üç soru, bir dakika. Yanıtlarınız ekip sayfası hazırlanırken kullanılacak.
        </p>
      </header>

      {avatar === null ? (
        // The form has nowhere to live without an avatar, so it is not shown
        <Card>
          <h2 className="mb-2 font-serif text-lg">Önce avatarınız</h2>
          <p className="text-sm">
            Bu formu yalnızca ekip avatarını oluşturup gönderenler doldurabiliyor. Avatarınızı
            oluşturduktan sonra buraya dönün.{" "}
            <Link href="/team/avatar" className="text-accent underline">
              Avatarımı oluştur
            </Link>
          </p>
        </Card>
      ) : (
        <>
          {form?.answered && (
            <Alert tone="success" title="Formu yanıtladınız">
              Dilediğiniz zaman değiştirebilirsiniz; son gönderdiğiniz yanıtlar geçerli olur.
            </Alert>
          )}

          <Card>
            <PanelForm action={saveTeamFormAction} csrfToken={csrfToken ?? ""} submitLabel="Gönder">
              <Field
                label="Kendinizden bir söz"
                htmlFor="motto"
                hint={`Ekip sayfasında adınızın yanında yer alacak. En çok ${MOTTO_MAX} karakter.`}
              >
                <MottoField
                  groups={mottoGroupsFor(duty)}
                  defaultValue={form?.motto ?? ""}
                  max={MOTTO_MAX}
                />
              </Field>

              <Field
                label="Ekip sayfasında ne yazsın?"
                htmlFor="teamByline"
                hint="Yalnızca ekip sayfası için. Yazılarınızın künyesi buradan değil, her yazı için imzaladığınız devir formundan gelir."
              >
                <Select id="teamByline" name="teamByline" required defaultValue={form?.teamByline ?? ""}>
                  <option value="" disabled>
                    Seçin
                  </option>
                  <option value="real_name">Adım</option>
                  <option value="pen_name">Mahlasım</option>
                </Select>
              </Field>

              <Field label="Burcunuz" htmlFor="zodiac">
                <Select id="zodiac" name="zodiac" required defaultValue={form?.zodiac ?? ""}>
                  <option value="" disabled>
                    Seçin
                  </option>
                  {ZODIAC_SIGNS.map((sign) => (
                    <option key={sign.id} value={sign.id}>
                      {sign.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </PanelForm>
          </Card>

          <p className="text-xs text-muted">
            Avatarınızı{" "}
            <Link href="/team/avatar" className="underline">
              ekip avatarı sayfasından
            </Link>{" "}
            değiştirebilirsiniz.
          </p>
        </>
      )}
    </main>
  );
}
