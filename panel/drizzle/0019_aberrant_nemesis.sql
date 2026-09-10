ALTER TYPE "public"."article_status" ADD VALUE 'category_approved' BEFORE 'revision_requested';--> statement-breakpoint
ALTER TYPE "public"."article_status" ADD VALUE 'admin_review' BEFORE 'revision_requested';--> statement-breakpoint
CREATE TABLE "editor_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"editor_id" uuid NOT NULL,
	"area_id" uuid NOT NULL,
	"slot" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_main_editor" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "editor_categories" ADD CONSTRAINT "editor_categories_editor_id_users_id_fk" FOREIGN KEY ("editor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editor_categories" ADD CONSTRAINT "editor_categories_area_id_writer_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."writer_areas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "editor_categories_area_unique" ON "editor_categories" USING btree ("area_id");--> statement-breakpoint
CREATE UNIQUE INDEX "editor_categories_editor_slot_unique" ON "editor_categories" USING btree ("editor_id","slot");--> statement-breakpoint
CREATE INDEX "editor_categories_editor_idx" ON "editor_categories" USING btree ("editor_id");