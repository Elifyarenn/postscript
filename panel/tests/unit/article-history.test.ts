import { describe, expect, it } from "vitest";
import { describeStep, type AuditRow } from "@/lib/article-history";

function row(overrides: Partial<AuditRow>): AuditRow {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    action: "article.created",
    before: null,
    after: null,
    createdAt: new Date("2026-09-14T10:00:00Z"),
    actorName: "Deniz Editör",
    ...overrides,
  };
}

describe("describeStep", () => {
  it("reads a status change with the note the reviewer left", () => {
    const step = describeStep(
      row({
        action: "article.status_changed",
        before: { status: "in_review" },
        after: { status: "revision_requested", note: "Giriş paragrafını kısaltın." },
      }),
    );
    expect(step).toMatchObject({
      label: "Durum değişti",
      fromStatus: "in_review",
      toStatus: "revision_requested",
      note: "Giriş paragrafını kısaltın.",
      actor: "Deniz Editör",
    });
  });

  it("treats an empty note as no note", () => {
    const step = describeStep(
      row({ action: "article.status_changed", before: { status: "draft" }, after: { status: "in_review", note: "  " } }),
    );
    expect(step.note).toBeNull();
  });

  it("names the plagiarism result and keeps its note", () => {
    const step = describeStep(
      row({ action: "article.plagiarism_status_set", after: { status: "flagged", note: "İki paragraf benzer." } }),
    );
    expect(step.label).toBe("İntihal kontrolü: işaretlendi");
    expect(step.note).toBe("İki paragraf benzer.");
  });

  it("describes the work approval steps, including the writer's refusal reason", () => {
    expect(describeStep(row({ action: "work_approval.signed", after: { bylineChoice: "pen_name" } })).label).toBe(
      "Yazar Eser Onayını imzaladı (yayın adı: mahlas)",
    );
    const declined = describeStep(row({ action: "work_approval.declined", after: { reason: "Başlık değişmiş." } }));
    expect(declined.label).toBe("Yazar Eser Onayını reddetti");
    expect(declined.note).toBe("Başlık değişmiş.");
  });

  it("shows a step without an actor as the system", () => {
    expect(describeStep(row({ actorName: null })).actor).toBe("Sistem");
  });

  it("keeps an unknown action visible under its raw name", () => {
    expect(describeStep(row({ action: "article.something_new" })).label).toBe("article.something_new");
  });
});
