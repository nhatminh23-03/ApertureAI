import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertEditSchema } from "@shared/schema";
import { analyzeImage, generateImage } from "./openai";

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/upload", async (req, res) => {
    try {
      const data = insertEditSchema.parse(req.body);
      
      // Perform AI Analysis
      let analysis = { title: "Untitled Image", suggestions: [] as string[] };
      try {
         analysis = await analyzeImage(data.imageUrl);
      } catch (e) {
        console.error("Analysis failed", e);
        // Fallback to defaults if analysis fails, don't block upload
      }

      const edit = await storage.createEdit({
        ...data,
        title: analysis.title,
        suggestions: analysis.suggestions,
        status: "pending"
      });
      
      res.json(edit);
    } catch (error) {
      console.error(error);
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.get("/api/history", async (req, res) => {
    const edits = await storage.getEdits();
    res.json(edits);
  });

  app.get("/api/edits/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }
    
    const edit = await storage.getEdit(id);
    if (!edit) {
      return res.status(404).json({ message: "Edit not found" });
    }
    
    res.json(edit);
  });

  app.patch("/api/edits/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }
    
    const { title } = req.body;
    if (!title || title.trim() === "") {
      return res.status(400).json({ message: "Title is required" });
    }

    try {
      const edit = await storage.updateEditTitle(id, title);
      if (!edit) return res.status(404).json({ message: "Edit not found" });
      res.json(edit);
    } catch (error) {
       res.status(500).json({ message: "Failed to update" });
    }
  });

  app.delete("/api/edits/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }

    try {
      await storage.deleteEdit(id);
      res.json({ message: "Deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete" });
    }
  });

  app.post("/api/generate/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }
    
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ message: "Prompt is required" });

    const edit = await storage.getEdit(id);
    if (!edit) return res.status(404).json({ message: "Edit not found" });

    // Start async processing
    console.log(`[Generate] Starting generation for edit ${id} with prompt: "${prompt}"`);
    (async () => {
      try {
        console.log(`[Generate] Calling OpenAI for edit ${id}...`);
        const { imageUrl: newImageUrl, refinedPrompt } = await generateImage(prompt, edit.imageUrl);
        console.log(`[Generate] Success for edit ${id}. Updating DB...`);
        await storage.updateEditStatus(id, "completed", newImageUrl, prompt, refinedPrompt);
        console.log(`[Generate] DB updated for edit ${id} to completed.`);
      } catch (e) {
        console.error(`[Generate] Failed for edit ${id}:`, e);
        await storage.updateEditStatus(id, "failed");
        console.log(`[Generate] DB updated for edit ${id} to failed.`);
      }
    })();

    res.json({ message: "Processing started" });
  });

  const httpServer = createServer(app);
  return httpServer;
}
