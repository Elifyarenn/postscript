CREATE TABLE "illustrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"illustrator_id" uuid NOT NULL,
	"title" text NOT NULL,
	"note" text,
	"issue_id" uuid,
	"storage_key" text NOT NULL,
	"mime" text NOT NULL,
	"size" integer NOT NULL,
	"width" integer,
	"height" integer,
	"sha256" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid
);
--> statement-breakpoint
ALTER TABLE "illustrations" ADD CONSTRAINT "illustrations_illustrator_id_users_id_fk" FOREIGN KEY ("illustrator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "illustrations" ADD CONSTRAINT "illustrations_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "illustrations" ADD CONSTRAINT "illustrations_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "illustrations_illustrator_idx" ON "illustrations" USING btree ("illustrator_id","created_at");--> statement-breakpoint
CREATE INDEX "illustrations_created_at_idx" ON "illustrations" USING btree ("created_at");