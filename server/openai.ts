import OpenAI from "openai";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
});

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
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5",
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
      model: "gpt-5",
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
    if (!content) throw new Error("Failed to generate refined prompt");
    return content;
  }
}

// Role 3: Executor - Generates the image
class Executor {
  static async execute(prompt: string): Promise<string> {
    console.log("[Executor] Generating image...");
    const response = await openai.images.generate({
      model: "gpt-image-1",
      prompt: prompt.substring(0, 4000),
      n: 1,
      size: "1024x1024",
      response_format: "b64_json" 
    });

    if (!response.data || !response.data[0].b64_json) {
      throw new Error("No image generated");
    }

    return response.data[0].b64_json;
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
    const refinedPrompt = await PromptEngineer.refine(userPrompt, originalImageBase64);
    console.log("Refined Prompt:", refinedPrompt);

    // Step 2: Generate Image (Executor)
    const b64 = await Executor.execute(refinedPrompt);
    
    return {
      imageUrl: `data:image/png;base64,${b64}`,
      refinedPrompt
    };
  } catch (error) {
    console.error("OpenAI Generation Error:", error);
    throw error;
  }
}
