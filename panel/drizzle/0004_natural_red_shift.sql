DROP TABLE "totp_recovery_codes" CASCADE;--> statement-breakpoint
ALTER TABLE "sessions" DROP COLUMN "totp_verified_at";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "totp_secret";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "totp_confirmed_at";