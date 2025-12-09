CREATE TABLE "edit_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"edit_id" integer NOT NULL,
	"image_id" text NOT NULL,
	"effect_strength" integer NOT NULL,
	"params" text,
	"sequence" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "edits" ADD COLUMN "natural_suggestions_json" text;--> statement-breakpoint
ALTER TABLE "edits" ADD COLUMN "original_mime_type" text DEFAULT 'image/jpeg';