# Aperture AI - AI-Powered Photo Editing Application

## Overview

Aperture AI is a modern web application that enables users to upload photos and apply AI-powered edits using natural language prompts. The application provides an intuitive interface for photo manipulation, featuring before/after comparisons, edit history tracking, and AI-suggested enhancements. Built with a full-stack TypeScript architecture, it leverages OpenAI's image generation capabilities to transform user photos based on descriptive text inputs.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build System**
- **React 18** with TypeScript for type-safe component development
- **Vite** as the build tool and development server, configured for hot module replacement and optimized production builds
- **Wouter** for lightweight client-side routing instead of React Router
- **TanStack Query (React Query)** for server state management, caching, and data synchronization

**UI Component Strategy**
- **shadcn/ui** component library built on Radix UI primitives, providing accessible, customizable components
- **Tailwind CSS v4** for utility-first styling with custom design tokens
- **Custom design system** featuring glassmorphism effects, gradient accents (teal/royal blue), and support for light/dark modes
- **Font strategy**: Inter for body text, Poppins for headings, loaded via Google Fonts

**State Management Pattern**
- Server state managed through React Query with aggressive caching (`staleTime: Infinity`)
- Local UI state managed with React hooks (useState, useEffect)
- Session storage for persisting editor state across navigation
- No global state management library (Redux/Zustand) - keeping state local and server-synchronized

**Key UI Features**
- Before/after image comparison with draggable slider
- Real-time opacity blending controlled by effect strength slider
- Responsive design with mobile-first approach
- Toast notifications for user feedback

### Backend Architecture

**Server Framework**
- **Express.js** running on Node.js with TypeScript (ES modules)
- **Request logging middleware** that captures API calls, response times, and truncates long responses
- **Body parsing** with 50MB limit to accommodate base64-encoded images
- Raw body capture for potential webhook integrations

**API Design Pattern**
- RESTful API structure with `/api/*` prefix
- Endpoints:
  - `POST /api/upload` - Upload image and trigger AI analysis
  - `GET /api/history` - Retrieve all edit records
  - `GET /api/edits/:id` - Fetch specific edit details
  - `POST /api/edits/:id/generate` - Generate AI-edited image
  - `PATCH /api/edits/:id/title` - Update edit title
  - `DELETE /api/edits/:id` - Remove edit from history

**AI Integration Strategy**
- **OpenAI API** via official SDK for image generation and vision analysis
- Multi-stage AI pipeline:
  1. **Vision Analyst**: Analyzes uploaded image using GPT-4 Vision to generate title and suggestions
  2. **Prompt Engineer**: Refines user prompt for optimal DALL-E results
  3. **Image Generator**: Executes DALL-E image edits with refined prompts
- Base64 image encoding/decoding for API compatibility
- MIME type validation (jpeg, png, webp only)

**Error Handling**
- Graceful degradation: Analysis failures don't block uploads
- Detailed error logging with status tracking (pending, completed, failed)
- Client-friendly error messages via standardized JSON responses

### Data Storage & Schema

**Database Solution**
- **Neon PostgreSQL** (serverless) accessed via `@neondatabase/serverless` with WebSocket support
- **Drizzle ORM** for type-safe database queries and schema management
- Connection pooling for efficient resource utilization

**Schema Design** (`edits` table)
```typescript
{
  id: serial (primary key)
  imageUrl: text (original image as base64 or URL)
  generatedImageUrl: text (AI-edited result)
  prompt: text (user's natural language edit request)
  refinedPrompt: text (AI-optimized prompt for DALL-E)
  title: text (AI-generated descriptive title)
  suggestions: text[] (array of follow-up edit ideas)
  status: text (pending | completed | failed)
  createdAt: timestamp
}
```

**Schema Management**
- Zod schemas (`drizzle-zod`) for runtime validation
- Database migrations stored in `/migrations`
- Push-based deployment via `drizzle-kit push`

### Build & Deployment Strategy

**Development Mode**
- Concurrent client (Vite dev server on port 5000) and server (tsx watch mode)
- Vite middleware integrated into Express for seamless HMR
- Replit-specific plugins: cartographer, dev banner, runtime error overlay

**Production Build**
- Client: Vite builds React app to `dist/public`
- Server: esbuild bundles Express server to `dist/index.js` (ESM format, external packages)
- Single-command start: `node dist/index.js` serves both static assets and API

**Environment Variables**
- `DATABASE_URL` - Neon PostgreSQL connection string (required)
- `AI_INTEGRATIONS_OPENAI_API_KEY` - OpenAI API key (required)
- `AI_INTEGRATIONS_OPENAI_BASE_URL` - Optional OpenAI base URL override
- `NODE_ENV` - Development/production mode switch

## External Dependencies

### Third-Party Services

**OpenAI API**
- **Purpose**: Image generation (DALL-E) and vision analysis (GPT-4 Vision)
- **Integration**: Official `openai` SDK v4.x
- **Usage**: 
  - Vision API for analyzing uploaded images
  - DALL-E for generating edited images based on prompts
- **Authentication**: API key via environment variable

**Neon Database**
- **Purpose**: Serverless PostgreSQL hosting
- **Integration**: `@neondatabase/serverless` driver with WebSocket support
- **Features**: Connection pooling, auto-scaling, branching support

### Key NPM Dependencies

**Core Framework**
- `express` - Web server framework
- `react` / `react-dom` - UI library
- `vite` - Build tool and dev server
- `drizzle-orm` - Database ORM
- `@tanstack/react-query` - Data fetching and caching

**UI Component Libraries**
- `@radix-ui/*` - Accessible component primitives (20+ components)
- `lucide-react` - Icon library
- `tailwindcss` - Utility-first CSS framework
- `class-variance-authority` / `clsx` / `tailwind-merge` - Styling utilities

**Form & Validation**
- `react-hook-form` - Form state management
- `@hookform/resolvers` - Validation resolver
- `zod` - Schema validation
- `drizzle-zod` - Drizzle-to-Zod schema conversion

**Utilities**
- `date-fns` - Date formatting and manipulation
- `nanoid` - Unique ID generation
- `ws` - WebSocket client for Neon connection

**Development Tools**
- `typescript` - Type checking
- `tsx` - TypeScript execution for development
- `esbuild` - Fast bundler for server code
- `@replit/vite-plugin-*` - Replit-specific development enhancements

### Browser APIs Used
- FileReader API for client-side image encoding
- Fetch API for server communication
- Session Storage for state persistence
- Mouse/Touch events for slider interaction