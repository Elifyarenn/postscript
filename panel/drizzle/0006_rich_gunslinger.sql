CREATE TYPE "public"."writer_application_status" AS ENUM('submitted', 'editor_approved', 'admin_approved', 'signed', 'editor_rejected', 'admin_rejected');--> statement-breakpoint
CREATE TABLE "writer_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "writer_application_status" DEFAULT 'submitted' NOT NULL,
	"sample_media_id" uuid,
	"note" text,
	"review_note" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"editor_by" uuid,
	"editor_reviewed_at" timestamp with time zone,
	"admin_by" uuid,
	"admin_reviewed_at" timestamp with time zone,
	"contract_version_id" uuid,
	"signed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "writer_applications" ADD CONSTRAINT "writer_applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "writer_applications" ADD CONSTRAINT "writer_applications_sample_media_id_media_id_fk" FOREIGN KEY ("sample_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "writer_applications" ADD CONSTRAINT "writer_applications_editor_by_users_id_fk" FOREIGN KEY ("editor_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "writer_applications" ADD CONSTRAINT "writer_applications_admin_by_users_id_fk" FOREIGN KEY ("admin_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "writer_applications" ADD CONSTRAINT "writer_applications_contract_version_id_agreement_versions_id_fk" FOREIGN KEY ("contract_version_id") REFERENCES "public"."agreement_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "writer_applications_user_idx" ON "writer_applications" USING btree ("user_id","submitted_at");--> statement-breakpoint
CREATE INDEX "writer_applications_status_idx" ON "writer_applications" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "writer_applications_one_open" ON "writer_applications" USING btree ("user_id") WHERE "writer_applications"."status" in ('submitted', 'editor_approved', 'admin_approved');