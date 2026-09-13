CREATE TABLE "traffic_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "traffic_logs" ADD CONSTRAINT "traffic_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "traffic_logs_created_idx" ON "traffic_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "traffic_logs_entity_idx" ON "traffic_logs" USING btree ("entity_type","entity_id");