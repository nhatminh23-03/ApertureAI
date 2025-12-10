# Aperture AI 

Link: https://apertureai.onrender.com/
> AI-Powered Photo Editing Application - Transform your photos with natural language prompts

A modern, full-stack web application that enables users to upload photos and apply AI-powered edits using natural language prompts. Built with React, Express, TypeScript, and OpenAI's GPT-4 Vision and DALL-E models.

## ✨ Features

- **🎨 AI-Powered Editing** - Describe the edits you want in natural language, and let AI handle the rest
- **🔄 Before/After Comparison** - Interactive slider to compare original and edited images
- **📸 Auto Enhance** - One-click optimization with AI-suggested parameters
- **💾 Edit History** - Track and manage all your edits with persistent storage
- **🔐 Secure Authentication** - Local accounts with strong password requirements + Google OAuth 2.0
- **🌓 Dark/Light Mode** - Responsive design with full theme support
- **⚡ Real-time Processing** - Instant feedback with loading indicators and progress tracking
- **🎯 Smart Suggestions** - AI analyzes images and provides contextual editing suggestions

## 🏗️ Project Structure

```
aperture-editor/
├── client/                      # React frontend
│   ├── src/
│   │   ├── pages/              # Route components (home, editor, history, auth)
│   │   ├── components/          # Reusable UI components
│   │   │   ├── ui/             # shadcn/ui components
│   │   │   ├── layout.tsx       # Main layout wrapper
│   │   │   └── nav.tsx          # Navigation bar
│   │   ├── hooks/              # Custom React hooks (use-auth, use-toast)
│   │   ├── lib/                # Utilities (queryClient, API requests)
│   │   ├── App.tsx             # Main app component with routing
│   │   └── index.css           # Global styles
│   ├── public/                 # Static assets
│   └── vite.config.ts          # Vite configuration
│
├── server/                      # Express backend
│   ├── index.ts                # Server entry point
│   ├── routes.ts               # API route handlers
│   ├── auth.ts                 # Passport.js authentication setup
│   ├── openai.ts               # OpenAI integration (Vision, DALL-E)
│   ├── storage.ts              # Database operations (Drizzle ORM)
│   ├── image-storage.ts        # Image storage utilities
│   └── vite.ts                 # Vite middleware for development
│
├── shared/                      # Shared code
│   └── schema.ts               # Zod schemas and TypeScript types
│
├── migrations/                  # Database migrations
│   └── *.sql                   # Drizzle-generated migrations
│
├── package.json                # Dependencies and scripts
├── tsconfig.json               # TypeScript configuration
├── vite.config.ts              # Vite configuration
├── drizzle.config.ts           # Drizzle ORM configuration
└── README.md                   # This file
```

## 🔧 Technology Stack

### Frontend

- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS v4** - Styling
- **shadcn/ui** - Component library
- **Wouter** - Lightweight routing
- **TanStack Query** - Server state management
- **React Hook Form** - Form handling
- **Zod** - Schema validation
- **Lucide React** - Icons
- **Framer Motion** - Animations

### Backend

- **Express.js** - Web server
- **Node.js** - Runtime
- **TypeScript** - Type safety
- **Drizzle ORM** - Database ORM
- **Passport.js** - Authentication
- **OpenAI SDK** - AI integration
- **Sharp** - Image processing
- **Neon** - PostgreSQL database

### Database

- **PostgreSQL** - Relational database
- **Drizzle ORM** - Type-safe ORM
- **Zod** - Runtime validation

## 📚 API Endpoints

### Authentication

- `POST /api/register` - Create new account
- `POST /api/login` - Login with credentials
- `POST /api/logout` - Logout
- `GET /api/user` - Get current user
- `PATCH /api/user` - Update user profile
- `GET /api/auth/google` - Google OAuth initiation
- `GET /api/auth/google/callback` - Google OAuth callback

### Image Editing

- `POST /api/upload` - Upload image and analyze
- `GET /api/history` - Get all edits
- `GET /api/edits/:id` - Get specific edit
- `POST /api/natural-edit/:id` - Apply natural edit
- `POST /api/generate/:id` - Generate AI image
- `PATCH /api/edits/:id/title` - Update edit title
- `DELETE /api/edits/:id` - Delete edit

## 🔐 Security Features

- **Password Security** - Scrypt hashing with 64-byte salt
- **Password Requirements** - Minimum 8 characters, 1 uppercase, 1 number
- **Session Management** - Secure cookies with HttpOnly flag
- **OAuth 2.0** - Google authentication support
- **Input Validation** - Zod schema validation on all inputs
- **API Authentication** - All endpoints require authentication
- **CORS** - Same-origin requests only
- **Rate Limiting** - Configurable per endpoint

## 🎨 UI/UX Features

- **Responsive Design** - Mobile-first approach
- **Dark/Light Mode** - Full theme support
- **Before/After Slider** - Interactive image comparison
- **Real-time Feedback** - Loading indicators and progress tracking
- **Toast Notifications** - User feedback system
- **Glassmorphism** - Modern glass effect design
- **Gradient Accents** - Teal and royal blue gradients

## 🙏 Acknowledgments

- [OpenAI](https://openai.com) - GPT-4 Vision and DALL-E 3
- [Neon](https://neon.tech) - PostgreSQL database
- [shadcn/ui](https://ui.shadcn.com) - Component library
- [Tailwind CSS](https://tailwindcss.com) - Styling framework
