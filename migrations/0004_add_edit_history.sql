-- Add edit_history table to track undo/redo for each edit
CREATE TABLE "edit_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"edit_id" integer NOT NULL,
	"image_id" text NOT NULL,
	"effect_strength" integer NOT NULL,
	"params" text, -- JSON string of Sharp parameters applied
	"sequence" integer NOT NULL, -- Order of edits (1, 2, 3, ...)
	"created_at" timestamp DEFAULT now() NOT NULL
);
