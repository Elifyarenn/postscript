CREATE TABLE "team_avatars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"team_role" text NOT NULL,
	"config" jsonb NOT NULL,
	"config_version" integer NOT NULL,
	"png_storage_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "team_avatars" ADD CONSTRAINT "team_avatars_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "team_avatars_user_unique" ON "team_avatars" USING btree ("user_id");