import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const edits = pgTable("edits", {
  id: serial("id").primaryKey(),
  imageUrl: text("image_url").notNull(),
  prompt: text("prompt").notNull(),
  status: text("status").notNull().default("pending"), // pending, completed
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertEditSchema = createInsertSchema(edits).pick({
  imageUrl: true,
  prompt: true,
  status: true,
});

export type InsertEdit = z.infer<typeof insertEditSchema>;
export type Edit = typeof edits.$inferSelect;
