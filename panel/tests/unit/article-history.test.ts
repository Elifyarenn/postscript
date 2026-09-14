import { describe, expect, it } from "vitest";
import {
  AUTHOR_TOLD_STATUSES,
  describeStep,
  stepsForAudience,
  type AuditRow,
} from "@/lib/article-history";

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

function transition(from: string, to: string, note: string) {
  return describeStep(
    row({ action: "article.status_changed", before: { status: from }, after: { status: to, note } }),
  );
}

describe("describeStep", () => {
  it("reads a status change with the note the reviewer left", () => {
    expect(transition("in_review", "revision_requested", "Giriş paragrafını kısaltın.")).toMatchObject({
      action: "article.status_changed",
      label: "Durum değişti",
      fromStatus: "in_review",
      toStatus: "revision_requested",
      note: "Giriş paragrafını kısaltın.",
      actor: "Deniz Editör",
    });
  });

  it("treats an empty note as no note", () => {
    expect(transition("draft", "in_review", "  ").note).toBeNull();
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

describe("stepsForAudience", () => {
  const steps = [
    describeStep(row({ id: "a", action: "article.created" })),
    transition("in_review", "pending_admin_approval", "İç değerlendirme notu."),
    transition("in_review", "revision_requested", "Girişi kısaltın."),
    describeStep(row({ id: "p", action: "article.plagiarism_status_set", after: { status: "clean", note: "Benzerlik yok." } })),
    describeStep(row({ id: "d", action: "work_approval.declined", after: { reason: "Başlık değişmiş." } })),
  ];

  it("gives editorial staff everything", () => {
    expect(stepsForAudience(steps, "staff")).toEqual(steps);
  });

  it("gives the author every note, internal stages included, but not the plagiarism step", () => {
    const authorView = stepsForAudience(steps, "author");

    expect(authorView.map((step) => step.action)).not.toContain("article.plagiarism_status_set");
    expect(authorView.find((step) => step.toStatus === "pending_admin_approval")?.note).toBe(
      "İç değerlendirme notu.",
    );
    expect(authorView.find((step) => step.toStatus === "revision_requested")?.note).toBe("Girişi kısaltın.");
    // The refusal reason is the author's own words
    expect(authorView.find((step) => step.action === "work_approval.declined")?.note).toBe("Başlık değişmiş.");
    expect(authorView).toHaveLength(steps.length - 1);
  });

  it("matches the statuses the author is e-mailed about", () => {
    expect([...AUTHOR_TOLD_STATUSES].sort()).toEqual(["published", "revision_requested", "withdrawn"]);
  });
});
