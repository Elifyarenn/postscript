CREATE TYPE "public"."topic_proposal_event_kind" AS ENUM('submitted', 'resubmitted', 'accepted', 'revision_requested', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."topic_proposal_status" AS ENUM('submitted', 'revision_requested', 'accepted', 'rejected');--> statement-breakpoint
CREATE TABLE "topic_proposal_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"kind" "topic_proposal_event_kind" NOT NULL,
	"version" integer NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"category" text,
	"note" text,
	"actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "topic_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"issue_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"category" text,
	"status" "topic_proposal_status" DEFAULT 'submitted' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"editor_note" text,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"article_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "articles" DROP CONSTRAINT "articles_issue_id_issues_id_fk";
--> statement-breakpoint
ALTER TABLE "articles" ALTER COLUMN "issue_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "topic_opens_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "topic_closes_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "submission_opens_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "submission_closes_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "topic_proposal_events" ADD CONSTRAINT "topic_proposal_events_proposal_id_topic_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."topic_proposals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_proposal_events" ADD CONSTRAINT "topic_proposal_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_proposals" ADD CONSTRAINT "topic_proposals_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_proposals" ADD CONSTRAINT "topic_proposals_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_proposals" ADD CONSTRAINT "topic_proposals_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_proposals" ADD CONSTRAINT "topic_proposals_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "topic_proposal_events_proposal_idx" ON "topic_proposal_events" USING btree ("proposal_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "topic_proposals_issue_author_unique" ON "topic_proposals" USING btree ("issue_id","author_id") WHERE "topic_proposals"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "topic_proposals_article_unique" ON "topic_proposals" USING btree ("article_id") WHERE "topic_proposals"."article_id" is not null;--> statement-breakpoint
CREATE INDEX "topic_proposals_issue_status_idx" ON "topic_proposals" USING btree ("issue_id","status");--> statement-breakpoint
CREATE INDEX "topic_proposals_author_idx" ON "topic_proposals" USING btree ("author_id");--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_topic_window" CHECK (("issues"."topic_opens_at" is null) = ("issues"."topic_closes_at" is null) and ("issues"."topic_opens_at" is null or "issues"."topic_opens_at" < "issues"."topic_closes_at"));--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_submission_window" CHECK (("issues"."submission_opens_at" is null) = ("issues"."submission_closes_at" is null) and ("issues"."submission_opens_at" is null or "issues"."submission_opens_at" < "issues"."submission_closes_at"));