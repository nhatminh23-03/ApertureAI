import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertEditSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/upload", async (req, res) => {
    try {
      const data = insertEditSchema.parse(req.body);
      const edit = await storage.createEdit(data);
      res.json(edit);
    } catch (error) {
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

  // Mock generation endpoint
  app.post("/api/generate/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }

    // Simulate AI processing delay
    setTimeout(async () => {
      await storage.updateEditStatus(id, "completed");
    }, 2000);

    res.json({ message: "Processing started" });
  });

  const httpServer = createServer(app);
  return httpServer;
}
