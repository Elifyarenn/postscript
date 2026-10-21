CREATE TABLE "issue_view_days" (
	"issue_id" uuid NOT NULL,
	"day" date NOT NULL,
	"views" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "issue_view_days" ADD CONSTRAINT "issue_view_days_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "issue_view_days_issue_day_unique" ON "issue_view_days" USING btree ("issue_id","day");