CREATE TYPE "public"."byline_choice" AS ENUM('real_name', 'pen_name');--> statement-breakpoint
CREATE TYPE "public"."change_kind" AS ENUM('correction', 'content_change');--> statement-breakpoint
ALTER TABLE "settings" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "settings" CASCADE;--> statement-breakpoint
DROP INDEX "media_auto_delete_idx";--> statement-breakpoint
DROP INDEX "rights_grants_article_active_unique";--> statement-breakpoint
ALTER TABLE "agreement_acceptances" ADD COLUMN "rendered_markdown" text;--> statement-breakpoint
ALTER TABLE "agreement_acceptances" ADD COLUMN "pdf_media_id" uuid;--> statement-breakpoint
ALTER TABLE "article_versions" ADD COLUMN "change_kind" "change_kind" DEFAULT 'correction' NOT NULL;--> statement-breakpoint
ALTER TABLE "rights_grants" ADD COLUMN "agreement_version_id" uuid;--> statement-breakpoint
ALTER TABLE "rights_grants" ADD COLUMN "byline_choice" "byline_choice";--> statement-breakpoint
ALTER TABLE "agreement_acceptances" ADD CONSTRAINT "agreement_acceptances_pdf_media_id_media_id_fk" FOREIGN KEY ("pdf_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rights_grants" ADD CONSTRAINT "rights_grants_agreement_version_id_agreement_versions_id_fk" FOREIGN KEY ("agreement_version_id") REFERENCES "public"."agreement_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "rights_grants_article_active_unique" ON "rights_grants" USING btree ("article_id") WHERE "rights_grants"."status" in ('pending', 'signed');--> statement-breakpoint
ALTER TABLE "articles" DROP COLUMN "co_author_ids";--> statement-breakpoint
ALTER TABLE "media" DROP COLUMN "is_identity_document";--> statement-breakpoint
ALTER TABLE "media" DROP COLUMN "auto_delete_at";--> statement-breakpoint
ALTER TABLE "media" DROP COLUMN "purged_at";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "identity_verified_at";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "identity_verified_by";