CREATE TYPE "public"."editor_status" AS ENUM('active', 'suspended');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "editor_status" "editor_status";