/**
 * The applicant's answers to the application questions (D-375), as the
 * reviewers read them: the two queues and the "Yazarlık süreci" card.
 * Applications from before D-375 carry none of these and show nothing.
 */
import type { ReactNode } from "react";
import type { ApplicationListItem } from "@/services/writer-applications";
import { areaNameLang } from "@/lib/writer-areas";
import { whatsappHref } from "@/lib/whatsapp";

const ENGAGEMENT_LABELS = {
  long_term: "Uzun süreli",
  one_time: "Tek seferlik",
} as const;

export function ApplicationAnswers({
  application,
}: {
  application: Pick<
    ApplicationListItem,
    "engagement" | "interestAreas" | "applicantPhone" | "hasExperience" | "experience"
  >;
}) {
  const rows: { label: string; value: ReactNode }[] = [];
  if (application.engagement) {
    rows.push({ label: "Yazarlık türü", value: ENGAGEMENT_LABELS[application.engagement] });
  }
  if (application.interestAreas && application.interestAreas.length > 0) {
    rows.push({
      label: "Kategoriler",
      value: application.interestAreas.map((area, index) => (
        <span key={area}>
          {index > 0 && " · "}
          <span lang={areaNameLang(area)}>{area}</span>
        </span>
      )),
    });
  }
  // Only answered applications ask for the number, so older ones skip it too
  if (application.engagement && application.applicantPhone) {
    const href = whatsappHref(application.applicantPhone);
    rows.push({
      label: "İletişim numarası",
      value: href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className="underline">
          {application.applicantPhone}
        </a>
      ) : (
        application.applicantPhone
      ),
    });
  }
  if (application.hasExperience !== null) {
    rows.push({
      label: "Deneyim",
      value: application.hasExperience ? (
        <span className="whitespace-pre-wrap">{application.experience ?? "Var"}</span>
      ) : (
        "Yok"
      ),
    });
  }
  if (rows.length === 0) return null;

  return (
    <dl className="mb-4 grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[10rem_1fr]">
      {rows.map((row) => (
        <div key={row.label} className="contents">
          <dt className="text-muted">{row.label}</dt>
          <dd className="text-ink">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
