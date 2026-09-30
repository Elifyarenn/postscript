CREATE TYPE "public"."signed_contract_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "signed_contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"agreement_version_id" uuid NOT NULL,
	"file_media_id" uuid NOT NULL,
	"file_sha256" text NOT NULL,
	"status" "signed_contract_status" DEFAULT 'pending' NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" uuid,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "signed_contracts" ADD CONSTRAINT "signed_contracts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signed_contracts" ADD CONSTRAINT "signed_contracts_agreement_version_id_agreement_versions_id_fk" FOREIGN KEY ("agreement_version_id") REFERENCES "public"."agreement_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signed_contracts" ADD CONSTRAINT "signed_contracts_file_media_id_media_id_fk" FOREIGN KEY ("file_media_id") REFERENCES "public"."media"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signed_contracts" ADD CONSTRAINT "signed_contracts_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "signed_contracts_user_idx" ON "signed_contracts" USING btree ("user_id","uploaded_at");--> statement-breakpoint
CREATE INDEX "signed_contracts_status_idx" ON "signed_contracts" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "signed_contracts_one_pending" ON "signed_contracts" USING btree ("user_id") WHERE "signed_contracts"."status" = 'pending';