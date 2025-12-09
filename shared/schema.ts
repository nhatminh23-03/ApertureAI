import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password"),
  googleId: text("google_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const edits = pgTable("edits", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id), // Link edit to user
  originalImageId: text("original_image_id").notNull(), // ID of the first uploaded image
  currentImageId: text("current_image_id").notNull(), // ID of the latest edited version (or original if no edits)
  width: integer("width").notNull(), // Original image width
  height: integer("height").notNull(), // Original image height
  prompt: text("prompt").notNull(), // User's edit prompt
  refinedPrompt: text("refined_prompt"), // AI generated prompt for DALL-E
  effectStrength: integer("effect_strength").default(50), // 0-100, controls edit intensity
  title: text("title").default("Untitled Draft"),
  suggestions: text("suggestions").array(),
  naturalSuggestionsJson: text("natural_suggestions_json"), // Cached natural suggestions with Sharp params as JSON
  originalMimeType: text("original_mime_type").default("image/jpeg"), // Original file format (image/jpeg, image/png, etc.)
  status: text("status").notNull().default("pending"), // pending, completed, failed
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Cache table to store generated images by strength level
export const strengthCache = pgTable("strength_cache", {
  id: serial("id").primaryKey(),
  editId: integer("edit_id").notNull(), // Reference to the edit
  strength: integer("strength").notNull(), // 0-100
  imageId: text("image_id").notNull(), // The generated image ID for this strength
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Cache table to store AI suggestions per image (avoids re-analyzing same image)
export const suggestionsCache = pgTable("suggestions_cache", {
  id: serial("id").primaryKey(),
  imageId: text("image_id").notNull().unique(), // The image that was analyzed
  naturalSuggestionsJson: text("natural_suggestions_json").notNull(), // JSON array of { label, params }
  aiSuggestionsJson: text("ai_suggestions_json").notNull(), // JSON array of strings
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Cache table to store Natural Edit history (similar to strength_cache for AI Remix)
export const editHistory = pgTable("edit_history", {
  id: serial("id").primaryKey(),
  editId: integer("edit_id").notNull(), // Reference to the edit
  imageId: text("image_id").notNull(), // The generated image ID for this edit step
  effectStrength: integer("effect_strength").notNull(), // 0-100
  params: text("params"), // JSON string of Sharp parameters applied
  sequence: integer("sequence").notNull(), // Order of edits (1, 2, 3, ...)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Manually define the insert schema to ensure full control over optional fields
export const insertEditSchema = z.object({
  userId: z.number().optional(),
  originalImageId: z.string(),
  currentImageId: z.string(),
  width: z.number(),
  height: z.number(),
  prompt: z.string(),
  title: z.string().optional(),
  suggestions: z.array(z.string()).optional(),
  naturalSuggestionsJson: z.string().optional(),
  originalMimeType: z.string().optional(),
  status: z.string().optional(),
  effectStrength: z.number().optional(),
});

export const insertStrengthCacheSchema = z.object({
  editId: z.number(),
  strength: z.number().min(0).max(100),
  imageId: z.string(),
});

export const insertEditHistorySchema = z.object({
  editId: z.number(),
  imageId: z.string(),
  effectStrength: z.number().min(0).max(100),
  params: z.string().optional(),
  sequence: z.number(),
});

export const insertUserSchema = createInsertSchema(users).omit({ 
  id: true, 
  createdAt: true 
});

export type InsertEdit = z.infer<typeof insertEditSchema>;
export type Edit = typeof edits.$inferSelect;
export type InsertStrengthCache = z.infer<typeof insertStrengthCacheSchema>;
export type StrengthCache = typeof strengthCache.$inferSelect;
export type InsertEditHistory = z.infer<typeof insertEditHistorySchema>;
export type EditHistory = typeof editHistory.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
