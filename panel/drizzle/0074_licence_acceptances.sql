CREATE TABLE "licence_acceptances" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"article_id" uuid,
	"illustration_id" uuid,
	"work_title" text NOT NULL,
	"template_version" text NOT NULL,
	"rendered_markdown" text NOT NULL,
	"text_hash" text NOT NULL,
	"content_hash" text NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip" text,
	"user_agent" text,
	"pdf_media_id" uuid
);
--> statement-breakpoint
ALTER TABLE "licence_acceptances" ADD CONSTRAINT "licence_acceptances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "licence_acceptances" ADD CONSTRAINT "licence_acceptances_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "licence_acceptances" ADD CONSTRAINT "licence_acceptances_illustration_id_illustrations_id_fk" FOREIGN KEY ("illustration_id") REFERENCES "public"."illustrations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "licence_acceptances" ADD CONSTRAINT "licence_acceptances_pdf_media_id_media_id_fk" FOREIGN KEY ("pdf_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "licence_acceptances_user_idx" ON "licence_acceptances" USING btree ("user_id","accepted_at");--> statement-breakpoint
CREATE INDEX "licence_acceptances_article_idx" ON "licence_acceptances" USING btree ("article_id");--> statement-breakpoint
CREATE INDEX "licence_acceptances_illustration_idx" ON "licence_acceptances" USING btree ("illustration_id");