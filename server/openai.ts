import OpenAI, { toFile } from "openai";
import fs from "fs";
import path from "path";
import os from "os";
import sharp from "sharp";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
});

// Padding info for square letterboxing
type PadInfo = { S: number; left: number; top: number; width: number; height: number };

// Pad image to square (transparent) before sending to OpenAI
async function padToSquare(buf: Buffer): Promise<{ square: Buffer; pad: PadInfo }> {
  const meta = await sharp(buf).metadata();
  const W = meta.width!, H = meta.height!;
  const S = Math.max(W, H);
  const left = Math.floor((S - W) / 2);
  const top = Math.floor((S - H) / 2);

  const square = await sharp(buf)
    .extend({ 
      top, 
      bottom: S - H - top, 
      left, 
      right: S - W - left, 
      background: { r: 0, g: 0, b: 0, alpha: 0 } 
    })
    .png()
    .toBuffer();

  return { square, pad: { S, left, top, width: W, height: H } };
}

// After OpenAI returns 1024x1024, scale back to S×S and crop out padding
async function unpadFromSquare(returnedSquareB64: string, pad: PadInfo): Promise<Buffer> {
  const squareBuf = Buffer.from(returnedSquareB64, "base64");
  const scaled = await sharp(squareBuf).resize(pad.S, pad.S).toBuffer();
  const cropped = await sharp(scaled)
    .extract({ left: pad.left, top: pad.top, width: pad.width, height: pad.height })
    .toBuffer();
  return cropped; // exact original W×H
}

// Helper to ensure we have base64
export async function ensureBase64(imageUrl: string): Promise<string> {
  if (imageUrl.startsWith("data:image")) {
    return imageUrl;
  }
  
  try {
    const response = await fetch(imageUrl);
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    return `data:${contentType};base64,${base64}`;
  } catch (e) {
    console.error("Failed to convert image to base64", e);
    throw new Error("Failed to process image URL");
  }
}

// Role 1: Vision Analyst - Analyzes the image content
class VisionAnalyst {
  static async analyze(base64Image: string): Promise<{ title: string; suggestions: string[] }> {
    console.log("[VisionAnalyst] Analyzing image...");
    
    // Log the start of the base64 string to debug MIME type issues
    const prefix = base64Image.substring(0, 50);
    console.log(`[VisionAnalyst] Image prefix: ${prefix}...`);

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // Switch to gpt-4o for better vision stability
        messages: [
          {
            role: "system",
            content: `You are a Vision Analyst AI. Analyze the image provided and suggest 4-5 creative edit prompts that a user might want to apply to this image. Also, provide a short, descriptive title for the image.
            
            Output strictly valid JSON:
            {
              "title": "A short descriptive title",
              "suggestions": ["suggestion 1", "suggestion 2", "suggestion 3", "suggestion 4"]
            }`
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Analyze this image." },
              { type: "image_url", image_url: { url: base64Image } }
            ],
          },
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 1024,
      });

      const content = response.choices[0].message.content;
      if (!content) throw new Error("No content in response");
      
      return JSON.parse(content);
    } catch (error) {
      console.error("[VisionAnalyst] Error:", error);
      // Fallback for MVP if Vision fails
      return {
        title: "Uploaded Image",
        suggestions: ["Enhance colors", "Make it cinematic", "Remove background", "Convert to B&W"]
      };
    }
  }
}

// Role 2: Prompt Engineer (Composer) - Writes the detailed DALL-E prompt
class PromptEngineer {
  static async refine(userPrompt: string, base64Image: string): Promise<string> {
    console.log("[PromptEngineer] Refinining prompt...");
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // Switched to gpt-4o for better reliability with vision tasks
      messages: [
        {
          role: "system",
          content: `You are an expert AI Prompt Engineer (Composer). 
          Your task is to look at the provided image and the user's requested edit.
          Then, write a highly detailed, descriptive prompt that describes the scene in the original image BUT with the user's changes applied.
          The goal is to generate a new image that looks like the original but with the specific edits.
          Focus on lighting, style, composition, and subject details.
          
          Output ONLY the raw prompt text, nothing else.`
        },
        {
          role: "user",
          content: [
            { type: "text", text: `User's requested edit: "${userPrompt}"` },
            { type: "image_url", image_url: { url: base64Image } }
          ],
        },
      ],
      max_completion_tokens: 1024,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      console.error("[PromptEngineer] Response content is null/empty:", JSON.stringify(response, null, 2));
      throw new Error("Failed to generate refined prompt");
    }
    
    // Handle potential array response (rare but possible with some models)
    if (Array.isArray(content)) {
      const text = content
        .map(c => (c as any).text || '')
        .join('')
        .trim();
        
      if (!text) throw new Error("Refined prompt is empty after processing");
      return text;
    }
    
    return content;
  }
}

// Role 3: Executor - Generates the image
class Executor {
  static async execute(prompt: string, base64Image: string): Promise<string> {
    console.log("[Executor] Editing image...");
    
    // Convert base64 to a temporary file because openai.images.edit requires a File-like object
    const matches = base64Image.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    if (!matches) throw new Error("Invalid base64 image format");
    
    const mimeType = matches[1];
    const data = matches[2];
    
    // Extract extension from mime type (e.g. image/jpeg -> jpg)
    let ext = 'png'; // default
    if (mimeType === 'image/jpeg') ext = 'jpg';
    else if (mimeType === 'image/png') ext = 'png';
    else if (mimeType === 'image/webp') ext = 'webp';
    
    const buffer = Buffer.from(data, 'base64');
    const tempFilePath = path.join(os.tmpdir(), `edit-${Date.now()}.${ext}`);
    fs.writeFileSync(tempFilePath, buffer);
    
    try {
      const fileStream = fs.createReadStream(tempFilePath);
      // Pass the contentType explicitly to toFile to ensure OpenAI SDK handles it correctly
      const file = await toFile(fileStream, `image.${ext}`, { type: mimeType });

      const response = await openai.images.edit({
        model: "gpt-image-1",
        image: file,
        prompt: prompt.substring(0, 4000),
        n: 1,
        size: "1024x1024",
      });

      if (!response.data || (!response.data[0].b64_json && !response.data[0].url)) {
        throw new Error("No image generated");
      }

      // Return base64 directly if available, otherwise fetch URL and convert
      if (response.data[0].b64_json) {
        return response.data[0].b64_json;
      } else if (response.data[0].url) {
         const urlResponse = await fetch(response.data[0].url);
         const arrayBuffer = await urlResponse.arrayBuffer();
         return Buffer.from(arrayBuffer).toString('base64');
      }
      
      throw new Error("Failed to retrieve image data");
    } finally {
      // Clean up temp file
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    }
  }
}

// Main exported functions that orchestrate the roles
export async function analyzeImage(imageUrl: string): Promise<{ title: string; suggestions: string[] }> {
  const base64Image = await ensureBase64(imageUrl);
  return await VisionAnalyst.analyze(base64Image);
}

export async function generateImage(userPrompt: string, originalImageUrl: string): Promise<{ imageUrl: string; refinedPrompt: string }> {
  try {
    const originalImageBase64 = await ensureBase64(originalImageUrl);

    // Step 1: Refine Prompt (Composer)
    let refinedPrompt = userPrompt;
    try {
      refinedPrompt = await PromptEngineer.refine(userPrompt, originalImageBase64);
      console.log("Refined Prompt:", refinedPrompt);
    } catch (e) {
      console.error("[Generate] Prompt refinement failed:", e);
      throw e; 
    }

    // Step 2: Edit Image (Executor) - Now passing the original image for editing
    const b64 = await Executor.execute(refinedPrompt, originalImageBase64);
    
    return {
      imageUrl: `data:image/png;base64,${b64}`,
      refinedPrompt
    };
  } catch (error) {
    console.error("OpenAI Generation Error:", error);
    throw error;
  }
}

/**
 * Generate image with effect strength and ensure size matches target dimensions
 */
export async function generateImageWithStrength(
  userPrompt: string,
  sourceImageUrl: string,
  effectStrength: number, // 0.0 to 1.0
  targetWidth: number,
  targetHeight: number
): Promise<{ imageUrl: string; refinedPrompt: string }> {
  try {
    const sourceImageBase64 = await ensureBase64(sourceImageUrl);

    // Step 1: Refine Prompt with effect strength context
    let refinedPrompt = userPrompt;
    try {
      // Adjust prompt based on effect strength
      const strengthDescription = effectStrength < 0.3 ? "subtle" : effectStrength < 0.7 ? "moderate" : "strong";
      const promptWithStrength = `Apply a ${strengthDescription} edit: ${userPrompt}`;
      
      refinedPrompt = await PromptEngineer.refine(promptWithStrength, sourceImageBase64);
      console.log(`Refined Prompt (strength ${effectStrength}):`, refinedPrompt);
    } catch (e) {
      console.error("[GenerateWithStrength] Prompt refinement failed:", e);
      refinedPrompt = userPrompt; // Fallback to original prompt
    }

    // Step 2: Pad source image to square before sending to OpenAI
    const srcBuf = Buffer.from(sourceImageBase64.split(",")[1], "base64");
    const { square } = await padToSquare(srcBuf);
    const squareBase64 = `data:image/png;base64,${square.toString("base64")}`;

    // Step 3: Edit the square image with OpenAI
    const b64SquareOut = await Executor.execute(refinedPrompt, squareBase64);
    
    // Step 4: Unpad to restore TARGET dimensions (preserving the target aspect ratio)
    // Create pad info for target dimensions
    const S = Math.max(targetWidth, targetHeight);
    const targetPad: PadInfo = {
      S,
      left: Math.floor((S - targetWidth) / 2),
      top: Math.floor((S - targetHeight) / 2),
      width: targetWidth,
      height: targetHeight
    };
    
    const finalBuf = await unpadFromSquare(b64SquareOut, targetPad);
    const finalB64 = finalBuf.toString('base64');
    
    return {
      imageUrl: `data:image/png;base64,${finalB64}`,
      refinedPrompt
    };
  } catch (error) {
    console.error("OpenAI Generation with Strength Error:", error);
    throw error;
  }
}
