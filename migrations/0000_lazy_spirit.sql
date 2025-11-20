CREATE TABLE "edits" (
	"id" serial PRIMARY KEY NOT NULL,
	"original_image_id" text NOT NULL,
	"current_image_id" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"prompt" text NOT NULL,
	"refined_prompt" text,
	"effect_strength" integer DEFAULT 50,
	"title" text DEFAULT 'Untitled Draft',
	"suggestions" text[],
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
