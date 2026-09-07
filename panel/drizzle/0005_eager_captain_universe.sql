ALTER TYPE "public"."email_token_type" ADD VALUE 'change_email';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "pending_email" text;