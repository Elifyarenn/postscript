ALTER TABLE "articles" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
UPDATE "articles" SET "status" = 'pending_admin_approval' WHERE "status" = 'category_approved';--> statement-breakpoint
UPDATE "articles" SET "status" = 'ready_for_publishing' WHERE "status" = 'admin_review';--> statement-breakpoint
ALTER TABLE "articles" ALTER COLUMN "status" SET DEFAULT 'draft'::text;--> statement-breakpoint
DROP TYPE "public"."article_status";--> statement-breakpoint
CREATE TYPE "public"."article_status" AS ENUM('draft', 'in_review', 'pending_admin_approval', 'ready_for_publishing', 'revision_requested', 'accepted', 'awaiting_rights', 'scheduled', 'published', 'archived', 'withdrawn');--> statement-breakpoint
ALTER TABLE "articles" ALTER COLUMN "status" SET DEFAULT 'draft'::"public"."article_status";--> statement-breakpoint
ALTER TABLE "articles" ALTER COLUMN "status" SET DATA TYPE "public"."article_status" USING "status"::"public"."article_status";