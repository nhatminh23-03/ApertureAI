import fs from "fs";
import path from "path";
import { randomBytes } from "crypto";

const DATA_DIR = path.join(process.cwd(), "server/data");

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export interface ImageMetadata {
  id: string;
  width: number;
  height: number;
  mimeType: string;
}

export class ImageStorage {
  /**
   * Save a base64 image and return its ID and metadata
   */
  static async saveImage(base64Image: string): Promise<ImageMetadata> {
    const matches = base64Image.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    if (!matches) throw new Error("Invalid base64 image format");
    
    const mimeType = matches[1];
    const data = matches[2];
    
    // Generate unique ID
    const id = randomBytes(16).toString("hex");
    
    // Determine file extension
    let ext = "png";
    if (mimeType === "image/jpeg") ext = "jpg";
    else if (mimeType === "image/png") ext = "png";
    else if (mimeType === "image/webp") ext = "webp";
    
    const buffer = Buffer.from(data, "base64");
    const filePath = path.join(DATA_DIR, `${id}.${ext}`);
    
    fs.writeFileSync(filePath, buffer);
    
    // Get image dimensions using a simple approach
    const { width, height } = await this.getImageDimensions(buffer, mimeType);
    
    return { id, width, height, mimeType };
  }
  
  /**
   * Load an image by ID and return as base64
   */
  static loadImage(id: string): string | null {
    const files = fs.readdirSync(DATA_DIR);
    const file = files.find(f => f.startsWith(id + "."));
    
    if (!file) return null;
    
    const filePath = path.join(DATA_DIR, file);
    const buffer = fs.readFileSync(filePath);
    
    const ext = path.extname(file).substring(1);
    let mimeType = "image/png";
    if (ext === "jpg" || ext === "jpeg") mimeType = "image/jpeg";
    else if (ext === "webp") mimeType = "image/webp";
    
    return `data:${mimeType};base64,${buffer.toString("base64")}`;
  }
  
  /**
   * Get the file path for an image ID
   */
  static getImagePath(id: string): string | null {
    const files = fs.readdirSync(DATA_DIR);
    const file = files.find(f => f.startsWith(id + "."));
    
    if (!file) return null;
    
    return path.join(DATA_DIR, file);
  }
  
  /**
   * Delete an image by ID
   */
  static deleteImage(id: string): boolean {
    const files = fs.readdirSync(DATA_DIR);
    const file = files.find(f => f.startsWith(id + "."));
    
    if (!file) return false;
    
    const filePath = path.join(DATA_DIR, file);
    fs.unlinkSync(filePath);
    return true;
  }
  
  /**
   * Get image dimensions from buffer
   * Simple implementation - in production you might use a library like 'sharp' or 'image-size'
   */
  private static async getImageDimensions(buffer: Buffer, mimeType: string): Promise<{ width: number; height: number }> {
    // For now, return a default size - in production, parse the image headers
    // PNG: width/height at bytes 16-23
    // JPEG: scan for SOF marker
    if (mimeType === "image/png" && buffer.length > 24) {
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      return { width, height };
    }
    
    // Default fallback
    return { width: 1024, height: 1024 };
  }
}
