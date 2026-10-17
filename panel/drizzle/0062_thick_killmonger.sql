CREATE TABLE "contributor_document_works" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"article_id" uuid,
	"quiz_id" uuid,
	"content_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contributor_documents" ADD COLUMN "issue_id" uuid;--> statement-breakpoint
ALTER TABLE "contributor_documents" ADD COLUMN "works_label" text;--> statement-breakpoint
ALTER TABLE "contributor_document_works" ADD CONSTRAINT "contributor_document_works_document_id_contributor_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."contributor_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contributor_document_works" ADD CONSTRAINT "contributor_document_works_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contributor_document_works" ADD CONSTRAINT "contributor_document_works_quiz_id_issue_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."issue_quizzes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contributor_document_works_document_idx" ON "contributor_document_works" USING btree ("document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "contributor_document_works_article_unique" ON "contributor_document_works" USING btree ("article_id") WHERE "contributor_document_works"."article_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "contributor_document_works_quiz_unique" ON "contributor_document_works" USING btree ("quiz_id") WHERE "contributor_document_works"."quiz_id" is not null;--> statement-breakpoint
ALTER TABLE "contributor_documents" ADD CONSTRAINT "contributor_documents_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE restrict ON UPDATE no action;