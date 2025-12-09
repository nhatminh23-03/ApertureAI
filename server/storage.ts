import { type Edit, type InsertEdit, edits, type StrengthCache, type InsertStrengthCache, strengthCache, suggestionsCache, type EditHistory, type InsertEditHistory, editHistory, type User, type InsertUser, users } from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";

// Type for cached suggestions
export type CachedSuggestions = {
  naturalSuggestions: Array<{ label: string; params: any }>;
  aiSuggestions: string[];
};

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined>;
  
  createEdit(edit: InsertEdit): Promise<Edit>;
  getEdit(id: number): Promise<Edit | undefined>;
  getEdits(userId?: number): Promise<Edit[]>;
  updateEdit(id: number, data: Partial<InsertEdit>): Promise<Edit | undefined>;
  updateEditResult(id: number, currentImageId: string, status: string, prompt?: string, refinedPrompt?: string, effectStrength?: number): Promise<Edit | undefined>;
  updateEditTitle(id: number, title: string): Promise<Edit | undefined>;
  deleteEdit(id: number): Promise<void>;
  // Strength cache methods (AI Remix)
  getCachedImageForStrength(editId: number, strength: number): Promise<StrengthCache | undefined>;
  saveCachedImage(cache: InsertStrengthCache): Promise<StrengthCache>;
  deleteStrengthCacheForEdit(editId: number): Promise<void>;
  getStrengthCacheForEdit(editId: number): Promise<StrengthCache[]>;
  // Suggestions cache methods
  getCachedSuggestions(imageId: string): Promise<CachedSuggestions | null>;
  saveCachedSuggestions(imageId: string, suggestions: CachedSuggestions): Promise<void>;
  // Edit history methods (Natural Edit)
  getCachedNaturalEdit(editId: number, params: string, strength: number): Promise<EditHistory | undefined>;
  saveNaturalEditHistory(history: InsertEditHistory): Promise<EditHistory>;
  deleteEditHistoryForEdit(editId: number): Promise<void>;
  getEditHistoryForEdit(editId: number): Promise<EditHistory[]>;
  getNextSequence(editId: number): Promise<number>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return user;
  }

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

  async getEdits(userId?: number): Promise<Edit[]> {
    if (userId) {
      return await db.select().from(edits).where(eq(edits.userId, userId)).orderBy(desc(edits.createdAt));
    }
    // Fallback for guests/compatibility: return all edits that don't have a user
    // or just return all edits? Let's return all edits for now to avoid breaking
    // but really we should only show null userId edits if guest.
    // For admin/debug purposes returning all might be useful, but for security
    // a user should only see their own.
    // Let's assume guest mode is "userId is null".
    
    // return await db.select().from(edits).where(isNull(edits.userId)).orderBy(desc(edits.createdAt));
    // But current frontend doesn't send userId yet. So let's keep existing behavior
    // of returning ALL edits if no userId provided, until we fully migrate frontend.
    return await db.select().from(edits).orderBy(desc(edits.createdAt));
  }

  async updateEdit(id: number, data: Partial<InsertEdit>): Promise<Edit | undefined> {
    const [edit] = await db
      .update(edits)
      .set(data)
      .where(eq(edits.id, id))
      .returning();
    return edit;
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

  async getCachedImageForStrength(editId: number, strength: number): Promise<StrengthCache | undefined> {
    const [cache] = await db
      .select()
      .from(strengthCache)
      .where(and(eq(strengthCache.editId, editId), eq(strengthCache.strength, strength)));
    return cache;
  }

  async saveCachedImage(cache: InsertStrengthCache): Promise<StrengthCache> {
    const [saved] = await db
      .insert(strengthCache)
      .values(cache)
      .returning();
    return saved;
  }

  async deleteStrengthCacheForEdit(editId: number): Promise<void> {
    await db.delete(strengthCache).where(eq(strengthCache.editId, editId));
  }

  async getStrengthCacheForEdit(editId: number): Promise<StrengthCache[]> {
    return await db
      .select()
      .from(strengthCache)
      .where(eq(strengthCache.editId, editId));
  }

  async getCachedSuggestions(imageId: string): Promise<CachedSuggestions | null> {
    try {
      const [cached] = await db
        .select()
        .from(suggestionsCache)
        .where(eq(suggestionsCache.imageId, imageId));
      
      if (!cached) return null;
      
      return {
        naturalSuggestions: JSON.parse(cached.naturalSuggestionsJson),
        aiSuggestions: JSON.parse(cached.aiSuggestionsJson),
      };
    } catch (error) {
      console.error("[SuggestionsCache] Error reading cache:", error);
      return null;
    }
  }

  async saveCachedSuggestions(imageId: string, suggestions: CachedSuggestions): Promise<void> {
    try {
      await db
        .insert(suggestionsCache)
        .values({
          imageId,
          naturalSuggestionsJson: JSON.stringify(suggestions.naturalSuggestions),
          aiSuggestionsJson: JSON.stringify(suggestions.aiSuggestions),
        })
        .onConflictDoUpdate({
          target: suggestionsCache.imageId,
          set: {
            naturalSuggestionsJson: JSON.stringify(suggestions.naturalSuggestions),
            aiSuggestionsJson: JSON.stringify(suggestions.aiSuggestions),
          },
        });
    } catch (error) {
      console.error("[SuggestionsCache] Error saving cache:", error);
    }
  }

  // Edit History methods (Natural Edit caching)
  async getCachedNaturalEdit(editId: number, params: string, strength: number): Promise<EditHistory | undefined> {
    // Find a cached result with matching params and strength
    const [cached] = await db
      .select()
      .from(editHistory)
      .where(
        and(
          eq(editHistory.editId, editId),
          eq(editHistory.params, params),
          eq(editHistory.effectStrength, strength)
        )
      );
    return cached;
  }

  async saveNaturalEditHistory(history: InsertEditHistory): Promise<EditHistory> {
    const [saved] = await db
      .insert(editHistory)
      .values(history)
      .returning();
    return saved;
  }

  async deleteEditHistoryForEdit(editId: number): Promise<void> {
    await db.delete(editHistory).where(eq(editHistory.editId, editId));
  }

  async getEditHistoryForEdit(editId: number): Promise<EditHistory[]> {
    return await db
      .select()
      .from(editHistory)
      .where(eq(editHistory.editId, editId))
      .orderBy(desc(editHistory.sequence));
  }

  async getNextSequence(editId: number): Promise<number> {
    const history = await db
      .select()
      .from(editHistory)
      .where(eq(editHistory.editId, editId))
      .orderBy(desc(editHistory.sequence))
      .limit(1);
    
    return history.length > 0 ? history[0].sequence + 1 : 1;
  }
}

export const storage = new DatabaseStorage();
