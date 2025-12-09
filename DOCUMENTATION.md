# Aperture AI — Comprehensive Technical Documentation

## Table of Contents

1. [Overview](#overview)
2. [Key Features](#key-features)
3. [System Architecture](#system-architecture)
4. [Technology Stack](#technology-stack)
5. [AI Agents & Models](#ai-agents--models)
6. [Database Design](#database-design)
7. [Frontend Architecture](#frontend-architecture)
8. [Backend Architecture](#backend-architecture)
9. [Frontend ↔ Backend Communication](#frontend--backend-communication)
10. [Image Processing Pipeline](#image-processing-pipeline)
11. [Project Structure](#project-structure)
12. [Environment Variables](#environment-variables)
13. [Deployment Considerations](#deployment-considerations)

---

## Overview

**Aperture AI** is a sophisticated AI-powered photo editing web application that enables users to transform images using natural language prompts. The application combines traditional image processing techniques with cutting-edge generative AI to provide two distinct editing paradigms:

1. **Natural Edit** — Photography-style adjustments (brightness, contrast, saturation, sharpening, noise reduction) interpreted from natural language and applied via the Sharp image processing library.

2. **AI Remix** — Creative, generative transformations powered by OpenAI's DALL-E model that can fundamentally reimagine an image based on descriptive prompts.

The application is built with a full-stack TypeScript architecture, emphasizing type safety, modern React patterns, and a multi-agent AI system that orchestrates different specialized AI roles to deliver high-quality results.

---

## Key Features

### Dual Editing Modes

| Mode | Description | AI Model | Processing |
|------|-------------|----------|------------|
| **Natural Edit** | Photography-style adjustments | GPT-4o (parameter inference) | Sharp library |
| **AI Remix** | Creative generative transformations | GPT-4o + DALL-E 3 | OpenAI Image Edit API |

### Core Capabilities

- **Natural Language Editing** — Describe desired changes in plain English (e.g., "brighten the shadows", "add cinematic teal-orange grading")
- **Dynamic Effect Strength** — Fine-tune edit intensity with a 0-100% slider that scales parameters or triggers new AI generations
- **Before/After Comparison** — Interactive draggable slider to compare original and edited images
- **Iterative Refinement** — "Refine Current Edit" toggle allows chaining edits on top of previous results
- **AI-Powered Suggestions** — Context-aware recommendations for both Natural Edit (with Sharp parameters) and AI Remix (creative prompts)
- **Edit History** — Persistent storage and retrieval of all editing sessions
- **Strength Caching** — Previously generated AI images at specific strength levels are cached to avoid redundant API calls
- **Responsive Design** — Optimized for desktop and mobile with glassmorphism UI effects

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT (React + Vite)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Home      │  │   Editor    │  │   History   │  │  UI Components      │ │
│  │   Page      │  │   Page      │  │   Page      │  │  (shadcn/ui)        │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│                              │                                               │
│                    TanStack Query (React Query)                              │
│                              │                                               │
└──────────────────────────────┼───────────────────────────────────────────────┘
                               │ HTTP/REST API
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SERVER (Express.js + Node.js)                     │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         API Routes (/api/*)                         │    │
│  │  • POST /api/upload          • GET /api/history                     │    │
│  │  • POST /api/natural-edit/:id • GET /api/edits/:id                  │    │
│  │  • POST /api/generate/:id     • GET /api/suggestions/:id            │    │
│  │  • PATCH /api/edits/:id       • DELETE /api/edits/:id               │    │
│  │  • GET /api/data/:id.png                                            │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                              │                                               │
│  ┌───────────────────────────┼───────────────────────────────────────────┐  │
│  │                    AI Agent Orchestration                             │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │  │
│  │  │   Vision    │  │  Prompt-to  │  │   Prompt    │  │  Executor   │   │  │
│  │  │  Analyst    │  │   -Sharp    │  │  Engineer   │  │  (DALL-E)   │   │  │
│  │  │  (GPT-4o)   │  │  (GPT-4o)   │  │  (GPT-4o)   │  │             │   │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘   │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                              │                                               │
│  ┌───────────────────────────┼───────────────────────────────────────────┐  │
│  │              Image Processing & Storage                               │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────────┐    │  │
│  │  │   Sharp     │  │   Image     │  │      Drizzle ORM            │    │  │
│  │  │  Processor  │  │  Storage    │  │   (PostgreSQL Client)       │    │  │
│  │  └─────────────┘  └─────────────┘  └─────────────────────────────┘    │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL SERVICES                                   │
│  ┌─────────────────────────┐  ┌─────────────────────────────────────────┐   │
│  │      OpenAI API         │  │         Neon PostgreSQL                 │   │
│  │  • GPT-4o (Vision)      │  │  • edits table                          │   │
│  │  • GPT-4o (Text)        │  │  • strength_cache table                 │   │
│  │  • DALL-E 3 (Images)    │  │  • (future) users table                 │   │
│  └─────────────────────────┘  └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Frontend

| Technology | Purpose | Version |
|------------|---------|---------|
| **React** | UI framework | 19.2.0 |
| **TypeScript** | Type-safe JavaScript | 5.6.3 |
| **Vite** | Build tool & dev server | 7.1.9 |
| **Wouter** | Lightweight client-side routing | 3.3.5 |
| **TanStack Query** | Server state management & caching | 5.60.5 |
| **Tailwind CSS** | Utility-first styling | 4.1.14 |
| **shadcn/ui** | Accessible component library (Radix UI) | — |
| **Framer Motion** | Animations & transitions | 12.23.24 |
| **Lucide React** | Icon library | 0.545.0 |

### Backend

| Technology | Purpose | Version |
|------------|---------|---------|
| **Node.js** | JavaScript runtime | — |
| **Express.js** | Web server framework | 4.21.2 |
| **TypeScript** | Type-safe JavaScript | 5.6.3 |
| **Sharp** | High-performance image processing | 0.34.5 |
| **OpenAI SDK** | AI model integration | 6.9.1 |
| **Drizzle ORM** | Type-safe database queries | 0.39.1 |
| **Zod** | Runtime schema validation | 3.25.76 |

### Database

| Technology | Purpose |
|------------|---------|
| **Neon PostgreSQL** | Serverless PostgreSQL database |
| **Drizzle Kit** | Schema migrations & management |
| **drizzle-zod** | Drizzle-to-Zod schema conversion |

### Development Tools

| Tool | Purpose |
|------|---------|
| **tsx** | TypeScript execution for development |
| **esbuild** | Fast bundler for server code |
| **Drizzle Kit** | Database migrations |

---

## AI Agents & Models

Aperture AI implements a **multi-agent architecture** where specialized AI agents handle different aspects of the editing workflow. This separation of concerns allows each agent to be optimized for its specific task.

### Agent Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AI AGENT PIPELINE                                 │
│                                                                             │
│  ┌─────────────────┐                                                        │
│  │  USER UPLOADS   │                                                        │
│  │     IMAGE       │                                                        │
│  └────────┬────────┘                                                        │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────┐     Analyzes image content                             │
│  │ VISION ANALYST  │     Returns: title, naturalSuggestions, aiSuggestions │
│  │    (GPT-4o)     │                                                        │
│  └────────┬────────┘                                                        │
│           │                                                                 │
│           ├──────────────────────────────────────────────────┐              │
│           │                                                  │              │
│           ▼ Natural Edit Path                                ▼ AI Remix    │
│  ┌─────────────────┐                                ┌─────────────────┐     │
│  │ PROMPT-TO-SHARP │                                │ PROMPT ENGINEER │     │
│  │    (GPT-4o)     │                                │    (GPT-4o)     │     │
│  │                 │                                │                 │     │
│  │ Converts prompt │                                │ Refines prompt  │     │
│  │ to SharpParams  │                                │ for DALL-E      │     │
│  └────────┬────────┘                                └────────┬────────┘     │
│           │                                                  │              │
│           ▼                                                  ▼              │
│  ┌─────────────────┐                                ┌─────────────────┐     │
│  │ SHARP PROCESSOR │                                │    EXECUTOR     │     │
│  │   (Node.js)     │                                │   (DALL-E 3)    │     │
│  │                 │                                │                 │     │
│  │ Applies params  │                                │ Generates new   │     │
│  │ to image        │                                │ image           │     │
│  └────────┬────────┘                                └────────┬────────┘     │
│           │                                                  │              │
│           └──────────────────────┬───────────────────────────┘              │
│                                  │                                          │
│                                  ▼                                          │
│                         ┌─────────────────┐                                 │
│                         │  EDITED IMAGE   │                                 │
│                         └─────────────────┘                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1. Vision Analyst

**Model:** GPT-4o (multimodal vision)

**Purpose:** Analyzes uploaded images to understand content, lighting, composition, and suggests improvements.

**Input:**
- Base64-encoded image

**Output:**
```typescript
{
  title: string;                    // Concise image title (max 6 words)
  naturalSuggestions: Array<{       // 5 photography-style adjustments
    label: string;                  // e.g., "brighten shadows"
    params: SharpParams;            // Numeric Sharp parameters
  }>;
  aiSuggestions: string[];          // 5 creative AI remix ideas
}
```

**System Prompt Highlights:**
- Analyzes brightness (dark/normal/bright)
- Evaluates contrast (flat vs contrasty)
- Assesses saturation (muted vs vibrant)
- Checks sharpness (soft vs sharp)
- Detects noise levels (grainy vs clean)

### 2. Prompt-to-Sharp

**Model:** GPT-4o

**Purpose:** Interprets natural language editing requests and converts them to precise Sharp parameters.

**Input:**
- Base64-encoded image
- User's natural language prompt (e.g., "make it brighter and more vibrant")
- Optional: selected suggestion labels

**Output:**
```typescript
{
  brightness: number;   // -50 to 50
  contrast: number;     // -50 to 50
  saturation: number;   // -50 to 50
  hue: number;          // -180 to 180
  sharpen: number;      // 0 to 10
  noise: number;        // 0 to 100 (noise reduction)
}
```

### 3. Prompt Engineer

**Model:** GPT-4o

**Purpose:** Refines user's high-level creative prompts into detailed, DALL-E-optimized descriptions.

**Input:**
- Base64-encoded image
- User's creative prompt (e.g., "turn into cyberpunk scene")

**Output:**
- Highly detailed text prompt describing the desired image transformation, including lighting, style, composition, and subject details.

### 4. Executor

**Model:** DALL-E 3 (gpt-image-1)

**Purpose:** Generates new images based on refined prompts using OpenAI's image editing API.

**Input:**
- Refined prompt from Prompt Engineer
- Source image (padded to square for API compatibility)

**Output:**
- Base64-encoded generated image

**Technical Details:**
- Images are padded to square (1024×1024) before sending to OpenAI
- Results are unpadded to restore original aspect ratio
- Uses `openai.images.edit()` API endpoint

---

## Database Design

### Schema Overview

The application uses **Drizzle ORM** with **Neon PostgreSQL** for type-safe database operations.

```sql
-- Main edits table
CREATE TABLE edits (
  id SERIAL PRIMARY KEY,
  original_image_id TEXT NOT NULL,      -- ID of uploaded image
  current_image_id TEXT NOT NULL,       -- ID of latest edited version
  width INTEGER NOT NULL,               -- Original image width
  height INTEGER NOT NULL,              -- Original image height
  prompt TEXT NOT NULL,                 -- User's edit prompt
  refined_prompt TEXT,                  -- AI-optimized prompt (AI Remix)
  effect_strength INTEGER DEFAULT 50,   -- 0-100 intensity
  title TEXT DEFAULT 'Untitled Draft',  -- AI-generated or user title
  suggestions TEXT[],                   -- Array of AI suggestions
  natural_suggestions_json TEXT,        -- Cached Sharp-compatible suggestions
  original_mime_type TEXT DEFAULT 'image/jpeg',
  status TEXT NOT NULL DEFAULT 'pending', -- pending | completed | failed
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Strength cache for AI Remix
CREATE TABLE strength_cache (
  id SERIAL PRIMARY KEY,
  edit_id INTEGER NOT NULL,             -- Reference to parent edit
  strength INTEGER NOT NULL,            -- 0-100 strength level
  image_id TEXT NOT NULL,               -- Generated image ID
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);
```

### TypeScript Types

```typescript
// SharpParams for Natural Edit
export type SharpParams = {
  brightness: number;  // -50 to 50
  contrast: number;    // -50 to 50
  saturation: number;  // -50 to 50
  hue: number;         // -180 to 180
  sharpen: number;     // 0 to 10
  noise: number;       // 0 to 100
};

// Edit record
export type Edit = {
  id: number;
  originalImageId: string;
  currentImageId: string;
  width: number;
  height: number;
  prompt: string;
  refinedPrompt: string | null;
  effectStrength: number;
  title: string;
  suggestions: string[] | null;
  naturalSuggestionsJson: string | null;
  originalMimeType: string;
  status: 'pending' | 'completed' | 'failed';
  createdAt: Date;
};
```

### Migrations

Located in `/migrations/`:
- `0000_lazy_spirit.sql` — Initial schema
- `0001_add_strength_cache.sql` — Strength caching table
- `0002_add_natural_suggestions_cache.sql` — Natural suggestions JSON column
- `0003_add_original_mime_type.sql` — MIME type tracking
- `0004_add_edit_history.sql` — Edit history enhancements
- `0005_mysterious_scarlet_spider.sql` — Latest schema updates

---

## Frontend Architecture

### Page Structure

```
client/src/pages/
├── home.tsx      # Landing page with image upload
├── editor.tsx    # Main editing interface
└── history.tsx   # Edit history gallery
```

### Editor Component State

The `editor.tsx` component manages complex state for the editing workflow:

```typescript
// Core editing state
const [step, setStep] = useState<"prompt" | "processing" | "preview">("prompt");
const [editMode, setEditMode] = useState<"ai" | "reallife">("reallife");
const [prompt, setPrompt] = useState("");
const [intensity, setIntensity] = useState([50]);  // Effect strength 0-100

// Refinement options
const [refineFromCurrent, setRefineFromCurrent] = useState(false);

// AI suggestions
const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
const [aiNaturalSuggestions, setAiNaturalSuggestions] = useState<
  Array<{ label: string; params: SharpParams }>
>([]);

// Natural Edit state
const [baseNaturalParams, setBaseNaturalParams] = useState<SharpParams | null>(null);
const [selectedNaturalSuggestions, setSelectedNaturalSuggestions] = useState<Set<string>>(new Set());
```

### Data Fetching with TanStack Query

```typescript
// Fetch edit details
const { data: edit, isLoading } = useQuery<Edit>({
  queryKey: [`/api/edits/${id}`],
  enabled: !!id
});

// Natural Edit mutation
const naturalEditMutation = useMutation({
  mutationFn: async (payload) => {
    const res = await apiRequest("POST", `/api/natural-edit/${id}`, payload);
    return await res.json();
  },
  onSuccess: (data) => {
    // Update UI, cache base params, fetch new suggestions
  }
});

// AI Remix mutation
const generateMutation = useMutation({
  mutationFn: async () => {
    await apiRequest("POST", `/api/generate/${id}`, {
      prompt,
      refineFromCurrent,
      effectStrength: intensity[0]
    });
  }
});
```

### Session Persistence

Editor state is persisted to `sessionStorage` for seamless navigation:

```typescript
useEffect(() => {
  if (id) {
    sessionStorage.setItem(`edit-${id}`, JSON.stringify({
      step,
      prompt,
      intensity: intensity[0],
      refineFromCurrent
    }));
  }
}, [step, prompt, intensity, refineFromCurrent, id]);
```

### UI Components

Built with **shadcn/ui** (Radix UI primitives):
- `Slider` — Effect strength control
- `Switch` — Refine Current Edit toggle
- `Textarea` — Prompt input
- `Button` — Actions with loading states
- `Toast` — User notifications
- Custom `BeforeAfterSlider` — Image comparison
- Custom `GlassCard` — Glassmorphism containers

---

## Backend Architecture

### Express Server Setup

```typescript
// server/index.ts
import express from "express";
import { registerRoutes } from "./routes";

const app = express();
app.use(express.json({ limit: "50mb" }));  // Large payload for images

const server = await registerRoutes(app);
server.listen(5000);
```

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/upload` | POST | Upload image, trigger Vision Analyst |
| `/api/natural-edit/:id` | POST | Apply Natural Edit with Sharp |
| `/api/generate/:id` | POST | Generate AI Remix with DALL-E |
| `/api/suggestions/:id` | GET | Fetch AI suggestions for current image |
| `/api/edits/:id` | GET | Retrieve edit details |
| `/api/edits/:id` | PATCH | Update edit title |
| `/api/edits/:id` | DELETE | Delete edit and all associated images |
| `/api/history` | GET | List all edits |
| `/api/data/:id.png` | GET | Serve image file |

### Image Storage

Currently uses local filesystem (`server/data/`):

```typescript
// server/image-storage.ts
export class ImageStorage {
  static async saveImage(base64Image: string): Promise<ImageMetadata>;
  static loadImage(id: string): string | null;
  static getImagePath(id: string): string | null;
  static deleteImage(id: string): boolean;
}
```

**Note:** For Vercel deployment, images should be stored in cloud object storage (S3, Supabase Storage, Cloudflare R2) since Vercel's filesystem is ephemeral.

---

## Frontend ↔ Backend Communication

### 1. Image Upload Flow

```
┌─────────────┐     POST /api/upload      ┌─────────────┐
│   Client    │ ─────────────────────────▶│   Server    │
│             │   { image: base64 }       │             │
└─────────────┘                           └──────┬──────┘
                                                 │
                                                 ▼
                                          ┌─────────────┐
                                          │   Vision    │
                                          │  Analyst    │
                                          └──────┬──────┘
                                                 │
                                                 ▼
                                          ┌─────────────┐
                                          │  Database   │
                                          │  (create)   │
                                          └──────┬──────┘
                                                 │
┌─────────────┐     { id, title, ...}     ┌──────┴──────┐
│   Client    │ ◀─────────────────────────│   Server    │
│  (redirect) │                           │             │
└─────────────┘                           └─────────────┘
```

### 2. Natural Edit Flow

```
┌─────────────┐   POST /api/natural-edit/:id   ┌─────────────┐
│   Client    │ ──────────────────────────────▶│   Server    │
│             │   {                            │             │
│             │     prompt?,                   │             │
│             │     params?,                   │             │
│             │     refineFromCurrent,         │             │
│             │     strengthPercent            │             │
│             │   }                            │             │
└─────────────┘                                └──────┬──────┘
                                                      │
                        ┌─────────────────────────────┼─────────────────────────────┐
                        │                             │                             │
                        ▼                             ▼                             ▼
                 ┌─────────────┐              ┌─────────────┐              ┌─────────────┐
                 │ Load Source │              │ Prompt-to-  │              │   Apply     │
                 │   Image     │              │   Sharp     │              │   Sharp     │
                 │ (current or │              │  (if prompt)│              │   Params    │
                 │  original)  │              │             │              │             │
                 └─────────────┘              └─────────────┘              └─────────────┘
                                                                                  │
┌─────────────┐   { image_id, params }                                     ┌──────┴──────┐
│   Client    │ ◀──────────────────────────────────────────────────────────│   Server    │
│  (update)   │                                                            │             │
└─────────────┘                                                            └─────────────┘
```

### 3. AI Remix Flow

```
┌─────────────┐   POST /api/generate/:id   ┌─────────────┐
│   Client    │ ──────────────────────────▶│   Server    │
│             │   {                        │             │
│             │     prompt,                │             │
│             │     refineFromCurrent,     │             │
│             │     effectStrength         │             │
│             │   }                        │             │
└─────────────┘                            └──────┬──────┘
       │                                          │
       │                                          ▼
       │                                   ┌─────────────┐
       │                                   │ Check Cache │
       │                                   └──────┬──────┘
       │                                          │
       │                    ┌─────────────────────┼─────────────────────┐
       │                    │ Cache Hit           │ Cache Miss          │
       │                    ▼                     ▼                     │
       │             ┌─────────────┐       ┌─────────────┐              │
       │             │ Use Cached  │       │   Prompt    │              │
       │             │   Image     │       │  Engineer   │              │
       │             └─────────────┘       └──────┬──────┘              │
       │                                          │                     │
       │                                          ▼                     │
       │                                   ┌─────────────┐              │
       │                                   │  Executor   │              │
       │                                   │  (DALL-E)   │              │
       │                                   └──────┬──────┘              │
       │                                          │                     │
       │                                          ▼                     │
       │                                   ┌─────────────┐              │
       │                                   │ Save to     │              │
       │                                   │   Cache     │              │
       │                                   └─────────────┘              │
       │                                          │                     │
       │ Poll GET /api/edits/:id                  │                     │
       │◀─────────────────────────────────────────┴─────────────────────┘
       │   (until status === "completed")
       ▼
┌─────────────┐
│   Client    │
│  (display)  │
└─────────────┘
```

---

## Image Processing Pipeline

### Natural Edit Processing

```typescript
// server/openai.ts - applySharpParams()
export async function applySharpParams(
  base64Image: string,
  params: SharpParams,
  targetWidth: number,
  targetHeight: number
): Promise<string> {
  const buffer = Buffer.from(base64Data, "base64");
  let pipeline = sharp(buffer);
  
  // Apply modulate for brightness, saturation, hue
  if (params.brightness !== 0 || params.saturation !== 0 || params.hue !== 0) {
    pipeline = pipeline.modulate({
      brightness: 1 + (params.brightness / 100),  // 0.5 to 1.5
      saturation: 1 + (params.saturation / 100),  // 0.5 to 1.5
      hue: params.hue                              // -180 to 180
    });
  }
  
  // Apply contrast
  if (params.contrast !== 0) {
    pipeline = pipeline.linear(1 + (params.contrast / 100), 0);
  }
  
  // Apply sharpen
  if (params.sharpen > 0) {
    pipeline = pipeline.sharpen({ sigma: params.sharpen / 2 });
  }
  
  // Apply noise reduction (median filter)
  if (params.noise > 0) {
    pipeline = pipeline.median(Math.ceil(params.noise / 20));
  }
  
  const processed = await pipeline.png().toBuffer();
  return `data:image/png;base64,${processed.toString("base64")}`;
}
```

### AI Remix Processing

```typescript
// server/openai.ts - generateImageWithStrength()
export async function generateImageWithStrength(
  userPrompt: string,
  sourceImageUrl: string,
  effectStrength: number,
  targetWidth: number,
  targetHeight: number
): Promise<{ imageUrl: string; refinedPrompt: string }> {
  
  // Step 1: Refine prompt with Prompt Engineer
  const refinedPrompt = await PromptEngineer.refine(userPrompt, sourceImageBase64);
  
  // Step 2: Pad source image to square (OpenAI requires square images)
  const { square, pad } = await padToSquare(sourceBuffer);
  
  // Step 3: Generate with DALL-E
  const generatedSquare = await Executor.execute(refinedPrompt, squareBase64);
  
  // Step 4: Unpad to restore original aspect ratio
  const finalImage = await unpadFromSquare(generatedSquare, targetPad);
  
  return { imageUrl: finalImage, refinedPrompt };
}
```

---

## Project Structure

```
ApertureEditor/
├── client/                     # Frontend React application
│   └── src/
│       ├── components/         # Reusable UI components
│       │   ├── ui/             # shadcn/ui components
│       │   ├── layout.tsx      # App layout wrapper
│       │   └── before-after-slider.tsx
│       ├── hooks/              # Custom React hooks
│       ├── lib/                # Utilities (queryClient, utils)
│       ├── pages/              # Route components
│       │   ├── home.tsx        # Landing/upload page
│       │   ├── editor.tsx      # Main editor
│       │   └── history.tsx     # Edit history
│       ├── App.tsx             # Root component with routing
│       ├── main.tsx            # Entry point
│       └── index.css           # Global styles
│
├── server/                     # Backend Express application
│   ├── index.ts                # Server entry point
│   ├── routes.ts               # API route definitions
│   ├── openai.ts               # AI agent implementations
│   ├── storage.ts              # Database operations
│   ├── image-storage.ts        # File system image handling
│   ├── db.ts                   # Database connection
│   └── data/                   # Image storage directory
│
├── shared/                     # Shared TypeScript types
│   └── schema.ts               # Drizzle schema & Zod validation
│
├── migrations/                 # Database migrations
│   ├── 0000_lazy_spirit.sql
│   ├── 0001_add_strength_cache.sql
│   └── ...
│
├── package.json                # Dependencies & scripts
├── vite.config.ts              # Vite configuration
├── drizzle.config.ts           # Drizzle ORM configuration
├── tailwind.config.ts          # Tailwind CSS configuration
├── tsconfig.json               # TypeScript configuration
└── README.md                   # Project overview
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Neon PostgreSQL connection string |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | Yes | OpenAI API key |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | No | Custom OpenAI base URL |
| `NODE_ENV` | No | `development` or `production` |

---

## Deployment Considerations

### Local Development

```bash
# Install dependencies
npm install

# Push database schema
npm run db:push

# Start development server
npm run dev
```

### Production Build

```bash
# Build client and server
npm run build

# Start production server
npm start
```

### Vercel Deployment

**Important:** Vercel's serverless functions have an ephemeral filesystem. For production:

1. **Database:** Use Neon PostgreSQL (already configured)
2. **Image Storage:** Migrate from local filesystem to:
   - Supabase Storage
   - AWS S3
   - Cloudflare R2
   - Vercel Blob

The `ImageStorage` class provides an abstraction layer that can be adapted for cloud storage without changing the rest of the application.

### Recommended Cloud Storage Migration

```typescript
// Example: Supabase Storage adapter
export class CloudImageStorage {
  static async saveImage(base64Image: string): Promise<ImageMetadata> {
    // Upload to Supabase bucket
    const { data, error } = await supabase.storage
      .from('images')
      .upload(filename, buffer);
    
    // Return metadata with storage key
    return { id: data.path, ... };
  }
  
  static async loadImage(id: string): Promise<string | null> {
    // Download from Supabase bucket
    const { data } = await supabase.storage
      .from('images')
      .download(id);
    
    return `data:image/png;base64,${buffer.toString('base64')}`;
  }
}
```

---

## Summary

Aperture AI demonstrates a sophisticated integration of:

- **Modern React patterns** with TypeScript, TanStack Query, and component-driven architecture
- **Multi-agent AI system** leveraging GPT-4o for vision analysis and prompt engineering, plus DALL-E 3 for image generation
- **Hybrid image processing** combining traditional Sharp-based adjustments with generative AI
- **Efficient caching** to minimize redundant AI API calls
- **Type-safe full-stack development** with shared schemas between frontend and backend

The application serves as an excellent example of how to build production-ready AI-powered applications with proper separation of concerns, error handling, and user experience considerations.
