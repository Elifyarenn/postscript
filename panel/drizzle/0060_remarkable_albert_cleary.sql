CREATE TABLE "issue_area_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"issue_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"area_id" uuid NOT NULL,
	"granted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "issue_area_grants" ADD CONSTRAINT "issue_area_grants_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_area_grants" ADD CONSTRAINT "issue_area_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_area_grants" ADD CONSTRAINT "issue_area_grants_area_id_writer_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."writer_areas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_area_grants" ADD CONSTRAINT "issue_area_grants_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "issue_area_grants_triple_unique" ON "issue_area_grants" USING btree ("issue_id","user_id","area_id");--> statement-breakpoint
CREATE INDEX "issue_area_grants_user_idx" ON "issue_area_grants" USING btree ("user_id");