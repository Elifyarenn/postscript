CREATE TYPE "public"."zodiac" AS ENUM('aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces');--> statement-breakpoint
ALTER TABLE "team_avatars" ADD COLUMN "motto" text;--> statement-breakpoint
ALTER TABLE "team_avatars" ADD COLUMN "team_byline" "byline_choice";--> statement-breakpoint
ALTER TABLE "team_avatars" ADD COLUMN "zodiac" "zodiac";--> statement-breakpoint
ALTER TABLE "team_avatars" ADD COLUMN "team_form_at" timestamp with time zone;