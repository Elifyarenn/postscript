DROP TABLE "categories" CASCADE;--> statement-breakpoint
DROP TABLE "writer_lead_categories" CASCADE;--> statement-breakpoint
DROP TABLE "writer_leads" CASCADE;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "writer_intent_at" timestamp with time zone;--> statement-breakpoint
DROP TYPE "public"."lead_status";