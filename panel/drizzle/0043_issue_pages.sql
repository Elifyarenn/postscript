CREATE TYPE "public"."page_template" AS ENUM('cover', 'masthead', 'editorial', 'contents', 'theme_opening', 'section_opening', 'article_opening', 'article_continued', 'visual_article', 'collage_opening', 'full_bleed', 'picks', 'playlist', 'interactive', 'ps_closing', 'back_cover');--> statement-breakpoint
CREATE TABLE "issue_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"issue_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"template" "page_template" NOT NULL,
	"toc_title" text,
	"in_contents" boolean DEFAULT true NOT NULL,
	"heading" text,
	"standfirst" text,
	"byline" text,
	"body" text,
	"image_media_id" uuid,
	"caption" text,
	"article_id" uuid,
	"section" text,
	"blocks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "issue_pages" ADD CONSTRAINT "issue_pages_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_pages" ADD CONSTRAINT "issue_pages_image_media_id_media_id_fk" FOREIGN KEY ("image_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_pages" ADD CONSTRAINT "issue_pages_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "issue_pages_issue_position_idx" ON "issue_pages" USING btree ("issue_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "issue_pages_issue_position_unique" ON "issue_pages" USING btree ("issue_id","position");