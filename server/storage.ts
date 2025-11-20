import { type Edit, type InsertEdit, edits } from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  createEdit(edit: InsertEdit): Promise<Edit>;
  getEdit(id: number): Promise<Edit | undefined>;
  getEdits(): Promise<Edit[]>;
  updateEditResult(id: number, currentImageId: string, status: string, prompt?: string, refinedPrompt?: string, effectStrength?: number): Promise<Edit | undefined>;
  updateEditTitle(id: number, title: string): Promise<Edit | undefined>;
  deleteEdit(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async createEdit(insertEdit: InsertEdit): Promise<Edit> {
    const [edit] = await db
      .insert(edits)
      .values(insertEdit)
      .returning();
    return edit;
  }

  async getEdit(id: number): Promise<Edit | undefined> {
    const [edit] = await db.select().from(edits).where(eq(edits.id, id));
    return edit;
  }

  async getEdits(): Promise<Edit[]> {
    return await db.select().from(edits).orderBy(desc(edits.createdAt));
  }

  async updateEditResult(id: number, currentImageId: string, status: string, prompt?: string, refinedPrompt?: string, effectStrength?: number): Promise<Edit | undefined> {
    const updateData: Partial<Edit> = { status, currentImageId };
    if (prompt !== undefined) updateData.prompt = prompt;
    if (refinedPrompt !== undefined) updateData.refinedPrompt = refinedPrompt;
    if (effectStrength !== undefined) updateData.effectStrength = effectStrength;
    
    const [edit] = await db
      .update(edits)
      .set(updateData)
      .where(eq(edits.id, id))
      .returning();
    return edit;
  }

  async updateEditTitle(id: number, title: string): Promise<Edit | undefined> {
    const [edit] = await db
      .update(edits)
      .set({ title })
      .where(eq(edits.id, id))
      .returning();
    return edit;
  }

  async deleteEdit(id: number): Promise<void> {
    await db.delete(edits).where(eq(edits.id, id));
  }
}

export const storage = new DatabaseStorage();
