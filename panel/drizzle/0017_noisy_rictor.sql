CREATE TABLE "writer_areas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"quota" integer DEFAULT 3 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "writer_areas_name_unique" ON "writer_areas" USING btree ("name");--> statement-breakpoint
CREATE INDEX "writer_areas_active_sort_idx" ON "writer_areas" USING btree ("is_active","sort_order");