/**
 * Issues with topic and delivery windows, and the topic proposals in them
 * (D-261). Every rule is exercised at the service, the way a crafted request
 * would reach it: the buttons are not what keeps a late topic out.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { issues, topicProposalEvents, topicProposals, users, type User } from "@/db/schema";
import { isAppError } from "@/lib/errors";
import { MemoryMailAdapter, setMailAdapter } from "@/lib/mail/transport";
import { createIssue, updateIssue } from "@/services/issues";
import { createArticle, createArticleAsWriter, transitionArticle } from "@/services/articles";
import {
  decideTopicProposal,
  isIssueInProgress,
  issueProcessSummaries,
  listIssueCalendar,
  listTopicProposals,
  listWriterIssues,
  reviseTopicProposal,
  submitTopicProposal,
} from "@/services/topics";
import {
  resetTables,
  seedDefaultWriterAreas,
  setupTestDatabase,
  teardownTestDatabase,
} from "../helpers/db";
import {
  acceptCurrentContract,
  actorOf,
  createUser,
  noMeta,
  publishContract,
  testIssueId,
} from "../helpers/factories";

let database: Database;

beforeAll(async () => {
  database = await setupTestDatabase();
  setMailAdapter(new MemoryMailAdapter());
});

afterAll(async () => {
  await teardownTestDatabase();
});

beforeEach(async () => {
  await resetTables(database);
  await seedDefaultWriterAreas();
});

async function expectStatus(promise: Promise<unknown>, status: number) {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(isAppError(error) && error.status).toBe(status);
}

// Konu: 28.09.2026 18:00 – 05.10.2026 18:00; yazı: 10.10.2026 18:00 – 20.10.2026 23:59 (TR)
const TOPIC_OPENS = new Date("2026-09-28T15:00:00Z");
const TOPIC_CLOSES = new Date("2026-10-05T15:00:00Z");
const SUBMISSION_OPENS = new Date("2026-10-10T15:00:00Z");
const SUBMISSION_CLOSES = new Date("2026-10-20T20:59:00Z");
const DURING_TOPIC = new Date("2026-10-01T12:00:00Z");

async function scenario() {
  const admin = await createUser({ role: "admin" });
  const mainEditor = await createUser({ role: "editor" });
  await db.update(users).set({ isMainEditor: true }).where(eq(users.id, mainEditor.id));
  const categoryEditor = await createUser({ role: "editor" });
  const writer = await writerWithArea();
  const otherWriter = await writerWithArea();

  const issue = await createIssue(
    actorOf(admin),
    {
      number: 2,
      title: "İkinci",
      topicOpensAt: TOPIC_OPENS,
      topicClosesAt: TOPIC_CLOSES,
      submissionOpensAt: SUBMISSION_OPENS,
      submissionClosesAt: SUBMISSION_CLOSES,
    },
    noMeta,
  );
  return { admin, mainEditor, categoryEditor, writer, otherWriter, issue };
}

async function writerWithArea(): Promise<User> {
  const writer = await createUser({ role: "writer", writerStatus: "active" });
  await db.update(users).set({ writerArea: "Sanat & Edebiyat" }).where(eq(users.id, writer.id));
  return writer;
}

const TOPIC = { title: "Takıntının anatomisi", description: "Bir takıntının nasıl büyüdüğünü anlatan bir deneme." };

describe("issues and their windows", () => {
  it("lets an admin create an issue with both windows, and nobody else", async () => {
    const { issue, writer, mainEditor } = await scenario();
    expect(issue.topicOpensAt?.toISOString()).toBe(TOPIC_OPENS.toISOString());
    expect(issue.submissionClosesAt?.toISOString()).toBe(SUBMISSION_CLOSES.toISOString());

    await expectStatus(createIssue(actorOf(writer), { number: 3, title: "Yazarın sayısı" }, noMeta), 403);
    await expectStatus(createIssue(actorOf(mainEditor), { number: 3, title: "Editörün sayısı" }, noMeta), 403);
    await expectStatus(
      updateIssue(actorOf(writer), issue.id, { number: 2, title: "İkinci", topicOpensAt: null, topicClosesAt: null }, noMeta),
      403,
    );
  });

  it("refuses a start after its end, in the service and in the database", async () => {
    const admin = await createUser({ role: "admin" });
    await expectStatus(
      createIssue(
        actorOf(admin),
        { number: 4, title: "Ters", topicOpensAt: TOPIC_CLOSES, topicClosesAt: TOPIC_OPENS },
        noMeta,
      ),
      400,
    );
    await expectStatus(
      createIssue(actorOf(admin), { number: 4, title: "Yarım", topicOpensAt: TOPIC_OPENS, topicClosesAt: null }, noMeta),
      400,
    );
    // Straight into the table, around the service: the check constraint holds
    await expect(
      db.insert(issues).values({ number: 5, title: "Ters", topicOpensAt: TOPIC_CLOSES, topicClosesAt: TOPIC_OPENS }),
    ).rejects.toThrow();
  });
});

describe("proposing a topic", () => {
  it("is closed before the window, open inside it (both ends included), closed after", async () => {
    const { writer, issue } = await scenario();
    const actor = actorOf(writer);

    await expectStatus(
      submitTopicProposal(actor, issue.id, TOPIC, noMeta, new Date("2026-09-28T14:59:59Z")),
      409,
    );
    await expectStatus(
      submitTopicProposal(actor, issue.id, TOPIC, noMeta, new Date("2026-10-05T15:00:01Z")),
      409,
    );
    const proposal = await submitTopicProposal(actor, issue.id, TOPIC, noMeta, TOPIC_CLOSES);
    expect(proposal.status).toBe("submitted");
    expect(proposal.issueId).toBe(issue.id);
  });

  it("keeps one proposal per writer per issue, however often it is sent", async () => {
    const { writer, issue } = await scenario();
    await submitTopicProposal(actorOf(writer), issue.id, TOPIC, noMeta, DURING_TOPIC);
    await expectStatus(submitTopicProposal(actorOf(writer), issue.id, TOPIC, noMeta, DURING_TOPIC), 409);

    // Two at once: the unique index lets exactly one through
    const other = await writerWithArea();
    const results = await Promise.allSettled([
      submitTopicProposal(actorOf(other), issue.id, TOPIC, noMeta, DURING_TOPIC),
      submitTopicProposal(actorOf(other), issue.id, TOPIC, noMeta, DURING_TOPIC),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  });

  it("is refused to a reader and hidden in the admins' working issue", async () => {
    const { issue } = await scenario();
    const reader = await createUser({ role: "user" });
    await expectStatus(submitTopicProposal(actorOf(reader), issue.id, TOPIC, noMeta, DURING_TOPIC), 403);

    await db.update(issues).set({ adminOnly: true }).where(eq(issues.id, issue.id));
    const writer = await writerWithArea();
    await expectStatus(submitTopicProposal(actorOf(writer), issue.id, TOPIC, noMeta, DURING_TOPIC), 404);
  });
});

describe("a writer with two areas (D-271)", () => {
  const FIRST = "Sanat & Edebiyat";
  const SECOND = "Felsefe & Düşünce";

  async function twoAreaWriter(): Promise<User> {
    const writer = await writerWithArea();
    await db.update(users).set({ writerArea2: SECOND }).where(eq(users.id, writer.id));
    return writer;
  }

  it("proposes one topic for each area, and no more", async () => {
    const { issue } = await scenario();
    const writer = actorOf(await twoAreaWriter());

    // Which area must be said: each one takes its own topic
    await expectStatus(submitTopicProposal(writer, issue.id, TOPIC, noMeta, DURING_TOPIC), 400);

    const first = await submitTopicProposal(writer, issue.id, { ...TOPIC, category: FIRST }, noMeta, DURING_TOPIC);
    expect(first.category).toBe(FIRST);
    await expectStatus(
      submitTopicProposal(writer, issue.id, { ...TOPIC, title: "Bir daha", category: FIRST }, noMeta, DURING_TOPIC),
      409,
    );

    const second = await submitTopicProposal(
      writer,
      issue.id,
      { title: "Düşüncenin takıntısı", description: "Felsefede saplantı fikri üzerine bir deneme.", category: SECOND },
      noMeta,
      DURING_TOPIC,
    );
    expect(second.category).toBe(SECOND);

    const [entry] = (await listWriterIssues(writer)).filter((row) => row.issue.id === issue.id);
    expect(entry!.proposals.map(({ proposal }) => proposal.category)).toEqual([FIRST, SECOND]);
    expect(entry!.openAreas).toEqual([]);
    expect(entry!.canProposeMore).toBe(false);
  });

  it("shows the second area as still open after the first topic", async () => {
    const { issue } = await scenario();
    const writer = actorOf(await twoAreaWriter());
    await submitTopicProposal(writer, issue.id, { ...TOPIC, category: SECOND }, noMeta, DURING_TOPIC);

    const [entry] = (await listWriterIssues(writer)).filter((row) => row.issue.id === issue.id);
    expect(entry!.openAreas).toEqual([FIRST]);
    expect(entry!.canProposeMore).toBe(true);
  });

  it("cannot move a revised topic onto the area that already has one", async () => {
    const { issue, mainEditor } = await scenario();
    const writer = actorOf(await twoAreaWriter());
    await submitTopicProposal(writer, issue.id, { ...TOPIC, category: FIRST }, noMeta, DURING_TOPIC);
    const other = await submitTopicProposal(
      writer,
      issue.id,
      { ...TOPIC, title: "İkinci konu", category: SECOND },
      noMeta,
      DURING_TOPIC,
    );
    await decideTopicProposal(
      actorOf(mainEditor),
      other.id,
      { decision: "revision", note: "Başka bir açıdan bakın.", expectedVersion: 1 },
      noMeta,
    );

    await expectStatus(
      reviseTopicProposal(writer, other.id, { ...TOPIC, category: FIRST }, 2, noMeta, DURING_TOPIC),
      409,
    );
    const revised = await reviseTopicProposal(writer, other.id, { ...TOPIC, category: SECOND }, 2, noMeta, DURING_TOPIC);
    expect(revised.status).toBe("submitted");
  });

  it("gives a single-area writer's topic their area, as before one topic", async () => {
    const { writer, issue } = await scenario();
    const proposal = await submitTopicProposal(actorOf(writer), issue.id, TOPIC, noMeta, DURING_TOPIC);
    expect(proposal.category).toBe(FIRST);
  });

  it("counts a topic sent before areas were required against the same limit", async () => {
    const { issue } = await scenario();
    const writer = await twoAreaWriter();
    // An older topic with no area (D-261 allowed that)
    await db.insert(topicProposals).values({
      issueId: issue.id,
      authorId: writer.id,
      title: "Eski konu",
      description: "Alan seçmeden gönderilmiş bir konu.",
      status: "submitted",
    });

    await submitTopicProposal(actorOf(writer), issue.id, { ...TOPIC, category: FIRST }, noMeta, DURING_TOPIC);
    await expectStatus(
      submitTopicProposal(actorOf(writer), issue.id, { ...TOPIC, category: SECOND }, noMeta, DURING_TOPIC),
      409,
    );
  });
});

describe("the main editor's decision", () => {
  it("accepts; a category editor and the writer may not decide", async () => {
    const { writer, mainEditor, categoryEditor, issue } = await scenario();
    const proposal = await submitTopicProposal(actorOf(writer), issue.id, TOPIC, noMeta, DURING_TOPIC);

    await expectStatus(
      decideTopicProposal(actorOf(categoryEditor), proposal.id, { decision: "accept", expectedVersion: 1 }, noMeta),
      403,
    );
    await expectStatus(
      decideTopicProposal(actorOf(writer), proposal.id, { decision: "accept", expectedVersion: 1 }, noMeta),
      403,
    );

    const accepted = await decideTopicProposal(
      actorOf(mainEditor),
      proposal.id,
      { decision: "accept", expectedVersion: 1 },
      noMeta,
    );
    expect(accepted.status).toBe("accepted");
    expect(accepted.decidedBy).toBe(mainEditor.id);
  });

  it("asks for a change with a note; the writer revises and it is reviewed again", async () => {
    const { writer, otherWriter, mainEditor, issue } = await scenario();
    const proposal = await submitTopicProposal(actorOf(writer), issue.id, TOPIC, noMeta, DURING_TOPIC);

    await expectStatus(
      decideTopicProposal(actorOf(mainEditor), proposal.id, { decision: "revision", expectedVersion: 1 }, noMeta),
      400,
    );
    const sentBack = await decideTopicProposal(
      actorOf(mainEditor),
      proposal.id,
      { decision: "revision", note: "Daha dar bir çerçeve seçin.", expectedVersion: 1 },
      noMeta,
    );
    expect(sentBack.status).toBe("revision_requested");
    expect(sentBack.editorNote).toBe("Daha dar bir çerçeve seçin.");

    // Nobody else rewrites it
    await expectStatus(
      reviseTopicProposal(actorOf(otherWriter), proposal.id, TOPIC, sentBack.version, noMeta, DURING_TOPIC),
      403,
    );

    const revised = await reviseTopicProposal(
      actorOf(writer),
      proposal.id,
      { ...TOPIC, title: "Takıntı ve bale" },
      sentBack.version,
      noMeta,
      DURING_TOPIC,
    );
    expect(revised.status).toBe("submitted");
    expect(revised.title).toBe("Takıntı ve bale");

    // A replay of the same resubmission finds the version moved on
    await expectStatus(
      reviseTopicProposal(actorOf(writer), proposal.id, TOPIC, sentBack.version, noMeta, DURING_TOPIC),
      409,
    );

    // The trail keeps every step, with who and why
    const events = await db
      .select()
      .from(topicProposalEvents)
      .where(eq(topicProposalEvents.proposalId, proposal.id));
    expect(events.map((event) => event.kind)).toEqual(["submitted", "revision_requested", "resubmitted"]);
    expect(events[1]!.note).toBe("Daha dar bir çerçeve seçin.");
    expect(events[1]!.actorId).toBe(mainEditor.id);
  });

  it("lets only one of two tabs decide", async () => {
    const { writer, mainEditor, admin, issue } = await scenario();
    const proposal = await submitTopicProposal(actorOf(writer), issue.id, TOPIC, noMeta, DURING_TOPIC);

    await decideTopicProposal(actorOf(mainEditor), proposal.id, { decision: "accept", expectedVersion: 1 }, noMeta);
    await expectStatus(
      decideTopicProposal(
        actorOf(admin),
        proposal.id,
        { decision: "reject", note: "Uygun değil.", expectedVersion: 1 },
        noMeta,
      ),
      409,
    );
    const [row] = await db.select().from(topicProposals).where(eq(topicProposals.id, proposal.id));
    expect(row!.status).toBe("accepted");
  });
});

describe("the article for a topic", () => {
  async function acceptedTopic() {
    const context = await scenario();
    await publishContract(actorOf(context.admin));
    await acceptCurrentContract(context.writer);
    const proposal = await submitTopicProposal(actorOf(context.writer), context.issue.id, TOPIC, noMeta, DURING_TOPIC);
    return { ...context, proposal };
  }

  it("cannot start before the topic is accepted, and starts once only", async () => {
    const { writer, mainEditor, proposal } = await acceptedTopic();
    const input = { title: "Takıntının anatomisi", category: "Sanat & Edebiyat", topicProposalId: proposal.id };

    await expectStatus(createArticleAsWriter(actorOf(writer), input, noMeta), 409);

    await decideTopicProposal(actorOf(mainEditor), proposal.id, { decision: "accept", expectedVersion: 1 }, noMeta);
    const article = await createArticleAsWriter(actorOf(writer), input, noMeta);
    expect(article.issueId).toBe(proposal.issueId);

    await expectStatus(createArticleAsWriter(actorOf(writer), { ...input, title: "İkinci deneme" }, noMeta), 409);
  });

  it("is refused a writer who is not the topic's", async () => {
    const { otherWriter, mainEditor, proposal } = await acceptedTopic();
    await decideTopicProposal(actorOf(mainEditor), proposal.id, { decision: "accept", expectedVersion: 1 }, noMeta);
    await expectStatus(
      createArticleAsWriter(
        actorOf(otherWriter),
        { title: "Başkasının konusu", category: "Sanat & Edebiyat", topicProposalId: proposal.id },
        noMeta,
      ),
      403,
    );
  });

  it("is handed in only inside the delivery window", async () => {
    const { writer, mainEditor, proposal } = await acceptedTopic();
    await decideTopicProposal(actorOf(mainEditor), proposal.id, { decision: "accept", expectedVersion: 1 }, noMeta);
    const article = await createArticleAsWriter(
      actorOf(writer),
      { title: "Takıntının anatomisi", category: "Sanat & Edebiyat", topicProposalId: proposal.id },
      noMeta,
    );

    // The real clock is 2026-09-26 or later in these tests; set the window around it
    const now = Date.now();
    await db
      .update(issues)
      .set({ submissionOpensAt: new Date(now + 86_400_000), submissionClosesAt: new Date(now + 2 * 86_400_000) })
      .where(eq(issues.id, proposal.issueId));
    await expectStatus(transitionArticle(actorOf(writer), article.id, "in_review", noMeta), 409);

    await db
      .update(issues)
      .set({ submissionOpensAt: new Date(now - 2 * 86_400_000), submissionClosesAt: new Date(now - 86_400_000) })
      .where(eq(issues.id, proposal.issueId));
    await expectStatus(transitionArticle(actorOf(writer), article.id, "in_review", noMeta), 409);

    await db
      .update(issues)
      .set({ submissionOpensAt: new Date(now - 86_400_000), submissionClosesAt: new Date(now + 86_400_000) })
      .where(eq(issues.id, proposal.issueId));
    const handedIn = await transitionArticle(actorOf(writer), article.id, "in_review", noMeta);
    expect(handedIn.status).toBe("in_review");
  });

  it("is not handed in without an accepted topic in an issue with windows", async () => {
    const { admin, writer, issue } = await acceptedTopic();
    const now = Date.now();
    await db
      .update(issues)
      .set({ submissionOpensAt: new Date(now - 86_400_000), submissionClosesAt: new Date(now + 86_400_000) })
      .where(eq(issues.id, issue.id));
    // An editor filed a draft under the writer's name, bypassing topics
    const draft = await createArticle(
      actorOf(admin),
      { issueId: issue.id, title: "Konusuz yazı", bodyMarkdown: "Gövde.", authorId: writer.id },
      noMeta,
    );
    await expectStatus(transitionArticle(actorOf(writer), draft.id, "in_review", noMeta), 409);

    // And the writer cannot start one there without a topic either
    await expectStatus(
      createArticleAsWriter(
        actorOf(writer),
        { title: "Konusuz", category: "Sanat & Edebiyat", issueId: issue.id },
        noMeta,
      ),
      409,
    );
  });

  it("keeps the old flow in an issue without windows (issue 1)", async () => {
    const { writer } = await acceptedTopic();
    const article = await createArticleAsWriter(
      actorOf(writer),
      { title: "Eski akış", category: "Sanat & Edebiyat", issueId: await testIssueId() },
      noMeta,
    );
    const handedIn = await transitionArticle(actorOf(writer), article.id, "in_review", noMeta);
    expect(handedIn.status).toBe("in_review");
  });

  it("does not move a topic's article into another issue", async () => {
    const { admin, writer, mainEditor, proposal } = await acceptedTopic();
    await decideTopicProposal(actorOf(mainEditor), proposal.id, { decision: "accept", expectedVersion: 1 }, noMeta);
    const article = await createArticleAsWriter(
      actorOf(writer),
      { title: "Yerinde kalır", category: "Sanat & Edebiyat", topicProposalId: proposal.id },
      noMeta,
    );
    const { updateArticle } = await import("@/services/articles");
    await expectStatus(
      updateArticle(actorOf(admin), article.id, { title: "Yerinde kalır", issueId: await testIssueId() }, noMeta),
      409,
    );
  });
});

describe("what each side sees", () => {
  it("shows the writer running and past issues apart", async () => {
    const { writer, issue, admin } = await scenario();
    await submitTopicProposal(actorOf(writer), issue.id, TOPIC, noMeta, DURING_TOPIC);
    const past = await createIssue(
      actorOf(admin),
      {
        number: 1,
        title: "Geçmiş",
        topicOpensAt: new Date("2026-01-01T09:00:00Z"),
        topicClosesAt: new Date("2026-01-10T09:00:00Z"),
        submissionOpensAt: new Date("2026-01-15T09:00:00Z"),
        submissionClosesAt: new Date("2026-01-25T09:00:00Z"),
      },
      noMeta,
    );

    const entries = await listWriterIssues(actorOf(writer));
    const clock = new Date("2026-10-01T12:00:00Z");
    const running = entries.filter((entry) => isIssueInProgress(entry.issue, clock));
    expect(running.map((entry) => entry.issue.number)).toEqual([2]);
    expect(running[0]!.proposals.map(({ proposal }) => proposal.title)).toEqual([TOPIC.title]);
    expect(entries.find((entry) => entry.issue.id === past.id)).toBeDefined();
    expect(isIssueInProgress(past, clock)).toBe(false);
  });

  it("filters the review list by issue and gives the admin real counts", async () => {
    const { writer, otherWriter, mainEditor, admin, issue } = await scenario();
    const first = await submitTopicProposal(actorOf(writer), issue.id, TOPIC, noMeta, DURING_TOPIC);
    await submitTopicProposal(actorOf(otherWriter), issue.id, TOPIC, noMeta, DURING_TOPIC);
    await decideTopicProposal(actorOf(mainEditor), first.id, { decision: "accept", expectedVersion: 1 }, noMeta);

    const listed = await listTopicProposals(actorOf(mainEditor), { issueId: issue.id });
    expect(listed).toHaveLength(2);
    expect(await listTopicProposals(actorOf(mainEditor), { issueId: await testIssueId() })).toHaveLength(0);

    const [summary] = await issueProcessSummaries(actorOf(admin), DURING_TOPIC);
    expect(summary).toMatchObject({ proposalCount: 2, waiting: 1, accepted: 1, revisionRequested: 0 });
    expect(summary!.writerCount).toBeGreaterThanOrEqual(2);
    // Both writers have sent theirs; nobody in the list is one of them
    const missing = summary!.writersWithoutTopic.map((row) => row.id);
    expect(missing).not.toContain(writer.id);
    expect(missing).not.toContain(otherWriter.id);

    await expectStatus(issueProcessSummaries(actorOf(writer), DURING_TOPIC), 403);
  });
});


describe("the issue calendar on the writer's and editor's panels (D-264)", () => {
  it("shows running issues to writers and editors, the working issue to admins only", async () => {
    const { writer, categoryEditor, admin, issue } = await scenario();
    const working = await createIssue(
      actorOf(admin),
      { number: 7, title: "Çalışma", topicOpensAt: TOPIC_OPENS, topicClosesAt: TOPIC_CLOSES },
      noMeta,
    );
    await db.update(issues).set({ adminOnly: true }).where(eq(issues.id, working.id));
    // An issue without windows and one long over are not on the calendar
    await testIssueId();
    await createIssue(
      actorOf(admin),
      {
        number: 1,
        title: "Geçmiş",
        submissionOpensAt: new Date("2026-01-15T09:00:00Z"),
        submissionClosesAt: new Date("2026-01-25T09:00:00Z"),
      },
      noMeta,
    );

    const numbers = async (user: User) =>
      (await listIssueCalendar(actorOf(user), DURING_TOPIC)).map((row) => row.number);
    expect(await numbers(writer)).toEqual([issue.number]);
    expect(await numbers(categoryEditor)).toEqual([issue.number]);
    expect(await numbers(admin)).toEqual([issue.number, 7]);

    await expectStatus(listIssueCalendar(actorOf(await createUser({ role: "user" })), DURING_TOPIC), 403);
  });
});
