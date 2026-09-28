CREATE TYPE "public"."mail_job_status" AS ENUM('pending', 'processing', 'sent', 'failed');--> statement-breakpoint
CREATE TABLE "mail_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"recipient" text NOT NULL,
	"subject" text NOT NULL,
	"text_body" text,
	"html_body" text,
	"attachments" jsonb,
	"status" "mail_job_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 6 NOT NULL,
	"dedupe_key" text,
	"sensitive" boolean DEFAULT false NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_until" timestamp with time zone,
	"last_attempt_at" timestamp with time zone,
	"last_error" text,
	"expires_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"purged_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "mail_jobs_dedupe_key_idx" ON "mail_jobs" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "mail_jobs_due_idx" ON "mail_jobs" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "mail_jobs_created_idx" ON "mail_jobs" USING btree ("created_at");