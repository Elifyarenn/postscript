ALTER TABLE "signed_contracts" ADD COLUMN "countersigned_media_id" uuid;--> statement-breakpoint
ALTER TABLE "signed_contracts" ADD COLUMN "countersigned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "signed_contracts" ADD COLUMN "countersigned_by" uuid;--> statement-breakpoint
ALTER TABLE "signed_contracts" ADD CONSTRAINT "signed_contracts_countersigned_media_id_media_id_fk" FOREIGN KEY ("countersigned_media_id") REFERENCES "public"."media"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signed_contracts" ADD CONSTRAINT "signed_contracts_countersigned_by_users_id_fk" FOREIGN KEY ("countersigned_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;