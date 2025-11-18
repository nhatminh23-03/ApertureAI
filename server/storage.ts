import { type Edit, type InsertEdit, edits } from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  createEdit(edit: InsertEdit): Promise<Edit>;
  getEdit(id: number): Promise<Edit | undefined>;
  getEdits(): Promise<Edit[]>;
  updateEditStatus(id: number, status: string): Promise<Edit | undefined>;
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

  async updateEditStatus(id: number, status: string): Promise<Edit | undefined> {
    const [edit] = await db
      .update(edits)
      .set({ status })
      .where(eq(edits.id, id))
      .returning();
    return edit;
  }
}

export const storage = new DatabaseStorage();
