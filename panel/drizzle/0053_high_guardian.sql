CREATE TYPE "public"."contributor_document_kind" AS ENUM('general_agreement', 'work_licence');--> statement-breakpoint
CREATE TYPE "public"."contributor_document_status" AS ENUM('prepared', 'needs_review');--> statement-breakpoint
CREATE TABLE "contributor_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "contributor_document_kind" NOT NULL,
	"user_id" uuid NOT NULL,
	"agreement_version_id" uuid,
	"article_id" uuid,
	"template_version" text NOT NULL,
	"status" "contributor_document_status" NOT NULL,
	"review_reasons" text[] DEFAULT '{}'::text[] NOT NULL,
	"rendered_markdown" text,
	"text_hash" text,
	"work_content_hash" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contributor_documents" ADD CONSTRAINT "contributor_documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contributor_documents" ADD CONSTRAINT "contributor_documents_agreement_version_id_agreement_versions_id_fk" FOREIGN KEY ("agreement_version_id") REFERENCES "public"."agreement_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contributor_documents" ADD CONSTRAINT "contributor_documents_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contributor_documents" ADD CONSTRAINT "contributor_documents_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contributor_documents_user_idx" ON "contributor_documents" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "contributor_documents_general_unique" ON "contributor_documents" USING btree ("user_id","agreement_version_id") WHERE "contributor_documents"."kind" = 'general_agreement';--> statement-breakpoint
CREATE UNIQUE INDEX "contributor_documents_licence_unique" ON "contributor_documents" USING btree ("article_id","template_version") WHERE "contributor_documents"."kind" = 'work_licence';