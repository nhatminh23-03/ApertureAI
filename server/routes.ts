import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertEditSchema } from "@shared/schema";
import { analyzeImage, generateImageWithStrength, applySharpParams, analyzePromptToSharpParams, type SharpParams } from "./openai";
import { ImageStorage } from "./image-storage";
import { setupAuth } from "./auth";
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
  setupAuth(app);
  
  // Serve images by ID (supports multiple formats: .png, .jpg, .webp, etc.)
  app.get("/api/data/:id.:ext", async (req, res) => {
    try {
      const id = req.params.id;
      const ext = req.params.ext.toLowerCase();
      
      // This now handles both local and S3 files
      await ImageStorage.serveImage(res, id, ext);
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
      let analysis = { 
        title: "Uploaded Image", 
        naturalSuggestions: [
          { label: "add brightness", params: { brightness: 15, contrast: 0, saturation: 0, hue: 0, sharpen: 0, noise: 0 } },
          { label: "increase contrast", params: { brightness: 0, contrast: 20, saturation: 0, hue: 0, sharpen: 0, noise: 0 } },
          { label: "balance color", params: { brightness: 0, contrast: 0, saturation: 10, hue: 0, sharpen: 0, noise: 0 } },
          { label: "reduce noise", params: { brightness: 0, contrast: 0, saturation: 0, hue: 0, sharpen: 0, noise: 5 } },
          { label: "sharpen slightly", params: { brightness: 0, contrast: 0, saturation: 0, hue: 0, sharpen: 2, noise: 0 } }
        ],
        aiSuggestions: ["golden hour relight", "cinematic teal-orange", "dramatic sky", "soft portrait glow", "moody film look"]
      };
      try {
        analysis = await analyzeImage(imageData);
      } catch (e) {
        console.error("Analysis failed", e);
        // Fallback to defaults if analysis fails, don't block upload
      }

      // Extract suggestion labels for storage
      const naturalLabels = analysis.naturalSuggestions.map(s => s.label);
      
      const edit = await storage.createEdit({
        originalImageId: imageMetadata.id,
        currentImageId: imageMetadata.id, // Initially same as original
        width: imageMetadata.width,
        height: imageMetadata.height,
        prompt: "", // Will be set when user generates
        title: analysis.title,
        suggestions: [...naturalLabels, ...analysis.aiSuggestions],
        naturalSuggestionsJson: JSON.stringify(analysis.naturalSuggestions),
        originalMimeType: imageMetadata.mimeType, // Store original format for download
        status: "pending",
        effectStrength: 50,
        userId: req.user ? (req.user as any).id : undefined // Link to user if logged in
      });
      
      // Store natural suggestions with parameters for quick access
      (edit as any).naturalSuggestionsWithParams = analysis.naturalSuggestions;
      
      res.json(edit);
    } catch (error) {
      console.error("Upload error:", error);
      res.status(400).json({ message: "Invalid input" });
    }
  });

  // Claim an edit (link to user account)
  app.post("/api/edits/:id/claim", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ID" });
      }

      const edit = await storage.getEdit(id);
      if (!edit) {
        return res.status(404).json({ message: "Edit not found" });
      }

      // If edit is already owned by someone else
      if (edit.userId && edit.userId !== (req.user as any).id) {
        return res.status(403).json({ message: "Edit already owned by another user" });
      }

      // Update the edit with the current user's ID
      await storage.updateEdit(id, { userId: (req.user as any).id });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error claiming edit:", error);
      res.status(500).json({ message: "Failed to claim edit" });
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
      const sourceImageData = await ImageStorage.loadImage(image_id);
      if (!sourceImageData) {
        return res.status(404).json({ message: "Source image not found" });
      }
      
      // Get target dimensions from keep_size_of image (without saving)
      const targetImageData = await ImageStorage.loadImage(keep_size_of);
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

  // Natural Edit endpoint - applies Sharp parameters to image
  // Supports two modes:
  // 1) Direct params: { params: SharpParams }
  // 2) Prompt-driven: { prompt: string, selectedLabels?: string[] } -> AI infers SharpParams
  app.post("/api/natural-edit/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ID" });
      }

      const { params, suggestionLabel, prompt, selectedLabels, refineFromCurrent, strengthPercent } = req.body as {
        params?: SharpParams;
        suggestionLabel?: string;
        prompt?: string;
        selectedLabels?: string[];
        refineFromCurrent?: boolean;
        strengthPercent?: number;
      };
      
      console.log("[NaturalEdit] Received request for edit", id);
      if (params) {
        console.log("[NaturalEdit] Params:", JSON.stringify(params));
      }
      if (prompt) {
        console.log("[NaturalEdit] Prompt:", prompt);
        console.log("[NaturalEdit] Selected labels:", selectedLabels);
      }
      console.log("[NaturalEdit] Label:", suggestionLabel);
      console.log("[NaturalEdit] refineFromCurrent:", refineFromCurrent);
      
      if (!params && (!prompt || !prompt.trim())) {
        return res.status(400).json({ message: "Either Sharp parameters or prompt is required" });
      }

      // Get the edit
      const edit = await storage.getEdit(id);
      if (!edit) {
        return res.status(404).json({ message: "Edit not found" });
      }

      // Choose source image based on refineFromCurrent flag
      // - When false/undefined: use the original upload as the baseline
      // - When true: use the current edited image (AI Remix or previous Natural Edit)
      const sourceImageId = refineFromCurrent ? edit.currentImageId : edit.originalImageId;
      const sourceImageData = await ImageStorage.loadImage(sourceImageId);
      if (!sourceImageData) {
        return res.status(404).json({ message: "Source image not found" });
      }

      // Determine final Sharp parameters
      let finalParams: SharpParams;
      if (params) {
        finalParams = params;
      } else {
        finalParams = await analyzePromptToSharpParams(
          sourceImageData,
          prompt!.trim(),
          selectedLabels
        );
      }

      // Create a cache key from params and strength
      const paramsKey = JSON.stringify(finalParams);
      const effectiveStrength = strengthPercent ?? 100;
      
      // Check cache for existing result with same params and strength
      const cachedResult = await storage.getCachedNaturalEdit(id, paramsKey, effectiveStrength);
      if (cachedResult) {
        console.log(`[NaturalEdit] Cache HIT for edit ${id} with strength ${effectiveStrength}`);
        
        // Update the edit record to use the cached image
        await storage.updateEditResult(
          id,
          cachedResult.imageId,
          "completed",
          suggestionLabel || (prompt ? `Natural edit: ${prompt}` : "Natural edit"),
          "",
          effectiveStrength
        );
        
        res.json({
          image_id: cachedResult.imageId,
          width: edit.width,
          height: edit.height,
          preview_url: `/api/data/${cachedResult.imageId}.png`,
          params: finalParams,
          cached: true
        });
        return;
      }
      
      console.log(`[NaturalEdit] Cache MISS for edit ${id}, processing...`);

      // Apply Sharp parameters
      const editedImageData = await applySharpParams(
        sourceImageData,
        finalParams,
        edit.width,
        edit.height
      );

      // Save the edited image
      const editedMeta = await ImageStorage.saveImage(editedImageData);

      // Save to edit history cache
      const nextSequence = await storage.getNextSequence(id);
      await storage.saveNaturalEditHistory({
        editId: id,
        imageId: editedMeta.id,
        effectStrength: effectiveStrength,
        params: paramsKey,
        sequence: nextSequence,
      });
      console.log(`[NaturalEdit] Cached result for edit ${id} at sequence ${nextSequence}`);

      // Update the edit record
      await storage.updateEditResult(
        id,
        editedMeta.id,
        "completed",
        suggestionLabel || (prompt ? `Natural edit: ${prompt}` : "Natural edit"),
        "",
        effectiveStrength
      );

      res.json({
        image_id: editedMeta.id,
        width: editedMeta.width,
        height: editedMeta.height,
        preview_url: `/api/data/${editedMeta.id}.png`,
        params: finalParams
      });
    } catch (error) {
      console.error("Natural edit error:", error);
      res.status(500).json({ message: "Failed to apply natural edit" });
    }
  });

  // Get edit history
  app.get("/api/history", async (req, res) => {
    const userId = req.user ? (req.user as any).id : undefined;
    const edits = await storage.getEdits(userId);
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
    
    // Use cached natural suggestions if available
    if ((edit as any).naturalSuggestionsJson) {
      try {
        (edit as any).naturalSuggestionsWithParams = JSON.parse((edit as any).naturalSuggestionsJson);
      } catch (error) {
        console.error("Failed to parse cached natural suggestions:", error);
      }
    }
    
    // Prevent caching so polling always gets fresh data
    res.set("Cache-Control", "no-cache, no-store, must-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
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

      // Get all cached images for this edit (AI Remix strength cache)
      const cachedImages = await storage.getStrengthCacheForEdit(id);
      
      // Get all edit history images (Natural Edit cache)
      const editHistoryImages = await storage.getEditHistoryForEdit(id);
      
      // Collect all image IDs to delete (original, current, and all cached versions)
      const imageIds = new Set<string>();
      if (edit.originalImageId) imageIds.add(edit.originalImageId);
      if (edit.currentImageId && edit.currentImageId !== edit.originalImageId) {
        imageIds.add(edit.currentImageId);
      }
      // Add all AI Remix cached image IDs
      for (const cache of cachedImages) {
        imageIds.add(cache.imageId);
      }
      // Add all Natural Edit history image IDs
      for (const history of editHistoryImages) {
        imageIds.add(history.imageId);
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

      // Delete strength cache entries for this edit (AI Remix)
      await storage.deleteStrengthCacheForEdit(id);
      
      // Delete edit history entries for this edit (Natural Edit)
      await storage.deleteEditHistoryForEdit(id);
      
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
    
    const { prompt, refineFromCurrent, effectStrength, clearCache } = req.body;
    if (!prompt) return res.status(400).json({ message: "Prompt is required" });

    const edit = await storage.getEdit(id);
    if (!edit) return res.status(404).json({ message: "Edit not found" });

    // Clear cache if explicitly requested (new generation) or if the prompt has changed.
    // This prevents stale cache hits when the user changes their idea but happens to use the same strength.
    if (clearCache === true || (prompt && prompt !== edit.prompt)) {
      console.log(`[Generate] Cache cleared for edit ${id} (clearCache=${clearCache}, prompt changed=${prompt !== edit.prompt})`);
      await storage.deleteStrengthCacheForEdit(id);
    }

    // Start async processing
    const strengthPercent = effectStrength !== undefined ? effectStrength : 50;
    const strength = strengthPercent / 100; // Convert 0-100 to 0-1
    console.log(`[Generate] Starting generation for edit ${id} with prompt: "${prompt}", strength: ${strength}`);
    
    // Update status to processing immediately so frontend knows work is happening
    await storage.updateEditResult(id, edit.currentImageId, "processing", prompt, edit.refinedPrompt || undefined, strengthPercent);
    
    (async () => {
      try {
        // Check if we already have a cached image for this strength
        const cached = await storage.getCachedImageForStrength(id, strengthPercent);
        if (cached) {
          console.log(`[Generate] Found cached image for edit ${id} at strength ${strengthPercent}%`);
          // Use the existing refined prompt from the edit
          const refinedPromptToUse = edit.refinedPrompt || prompt;
          await storage.updateEditResult(id, cached.imageId, "completed", prompt, refinedPromptToUse, strengthPercent);
          console.log(`[Generate] DB updated for edit ${id} to completed (from cache).`);
          return;
        }

        console.log(`[Generate] Calling /api/execute for edit ${id}...`);
        
        // Determine source image ID
        const sourceId = refineFromCurrent ? edit.currentImageId : edit.originalImageId;
        
        // Call execute endpoint internally
        let sourceImageData = await ImageStorage.loadImage(sourceId);
        if (!sourceImageData) {
          throw new Error("Source image not found");
        }
        
        // Use existing refined prompt if available, otherwise refine the new prompt
        let refinedPromptToUse = edit.refinedPrompt;
        let editedImageData: string;
        
        if (refinedPromptToUse) {
          // Reuse existing refined prompt - just generate with different strength
          console.log(`[Generate] Reusing refined prompt: "${refinedPromptToUse}"`);
          const result = await generateImageWithStrength(
            refinedPromptToUse,
            sourceImageData,
            strength,
            edit.width,
            edit.height
          );
          editedImageData = result.imageUrl;
        } else {
          // First time - refine the prompt
          const result = await generateImageWithStrength(
            prompt,
            sourceImageData,
            strength,
            edit.width,
            edit.height
          );
          editedImageData = result.imageUrl;
          refinedPromptToUse = result.refinedPrompt;
        }
        
        // Clear source image from memory to reduce peak usage
        sourceImageData = "";
        
        const generatedMeta = await ImageStorage.saveImage(editedImageData);
        
        // Clear edited image from memory after saving
        editedImageData = "";
        
        // Save to strength cache
        await storage.saveCachedImage({
          editId: id,
          strength: strengthPercent,
          imageId: generatedMeta.id
        });
        
        console.log(`[Generate] Success for edit ${id}. Updating DB...`);
        await storage.updateEditResult(id, generatedMeta.id, "completed", prompt, refinedPromptToUse, strengthPercent);
        console.log(`[Generate] DB updated for edit ${id} to completed.`);
        
        // Hint garbage collection
        if (global.gc) {
          global.gc();
        }
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
      const imageId = edit.currentImageId;
      
      // Check cache first - instant response if cached
      const cached = await storage.getCachedSuggestions(imageId);
      if (cached) {
        console.log(`[Suggestions] Cache HIT for image ${imageId}`);
        res.json({ 
          suggestions: cached.aiSuggestions,
          aiSuggestions: cached.aiSuggestions,
          naturalSuggestions: cached.naturalSuggestions,
        });
        return;
      }
      
      console.log(`[Suggestions] Cache MISS for image ${imageId}, analyzing...`);
      
      // Load current image for analysis
      const imageData = await ImageStorage.loadImage(imageId);
      if (!imageData) {
        throw new Error("Image not found");
      }
      
      // Generate AI + Natural suggestions based on the current image
      const analysis = await analyzeImage(imageData);

      // Normalize AI remix suggestions into a flat string array
      const aiSuggestions = (analysis as any).aiSuggestions
        ? (analysis as any).aiSuggestions.map((s: any) =>
            typeof s === "string" ? s : (s.title || s.label || "")
          ).filter((s: string) => !!s)
        : [];

      // Natural, Sharp-compatible suggestions (label + params) come through as-is
      const naturalSuggestions = (analysis as any).naturalSuggestions || [];

      // Save to cache for future requests
      await storage.saveCachedSuggestions(imageId, { naturalSuggestions, aiSuggestions });
      console.log(`[Suggestions] Cached suggestions for image ${imageId}`);

      res.json({ 
        // Backwards compatible field name used by existing frontend
        suggestions: aiSuggestions,
        // Explicit fields for richer UI
        aiSuggestions,
        naturalSuggestions,
      });
    } catch (error) {
      console.error("Suggestions generation failed:", error);
      // Fallback: only generic AI remix suggestions, no natural Sharp params
      const fallback = [
        "golden hour relight",
        "cinematic teal-orange",
        "dramatic sky",
        "soft portrait glow",
        "moody film look"
      ];
      res.json({
        suggestions: fallback,
        aiSuggestions: fallback,
        naturalSuggestions: []
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
