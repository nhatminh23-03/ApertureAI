CREATE TABLE "suggestions_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"image_id" text NOT NULL,
	"natural_suggestions_json" text NOT NULL,
	"ai_suggestions_json" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "suggestions_cache_image_id_unique" UNIQUE("image_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "edits" ADD COLUMN "user_id" integer;--> statement-breakpoint
ALTER TABLE "edits" ADD CONSTRAINT "edits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;