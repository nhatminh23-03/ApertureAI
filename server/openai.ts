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

// Sharp image processing parameters
export type SharpParams = {
  brightness: number;  // -50 to 50
  contrast: number;    // -50 to 50
  saturation: number;  // -50 to 50
  hue: number;         // -180 to 180
  sharpen: number;     // 0 to 10
  noise: number;       // 0 to 100 (noise reduction)
};

// Optimize image for OpenAI APIs (downscale + compress)
// This dramatically reduces upload time and avoids file size limits
async function optimizeImageForAPI(base64Image: string, options: { 
  maxDimension?: number; 
  quality?: number;
  format?: 'jpeg' | 'png';
  label?: string;
} = {}): Promise<string> {
  const { 
    maxDimension = 1024, 
    quality = 85, 
    format = 'jpeg',
    label = 'Optimize'
  } = options;
  
  try {
    // Extract base64 data
    const matches = base64Image.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) return base64Image; // Return as-is if format is unexpected
    
    const base64Data = matches[2];
    const inputBuffer = Buffer.from(base64Data, "base64");
    
    // Get original size for logging
    const originalSize = inputBuffer.length;
    
    // Resize and compress
    let pipeline = sharp(inputBuffer).resize(maxDimension, maxDimension, { 
      fit: "inside", 
      withoutEnlargement: true 
    });
    
    let optimizedBuffer: Buffer;
    let mimeType: string;
    
    if (format === 'png') {
      optimizedBuffer = await pipeline.png({ compressionLevel: 9 }).toBuffer();
      mimeType = 'image/png';
    } else {
      optimizedBuffer = await pipeline.jpeg({ quality }).toBuffer();
      mimeType = 'image/jpeg';
    }
    
    const optimizedSize = optimizedBuffer.length;
    const reduction = ((1 - optimizedSize / originalSize) * 100).toFixed(1);
    console.log(`[${label}] ${(originalSize / 1024 / 1024).toFixed(2)}MB → ${(optimizedSize / 1024).toFixed(0)}KB (${reduction}% smaller)`);
    
    return `data:${mimeType};base64,${optimizedBuffer.toString("base64")}`;
  } catch (error) {
    console.error(`[${label}] Failed to optimize, using original:`, error);
    return base64Image;
  }
}

// Shorthand for Vision API optimization
async function optimizeForVision(base64Image: string): Promise<string> {
  return optimizeImageForAPI(base64Image, { 
    maxDimension: 1024, 
    quality: 85, 
    format: 'jpeg',
    label: 'VisionOptimize' 
  });
}

// Shorthand for DALL-E API optimization (needs PNG for transparency support)
async function optimizeForDALLE(base64Image: string): Promise<string> {
  return optimizeImageForAPI(base64Image, { 
    maxDimension: 1024, 
    quality: 90, 
    format: 'png',
    label: 'DALLEOptimize' 
  });
}

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
  // returnedSquareB64 is raw base64 (no data: prefix)
  const squareBuf = Buffer.from(returnedSquareB64, "base64");
  // First, get the actual dimensions of the returned image
  const metadata = await sharp(squareBuf).metadata();
  const actualSize = metadata.width || 1024;
  
  // Scale to the target square size (pad.S)
  const scaled = await sharp(squareBuf).resize(pad.S, pad.S).toBuffer();
  
  // Crop out the padding to restore original dimensions
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
  static async analyze(base64Image: string): Promise<{ 
    title: string; 
    naturalSuggestions: Array<{ label: string; params: SharpParams }>;
    aiSuggestions: string[] 
  }> {
    console.log("[VisionAnalyst] Analyzing image...");
    
    // Optimize image for faster upload to GPT-4o Vision
    const optimizedImage = await optimizeForVision(base64Image);
    
    // Log the start of the base64 string to debug MIME type issues
    const prefix = optimizedImage.substring(0, 50);
    console.log(`[VisionAnalyst] Image prefix: ${prefix}...`);

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // Switch to gpt-4o for better vision stability
        messages: [
          {
            role: "system",
            content: `You are a professional photo analyst. Analyze the image and return JSON with:
1. title: concise image title (max 6 words)
2. naturalSuggestions: array of 6 photo adjustments with numeric Sharp parameters
   - The FIRST suggestion MUST be labeled "Auto Enhance" and contain the optimal combination of brightness, contrast, saturation, sharpness, etc. to make the photo look its best.
   - The other 5 suggestions should be specific granular adjustments (e.g. "brighten shadows", "boost vibrancy").
3. aiSuggestions: array of 5 creative AI remix ideas

CRITICAL INSTRUCTIONS:
- Analyze brightness: is image dark (-30 to -50), normal (0), or bright (+30 to +50)?
- Analyze contrast: is image flat (add +20 to +30) or already contrasty (0)?
- Analyze saturation: is image muted (add +10 to +20) or vibrant (0)?
- Analyze sharpness: is image soft (sharpen 3-6) or sharp (0)?
- Analyze noise: is image grainy (noise 20-40) or clean (0)?

RETURN NON-ZERO VALUES FOR ACTUAL IMPROVEMENTS. Do not return all zeros.

Example for dark image:
{ 
  "title": "Dark Forest",
  "naturalSuggestions": [
    { "label": "Auto Enhance", "params": { "brightness": 35, "contrast": 15, "saturation": 0, "hue": 0, "sharpen": 2, "noise": 10 } },
    { "label": "brighten shadows", "params": { "brightness": 35, "contrast": 15, "saturation": 0, "hue": 0, "sharpen": 0, "noise": 0 } },
    ...
  ],
  "aiSuggestions": ...
}

Example for flat image:
{ "label": "add contrast", "params": { "brightness": 0, "contrast": 25, "saturation": 10, "hue": 0, "sharpen": 0, "noise": 0 } }

Return valid JSON only, no other text.`
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Analyze this image and provide suggestions with Sharp parameters." },
              { type: "image_url", image_url: { url: optimizedImage } }
            ],
          },
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 2048,
      });

      const content = response.choices[0].message.content;
      if (!content) throw new Error("No content in response");
      
      const parsed = JSON.parse(content);
      console.log("[VisionAnalyst] Raw response:", JSON.stringify(parsed, null, 2));
      return parsed;
    } catch (error) {
      console.error("[VisionAnalyst] Error:", error);
      // Fallback for MVP if Vision fails
      return {
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
    }
  }
}

// Role 2: Prompt Engineer (Composer) - Writes the detailed DALL-E prompt
class PromptEngineer {
  static async refine(userPrompt: string, base64Image: string): Promise<string> {
    console.log("[PromptEngineer] Refinining prompt...");
    
    // Optimize image for analysis
    const optimizedImage = await optimizeForVision(base64Image);
    
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
    
    // Optimize image for DALL-E (max 50MB limit, we target much smaller)
    const optimizedImage = await optimizeForDALLE(base64Image);
    
    // Convert base64 to a temporary file because openai.images.edit requires a File-like object
    const matches = optimizedImage.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
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
    
    let outputTempPath: string | null = null;
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

      // Prefer base64 if available (less memory overhead), otherwise fetch URL
      if (response.data[0].b64_json) {
        return response.data[0].b64_json;
      } else if (response.data[0].url) {
        // Fetch URL and convert to base64 (unavoidable for this endpoint)
        console.log("[Executor] Fetching image from URL...");
        const urlResponse = await fetch(response.data[0].url);
        if (!urlResponse.ok) {
          throw new Error(`Failed to fetch image: ${urlResponse.statusText}`);
        }
        const arrayBuffer = await urlResponse.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        return base64;
      }
      
      throw new Error("Failed to retrieve image data");
    } finally {
      // Clean up temp files
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
      if (outputTempPath && fs.existsSync(outputTempPath)) {
        fs.unlinkSync(outputTempPath);
      }
    }
  }
}

// Sharp image processor for Natural Edit
export async function applySharpParams(base64Image: string, params: SharpParams, targetWidth: number, targetHeight: number): Promise<string> {
  try {
    console.log("[SharpProcessor] Applying params:", JSON.stringify(params));
    console.log("[SharpProcessor] Target dimensions:", targetWidth, "x", targetHeight);
    
    // Extract base64 data and original MIME type
    const matches = base64Image.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    if (!matches) throw new Error("Invalid base64 image format");
    
    const originalMimeType = matches[1];
    const data = matches[2];
    const buffer = Buffer.from(data, "base64");
    
    const inputSize = buffer.length;
    console.log("[SharpProcessor] Input size:", (inputSize / 1024 / 1024).toFixed(2), "MB, format:", originalMimeType);
    
    let pipeline = sharp(buffer);
    
    // Apply modulate for brightness, saturation, hue
    const modulateOptions: any = {};
    if (params.brightness !== 0) {
      modulateOptions.brightness = 1 + (params.brightness / 100); // Convert -50..50 to 0.5..1.5
    }
    if (params.saturation !== 0) {
      modulateOptions.saturation = 1 + (params.saturation / 100); // Convert -50..50 to 0.5..1.5
    }
    if (params.hue !== 0) {
      modulateOptions.hue = params.hue; // -180..180
    }
    
    if (Object.keys(modulateOptions).length > 0) {
      pipeline = pipeline.modulate(modulateOptions);
    }
    
    // Apply contrast
    if (params.contrast !== 0) {
      pipeline = pipeline.linear(1 + (params.contrast / 100), 0); // Convert -50..50 to 0.5..1.5
    }
    
    // Apply sharpen
    if (params.sharpen > 0) {
      pipeline = pipeline.sharpen({ sigma: params.sharpen / 2 }); // 0..10 -> 0..5 sigma
    }
    
    // Apply noise reduction (using median filter as approximation)
    if (params.noise > 0) {
      // Use median filter for noise reduction
      pipeline = pipeline.median(Math.ceil(params.noise / 20)); // 0..100 -> 0..5 radius
    }
    
    // Preserve original format and apply compression
    // This prevents a 3MB JPEG from becoming a 70MB PNG
    let processed: Buffer;
    let outputMimeType: string;
    
    if (originalMimeType === "image/jpeg" || originalMimeType === "image/jpg") {
      // Output as JPEG with good quality (90%)
      processed = await pipeline.jpeg({ quality: 90 }).toBuffer();
      outputMimeType = "image/jpeg";
    } else if (originalMimeType === "image/webp") {
      // Output as WebP with good quality
      processed = await pipeline.webp({ quality: 90 }).toBuffer();
      outputMimeType = "image/webp";
    } else {
      // Default to PNG with compression for other formats
      processed = await pipeline.png({ compressionLevel: 9 }).toBuffer();
      outputMimeType = "image/png";
    }
    
    const outputSize = processed.length;
    console.log("[SharpProcessor] Output size:", (outputSize / 1024 / 1024).toFixed(2), "MB, format:", outputMimeType);
    
    return `data:${outputMimeType};base64,${processed.toString("base64")}`;
  } catch (error) {
    console.error("[SharpProcessor] Error:", error);
    throw error;
  }
}

// Main exported functions that orchestrate the roles
export async function analyzeImage(imageUrl: string): Promise<{ title: string; naturalSuggestions: Array<{ label: string; params: SharpParams }>; aiSuggestions: string[] }> {
  const base64Image = await ensureBase64(imageUrl);
  return await VisionAnalyst.analyze(base64Image);
}

// Helper: given a natural-language prompt for Natural Edit, return a single SharpParams object
// that best matches the requested adjustments for the given image.
export async function analyzePromptToSharpParams(
  base64Image: string,
  userPrompt: string,
  selectedLabels?: string[]
): Promise<SharpParams> {
  console.log("[PromptToSharp] Analyzing prompt for Natural Edit...", { userPrompt, selectedLabels });

  // Optimize image for analysis to prevent timeouts/errors with large files
  const optimizedImage = await optimizeForVision(base64Image);

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a configuration engine for the Sharp image processing library.
Input: An image and a text description of a desired visual adjustment.
Output: A JSON object containing numeric values for brightness, contrast, saturation, hue, sharpen, and noise.

The user is NOT asking you to edit the image.
The user is asking for the NUMERIC CONFIGURATION to be applied by a separate software tool.
Analyze the image to determine the appropriate magnitude of adjustments.

Output a SINGLE JSON object with these integer fields:
{
  "params": {
    "brightness": number,   // -50 to 50
    "contrast": number,     // -50 to 50
    "saturation": number,   // -50 to 50
    "hue": number,          // -180 to 180
    "sharpen": number,      // 0 to 10
    "noise": number         // 0 to 100 (noise reduction)
  }
}

Return ONLY valid JSON, no extra text.`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Calculate configuration for request: "${userPrompt}".
Context suggestions: ${selectedLabels && selectedLabels.length ? selectedLabels.join(", ") : "none"}.`
            },
            { type: "image_url", image_url: { url: optimizedImage } }
          ]
        }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 512
    });

    // Check for refusal
    if (response.choices[0].message.refusal) {
      console.warn("[PromptToSharp] Request refused by model. Falling back to text-only estimation.", response.choices[0].message.refusal);
      throw new Error("Model refused request");
    }

    const content = response.choices[0].message.content;
    if (!content) {
      console.error("[PromptToSharp] Response content is empty:", JSON.stringify(response, null, 2));
      throw new Error("No content in PromptToSharp response");
    }

    const parsed = JSON.parse(content as string);
    const raw = parsed.params ?? parsed;

    const params: SharpParams = {
      brightness: Number(raw.brightness) || 0,
      contrast: Number(raw.contrast) || 0,
      saturation: Number(raw.saturation) || 0,
      hue: Number(raw.hue) || 0,
      sharpen: Number(raw.sharpen) || 0,
      noise: Number(raw.noise) || 0
    };

    console.log("[PromptToSharp] Parsed params:", params);
    return params;
  } catch (error) {
    console.error("[PromptToSharp] Vision Error:", error);
    
    // Fallback: Text-only analysis (no image)
    // This avoids refusals related to image processing restrictions
    try {
      console.log("[PromptToSharp] Attempting text-only fallback...");
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a configuration engine for the Sharp image processing library.
Convert the user's text request into numeric parameters.

Output JSON:
{
  "params": {
    "brightness": number,   // -50 to 50
    "contrast": number,     // -50 to 50
    "saturation": number,   // -50 to 50
    "hue": number,          // -180 to 180
    "sharpen": number,      // 0 to 10
    "noise": number         // 0 to 100 (noise reduction)
  }
}`
          },
          {
            role: "user",
            content: `Request: "${userPrompt}". Suggestions: ${selectedLabels?.join(", ")}`
          }
        ],
        response_format: { type: "json_object" }
      });
      
      const content = response.choices[0].message.content;
      if (content) {
        const parsed = JSON.parse(content);
        const raw = parsed.params ?? parsed;
        return {
          brightness: Number(raw.brightness) || 0,
          contrast: Number(raw.contrast) || 0,
          saturation: Number(raw.saturation) || 0,
          hue: Number(raw.hue) || 0,
          sharpen: Number(raw.sharpen) || 0,
          noise: Number(raw.noise) || 0
        };
      }
    } catch (fallbackError) {
      console.error("[PromptToSharp] Fallback Error:", fallbackError);
    }

    // Ultimate fallback: safe defaults
    return {
      brightness: 0,
      contrast: 0,
      saturation: 0,
      hue: 0,
      sharpen: 0,
      noise: 0
    };
  }
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

    // Step 1: Refine Prompt (same prompt regardless of strength)
    // The strength only affects blending, not the prompt itself
    let refinedPrompt = userPrompt;
    try {
      refinedPrompt = await PromptEngineer.refine(userPrompt, sourceImageBase64);
      console.log(`Refined Prompt:`, refinedPrompt);
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
