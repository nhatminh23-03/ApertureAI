-- Add suggestions_cache table to cache AI analysis results per image
-- This dramatically speeds up repeated requests for the same image
CREATE TABLE "suggestions_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"image_id" text NOT NULL UNIQUE,
	"natural_suggestions_json" text NOT NULL,
	"ai_suggestions_json" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Create index for fast lookups by image_id
CREATE INDEX "suggestions_cache_image_id_idx" ON "suggestions_cache" ("image_id");
