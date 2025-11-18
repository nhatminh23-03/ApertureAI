import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const edits = pgTable("edits", {
  id: serial("id").primaryKey(),
  imageUrl: text("image_url").notNull(), // Original Image (Base64 or URL)
  generatedImageUrl: text("generated_image_url"), // Edited Image
  prompt: text("prompt").notNull(), // User's edit prompt
  refinedPrompt: text("refined_prompt"), // AI generated prompt for DALL-E
  title: text("title").default("Untitled Draft"),
  suggestions: text("suggestions").array(),
  status: text("status").notNull().default("pending"), // pending, completed, failed
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Manually define the insert schema to ensure full control over optional fields
export const insertEditSchema = z.object({
  imageUrl: z.string(),
  prompt: z.string(),
  title: z.string().optional(),
  suggestions: z.array(z.string()).optional(),
  status: z.string().optional(),
});

export type InsertEdit = z.infer<typeof insertEditSchema>;
export type Edit = typeof edits.$inferSelect;
