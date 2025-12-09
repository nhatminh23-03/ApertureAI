CREATE TABLE "strength_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"edit_id" integer NOT NULL,
	"strength" integer NOT NULL,
	"image_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
