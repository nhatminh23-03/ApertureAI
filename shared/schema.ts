import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const edits = pgTable("edits", {
  id: serial("id").primaryKey(),
  originalImageId: text("original_image_id").notNull(), // ID of the first uploaded image
  currentImageId: text("current_image_id").notNull(), // ID of the latest edited version (or original if no edits)
  width: integer("width").notNull(), // Original image width
  height: integer("height").notNull(), // Original image height
  prompt: text("prompt").notNull(), // User's edit prompt
  refinedPrompt: text("refined_prompt"), // AI generated prompt for DALL-E
  effectStrength: integer("effect_strength").default(50), // 0-100, controls edit intensity
  title: text("title").default("Untitled Draft"),
  suggestions: text("suggestions").array(),
  status: text("status").notNull().default("pending"), // pending, completed, failed
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Manually define the insert schema to ensure full control over optional fields
export const insertEditSchema = z.object({
  originalImageId: z.string(),
  currentImageId: z.string(),
  width: z.number(),
  height: z.number(),
  prompt: z.string(),
  title: z.string().optional(),
  suggestions: z.array(z.string()).optional(),
  status: z.string().optional(),
  effectStrength: z.number().optional(),
});

export type InsertEdit = z.infer<typeof insertEditSchema>;
export type Edit = typeof edits.$inferSelect;
