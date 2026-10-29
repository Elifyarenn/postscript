ALTER TABLE "illustrations" ADD COLUMN "area_id" uuid;--> statement-breakpoint
ALTER TABLE "illustrations" ADD CONSTRAINT "illustrations_area_id_writer_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."writer_areas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "illustrations_area_idx" ON "illustrations" USING btree ("area_id");