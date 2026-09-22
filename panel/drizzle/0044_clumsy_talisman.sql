CREATE TYPE "public"."hotspot_kind" AS ENUM('link', 'page', 'info', 'quiz');--> statement-breakpoint
CREATE TYPE "public"."quiz_kind" AS ENUM('knowledge', 'scored');--> statement-breakpoint
CREATE TABLE "issue_page_hotspots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"kind" "hotspot_kind" NOT NULL,
	"name" text,
	"aria_label" text,
	"show_marker" boolean DEFAULT false NOT NULL,
	"x" double precision NOT NULL,
	"y" double precision NOT NULL,
	"w" double precision NOT NULL,
	"h" double precision NOT NULL,
	"url" text,
	"open_in_new_tab" boolean DEFAULT true NOT NULL,
	"target_page_id" uuid,
	"info_title" text,
	"info_body" text,
	"info_media_id" uuid,
	"quiz_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issue_quizzes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"issue_id" uuid NOT NULL,
	"kind" "quiz_kind" NOT NULL,
	"title" text NOT NULL,
	"intro" text,
	"questions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"outcomes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "issue_pages" ADD COLUMN "image_width" integer;--> statement-breakpoint
ALTER TABLE "issue_pages" ADD COLUMN "image_height" integer;--> statement-breakpoint
ALTER TABLE "issue_pages" ADD COLUMN "label" text;--> statement-breakpoint
ALTER TABLE "issue_pages" ADD COLUMN "image_alt" text;--> statement-breakpoint
ALTER TABLE "issue_pages" ADD COLUMN "transcript" text;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "admin_only" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "issue_page_hotspots" ADD CONSTRAINT "issue_page_hotspots_page_id_issue_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."issue_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_page_hotspots" ADD CONSTRAINT "issue_page_hotspots_target_page_id_issue_pages_id_fk" FOREIGN KEY ("target_page_id") REFERENCES "public"."issue_pages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_page_hotspots" ADD CONSTRAINT "issue_page_hotspots_info_media_id_media_id_fk" FOREIGN KEY ("info_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_page_hotspots" ADD CONSTRAINT "issue_page_hotspots_quiz_id_issue_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."issue_quizzes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_quizzes" ADD CONSTRAINT "issue_quizzes_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "issue_page_hotspots_page_idx" ON "issue_page_hotspots" USING btree ("page_id","position");--> statement-breakpoint
CREATE INDEX "issue_quizzes_issue_idx" ON "issue_quizzes" USING btree ("issue_id");