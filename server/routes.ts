import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertEditSchema } from "@shared/schema";
import { analyzeImage, generateImageWithStrength } from "./openai";
import { ImageStorage } from "./image-storage";
import path from "path";
import { z } from "zod";

const executeSchema = z.object({
  image_id: z.string(),
  steps: z.array(z.object({
    op: z.string(),
    params: z.object({
      prompt: z.string(),
      effect_strength: z.number().min(0).max(1)
    })
  })),
  keep_size_of: z.string()
});

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Serve images by ID
  app.get("/api/data/:id.png", async (req, res) => {
    try {
      const id = req.params.id;
      const imagePath = ImageStorage.getImagePath(id);
      
      if (!imagePath) {
        return res.status(404).json({ message: "Image not found" });
      }
      
      res.sendFile(imagePath);
    } catch (error) {
      console.error("Error serving image:", error);
      res.status(500).json({ message: "Failed to load image" });
    }
  });
  
  // Upload image and create edit record
  app.post("/api/upload", async (req, res) => {
    try {
      const { imageData } = req.body;
      
      if (!imageData) {
        return res.status(400).json({ message: "No image data provided" });
      }
      
      // Save image and get metadata
      const imageMetadata = await ImageStorage.saveImage(imageData);
      
      // Perform AI Analysis
      let analysis = { title: "Untitled Image", suggestions: [] as string[] };
      try {
        analysis = await analyzeImage(imageData);
      } catch (e) {
        console.error("Analysis failed", e);
        // Fallback to defaults if analysis fails, don't block upload
      }

      const edit = await storage.createEdit({
        originalImageId: imageMetadata.id,
        currentImageId: imageMetadata.id, // Initially same as original
        width: imageMetadata.width,
        height: imageMetadata.height,
        prompt: "", // Will be set when user generates
        title: analysis.title,
        suggestions: analysis.suggestions,
        status: "pending",
        effectStrength: 50
      });
      
      res.json(edit);
    } catch (error) {
      console.error("Upload error:", error);
      res.status(400).json({ message: "Invalid input" });
    }
  });

  // Execute AI edit with effect strength
  app.post("/api/execute", async (req, res) => {
    try {
      const data = executeSchema.parse(req.body);
      const { image_id, steps, keep_size_of } = data;
      
      if (steps.length === 0) {
        return res.status(400).json({ message: "No steps provided" });
      }
      
      const step = steps[0]; // Process first step for MVP
      const { prompt, effect_strength } = step.params;
      
      // Load source image
      const sourceImageData = ImageStorage.loadImage(image_id);
      if (!sourceImageData) {
        return res.status(404).json({ message: "Source image not found" });
      }
      
      // Get target dimensions from keep_size_of image (without saving)
      const targetImageData = ImageStorage.loadImage(keep_size_of);
      if (!targetImageData) {
        return res.status(404).json({ message: "Target size image not found" });
      }
      
      const { width: targetWidth, height: targetHeight } = await ImageStorage.getImageDimensionsFromBase64(targetImageData);
      
      // Generate edited image
      const { imageUrl: editedImageData, refinedPrompt } = await generateImageWithStrength(
        prompt,
        sourceImageData,
        effect_strength,
        targetWidth,
        targetHeight
      );
      
      // Save generated image
      const generatedMeta = await ImageStorage.saveImage(editedImageData);
      
      res.json({
        image_id: generatedMeta.id,
        width: generatedMeta.width,
        height: generatedMeta.height,
        preview_url: `/api/data/${generatedMeta.id}.png`,
        refined_prompt: refinedPrompt
      });
      
    } catch (error) {
      console.error("Execute error:", error);
      res.status(500).json({ message: "Failed to execute edit" });
    }
  });

  // Get edit history
  app.get("/api/history", async (req, res) => {
    const edits = await storage.getEdits();
    res.json(edits);
  });

  // Get specific edit
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

  // Update edit title
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

  // Delete edit
  app.delete("/api/edits/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }

    try {
      // Get edit to find associated images
      const edit = await storage.getEdit(id);
      if (!edit) {
        return res.status(404).json({ message: "Edit not found" });
      }

      // Delete associated image files
      const imageIds = new Set<string>();
      if (edit.originalImageId) imageIds.add(edit.originalImageId);
      if (edit.currentImageId && edit.currentImageId !== edit.originalImageId) {
        imageIds.add(edit.currentImageId);
      }

      // Delete all associated image files - fail the whole operation if any deletion fails
      const failedDeletes: string[] = [];
      for (const imageId of Array.from(imageIds)) {
        const deleted = ImageStorage.deleteImage(imageId);
        if (!deleted) {
          failedDeletes.push(imageId);
        }
      }

      if (failedDeletes.length > 0) {
        console.error(`Failed to delete images: ${failedDeletes.join(", ")}`);
        return res.status(500).json({ 
          message: "Failed to delete some image files",
          failedImages: failedDeletes
        });
      }

      // Delete the edit record from database only if all files deleted successfully
      await storage.deleteEdit(id);
      res.json({ message: "Deleted successfully" });
    } catch (error) {
      console.error("Delete error:", error);
      res.status(500).json({ message: "Failed to delete" });
    }
  });

  // Generate AI edit (wrapper around execute for compatibility)
  app.post("/api/generate/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }
    
    const { prompt, refineFromCurrent, effectStrength } = req.body;
    if (!prompt) return res.status(400).json({ message: "Prompt is required" });

    const edit = await storage.getEdit(id);
    if (!edit) return res.status(404).json({ message: "Edit not found" });

    // Start async processing
    const strength = (effectStrength !== undefined ? effectStrength : 50) / 100; // Convert 0-100 to 0-1
    console.log(`[Generate] Starting generation for edit ${id} with prompt: "${prompt}", strength: ${strength}`);
    
    (async () => {
      try {
        console.log(`[Generate] Calling /api/execute for edit ${id}...`);
        
        // Determine source image ID
        const sourceId = refineFromCurrent ? edit.currentImageId : edit.originalImageId;
        
        // Call execute endpoint internally
        const sourceImageData = ImageStorage.loadImage(sourceId);
        if (!sourceImageData) {
          throw new Error("Source image not found");
        }
        
        const { imageUrl: editedImageData, refinedPrompt } = await generateImageWithStrength(
          prompt,
          sourceImageData,
          strength,
          edit.width,
          edit.height
        );
        
        const generatedMeta = await ImageStorage.saveImage(editedImageData);
        
        console.log(`[Generate] Success for edit ${id}. Updating DB...`);
        await storage.updateEditResult(id, generatedMeta.id, "completed", prompt, refinedPrompt, Math.round(strength * 100));
        console.log(`[Generate] DB updated for edit ${id} to completed.`);
      } catch (e) {
        console.error(`[Generate] Failed for edit ${id}:`, e);
        await storage.updateEditResult(id, edit.currentImageId, "failed");
        console.log(`[Generate] DB updated for edit ${id} to failed.`);
      }
    })();

    res.json({ message: "Processing started" });
  });

  // Get AI suggestions for an edit
  app.get("/api/suggestions/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }

    const edit = await storage.getEdit(id);
    if (!edit) return res.status(404).json({ message: "Edit not found" });

    try {
      // Load current image for analysis
      const imageData = ImageStorage.loadImage(edit.currentImageId);
      if (!imageData) {
        throw new Error("Image not found");
      }
      
      // Generate AI suggestions based on the current image
      const suggestions = await analyzeImage(imageData);
      res.json({ suggestions: suggestions.suggestions });
    } catch (error) {
      console.error("Suggestions generation failed:", error);
      // Return fallback suggestions if AI fails
      res.json({
        suggestions: [
          "Enhance lighting and contrast",
          "Add subtle background blur",
          "Apply vintage film effect",
          "Increase color saturation",
          "Add dramatic vignette"
        ]
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
