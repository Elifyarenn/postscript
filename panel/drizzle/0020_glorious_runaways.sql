CREATE TABLE "pending_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" text NOT NULL,
	"birth_date" date NOT NULL,
	"kvkk_consent_version" integer NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "pending_registrations_token_hash_unique" ON "pending_registrations" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "pending_registrations_email_idx" ON "pending_registrations" USING btree ("email");--> statement-breakpoint
CREATE INDEX "pending_registrations_expires_at_idx" ON "pending_registrations" USING btree ("expires_at");