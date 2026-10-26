CREATE TYPE "public"."writer_application_engagement" AS ENUM('long_term', 'one_time');--> statement-breakpoint
ALTER TABLE "writer_applications" ADD COLUMN "engagement" "writer_application_engagement";--> statement-breakpoint
ALTER TABLE "writer_applications" ADD COLUMN "interest_areas" text[];--> statement-breakpoint
ALTER TABLE "writer_applications" ADD COLUMN "has_experience" boolean;--> statement-breakpoint
ALTER TABLE "writer_applications" ADD COLUMN "experience" text;