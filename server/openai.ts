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

export async function analyzeImage(imageUrl: string): Promise<{ title: string; suggestions: string[] }> {
  console.log("[OpenAI] Analyzing image...");
  try {
    const base64Image = await ensureBase64(imageUrl);

    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: `You are a helpful AI photo editor assistant. Analyze the image provided and suggest 4-5 creative edit prompts that a user might want to apply to this image. Also, provide a short, descriptive title for the image.
          
          Return the response in this JSON format:
          {
            "title": "A short descriptive title",
            "suggestions": ["suggestion 1", "suggestion 2", "suggestion 3", "suggestion 4"]
          }`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyze this image."
            },
            {
              type: "image_url",
              image_url: {
                url: base64Image
              }
            }
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 512,
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error("No content in response");
    
    const result = JSON.parse(content);
    return {
      title: result.title || "Uploaded Image",
      suggestions: result.suggestions || []
    };
  } catch (error) {
    console.error("OpenAI Analysis Error:", error);
    return {
      title: "Uploaded Image",
      suggestions: ["Enhance colors", "Make it cinematic", "Remove background"]
    };
  }
}

export async function generateImage(userPrompt: string, originalImageUrl: string): Promise<{ imageUrl: string; refinedPrompt: string }> {
  console.log("[OpenAI] Generating image...");
  try {
    const originalImageBase64 = await ensureBase64(originalImageUrl);

    // Step 1: Agentic Prompt Refinement (Vision -> Text)
    const visionResponse = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: `You are an expert AI Prompt Engineer for DALL-E 3. 
          Your task is to look at the provided image and the user's requested edit.
          Then, write a highly detailed, descriptive prompt that describes the scene in the original image BUT with the user's changes applied.
          The goal is to generate a new image that looks like the original but with the specific edits.
          Focus on lighting, style, composition, and subject details.
          
          Output ONLY the raw prompt text, nothing else.`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `User's requested edit: "${userPrompt}"`
            },
            {
              type: "image_url",
              image_url: {
                url: originalImageBase64
              }
            }
          ],
        },
      ],
      max_completion_tokens: 512,
    });

    const refinedPrompt = visionResponse.choices[0].message.content;
    if (!refinedPrompt) throw new Error("Failed to generate refined prompt");

    console.log("Refined Prompt:", refinedPrompt);

    // Step 2: Generation (Text -> Image)
    const response = await openai.images.generate({
      model: "gpt-image-1",
      prompt: refinedPrompt.substring(0, 4000),
      n: 1,
      size: "1024x1024",
    });

    if (!response.data || !response.data[0].b64_json) {
      throw new Error("No image generated");
    }

    const b64 = response.data[0].b64_json;
    
    return {
      imageUrl: `data:image/png;base64,${b64}`,
      refinedPrompt
    };
  } catch (error) {
    console.error("OpenAI Generation Error:", error);
    throw error;
  }
}
