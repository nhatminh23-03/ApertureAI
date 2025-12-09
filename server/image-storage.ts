import fs from "fs";
import path from "path";
import { randomBytes } from "crypto";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import type { Response } from "express";
import { Readable } from "stream";

const DATA_DIR = path.join(process.cwd(), "server/data");

// Ensure data directory exists for local fallback
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export interface ImageMetadata {
  id: string;
  width: number;
  height: number;
  mimeType: string;
}

interface StorageStrategy {
  saveImage(buffer: Buffer, id: string, mimeType: string): Promise<void>;
  loadImage(id: string): Promise<{ buffer: Buffer; mimeType: string } | null>;
  deleteImage(id: string): Promise<boolean>;
  serveImage(res: Response, id: string, ext: string): Promise<void>;
}

// Local File System Strategy
class LocalStrategy implements StorageStrategy {
  async saveImage(buffer: Buffer, id: string, mimeType: string): Promise<void> {
    let ext = "png";
    if (mimeType === "image/jpeg") ext = "jpg";
    else if (mimeType === "image/webp") ext = "webp";
    
    const filePath = path.join(DATA_DIR, `${id}.${ext}`);
    fs.writeFileSync(filePath, buffer);
  }

  async loadImage(id: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
    const files = fs.readdirSync(DATA_DIR);
    const file = files.find(f => f.startsWith(id + "."));
    if (!file) return null;
    
    const filePath = path.join(DATA_DIR, file);
    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(file).substring(1);
    
    let mimeType = "image/png";
    if (ext === "jpg" || ext === "jpeg") mimeType = "image/jpeg";
    else if (ext === "webp") mimeType = "image/webp";
    
    return { buffer, mimeType };
  }

  async deleteImage(id: string): Promise<boolean> {
    const files = fs.readdirSync(DATA_DIR);
    const file = files.find(f => f.startsWith(id + "."));
    if (!file) return false;
    
    const filePath = path.join(DATA_DIR, file);
    fs.unlinkSync(filePath);
    return true;
  }

  async serveImage(res: Response, id: string, ext: string): Promise<void> {
    const files = fs.readdirSync(DATA_DIR);
    // Try to find exact match first, or just by ID
    let file = files.find(f => f === `${id}.${ext}`);
    if (!file) {
        file = files.find(f => f.startsWith(id + "."));
    }
    
    if (!file) {
      res.status(404).json({ message: "Image not found" });
      return;
    }
    
    const filePath = path.join(DATA_DIR, file);
    res.sendFile(filePath);
  }
}

// S3 / Cloudflare R2 Strategy
class S3Strategy implements StorageStrategy {
  private client: S3Client;
  private bucket: string;

  constructor() {
    this.client = new S3Client({
      region: process.env.AWS_REGION || "auto",
      endpoint: process.env.AWS_ENDPOINT, // Important for R2
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
    this.bucket = process.env.AWS_BUCKET_NAME!;
  }

  private getKey(id: string, mimeType?: string): string {
    // We can just store by ID, but let's keep extension if we know it
    // Actually, S3 doesn't care about extension, but it helps for browser viewing
    // Let's just use ID and store metadata
    return id;
  }

  async saveImage(buffer: Buffer, id: string, mimeType: string): Promise<void> {
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: id,
      Body: buffer,
      ContentType: mimeType,
    }));
  }

  async loadImage(id: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
    try {
      const response = await this.client.send(new GetObjectCommand({
        Bucket: this.bucket,
        Key: id,
      }));

      if (!response.Body) return null;
      const byteArray = await response.Body.transformToByteArray();
      const buffer = Buffer.from(byteArray);
      
      return {
        buffer,
        mimeType: response.ContentType || "image/png",
      };
    } catch (error: any) {
      if (error.name === 'NoSuchKey' || error.Code === 'NoSuchKey') {
        console.warn(`[S3] Image not found: ${id}`);
        return null;
      }
      console.error("S3 loadImage error:", error);
      return null;
    }
  }

  async deleteImage(id: string): Promise<boolean> {
    try {
      await this.client.send(new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: id,
      }));
      return true;
    } catch (e) {
      console.error("S3 deleteImage error:", e);
      return false;
    }
  }

  async serveImage(res: Response, id: string, ext: string): Promise<void> {
    try {
      const response = await this.client.send(new GetObjectCommand({
        Bucket: this.bucket,
        Key: id,
      }));

      if (response.ContentType) {
        res.type(response.ContentType);
      } else {
          // Fallback based on extension requested
          if (ext === "jpg" || ext === "jpeg") res.type("image/jpeg");
          else if (ext === "webp") res.type("image/webp");
          else res.type("image/png");
      }
      
      if (response.Body instanceof Readable) {
        response.Body.pipe(res);
      } else {
        // Should be stream in Node environment, but handle fallback
        const byteArray = await response.Body?.transformToByteArray();
        if (byteArray) {
            res.send(Buffer.from(byteArray));
        } else {
            res.status(404).json({ message: "Image content missing" });
        }
      }
    } catch (e: any) {
      if (e.name === 'NoSuchKey' || e.Code === 'NoSuchKey') {
        // Graceful fallback for missing images
        console.warn(`[S3] serveImage: Image not found: ${id}`);
        res.status(404).json({ message: "Image not found" });
        return;
      }
      console.error("S3 serveImage error:", e);
      res.status(404).json({ message: "Image not found" });
    }
  }
}

export class ImageStorage {
  private static strategy: StorageStrategy = 
    (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_BUCKET_NAME) 
      ? new S3Strategy() 
      : new LocalStrategy();

  static get isS3(): boolean {
    return this.strategy instanceof S3Strategy;
  }

  static async saveImage(base64Image: string): Promise<ImageMetadata> {
    const matches = base64Image.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    if (!matches) throw new Error("Invalid base64 image format");
    
    const mimeType = matches[1];
    const data = matches[2];
    const buffer = Buffer.from(data, "base64");
    
    // Generate unique ID
    const id = randomBytes(16).toString("hex");
    
    await this.strategy.saveImage(buffer, id, mimeType);
    
    // Get dimensions (we still calculate this locally from buffer before upload)
    const { width, height } = await this.getImageDimensionsFromBuffer(buffer, mimeType);
    
    return { id, width, height, mimeType };
  }
  
  static async loadImage(id: string): Promise<string | null> {
    const result = await this.strategy.loadImage(id);
    if (!result) return null;
    return `data:${result.mimeType};base64,${result.buffer.toString("base64")}`;
  }
  
  static async deleteImage(id: string): Promise<boolean> {
    return this.strategy.deleteImage(id);
  }

  // New method to serve image directly to response
  static async serveImage(res: Response, id: string, ext: string): Promise<void> {
    return this.strategy.serveImage(res, id, ext);
  }

  // Kept for backward compatibility if needed (but should use serveImage instead)
  static getImagePath(id: string): string | null {
    if (this.isS3) return null; // S3 doesn't have a local path
    
    // Local strategy fallback logic duplication for legacy support
    const files = fs.readdirSync(DATA_DIR);
    const file = files.find(f => f.startsWith(id + "."));
    return file ? path.join(DATA_DIR, file) : null;
  }
  
  static async getImageDimensionsFromBuffer(buffer: Buffer, mimeType: string): Promise<{ width: number; height: number }> {
    // PNG: width/height at bytes 16-23
    if (mimeType === "image/png" && buffer.length > 24) {
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      return { width, height };
    }
    // Default fallback
    return { width: 1024, height: 1024 };
  }

  static async getImageDimensionsFromBase64(base64Image: string): Promise<{ width: number; height: number }> {
    const matches = base64Image.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    if (!matches) throw new Error("Invalid base64 image format");
    
    const mimeType = matches[1];
    const data = matches[2];
    const buffer = Buffer.from(data, "base64");
    
    return this.getImageDimensionsFromBuffer(buffer, mimeType);
  }
}
