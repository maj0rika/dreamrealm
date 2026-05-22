# DreamRealm

DreamRealm is an AI-driven persistent-world storytelling app. Users create a
world, continue it turn by turn, and the system keeps track of story state,
locations, characters, relationships, memories, and generated scene images.

## What It Does

- Creates playable narrative worlds from a user prompt and selected art style.
- Runs turn-based exploration with structured AI output validation.
- Persists world state in Supabase, including turns, entities, locations,
  relationships, events, memory, and story direction.
- Generates and stores cover and turn images with stable visual anchors.
- Uses a story-director layer to maintain act structure, tension, unresolved
  threads, and long-running narrative continuity.

## Tech Stack

- Next.js App Router, React, TypeScript, Tailwind CSS
- Supabase Auth, Postgres, Storage, and server-side clients
- OpenAI-compatible text generation with Zod response validation
- Replicate image generation pipeline with Supabase Storage upload

## Repository Structure

- `src/app` - pages, auth callback, and world API routes
- `src/components` - dashboard, exploration, and shared UI components
- `src/lib/ai` - prompts, schemas, model client, state extraction, images
- `src/lib/db` - Supabase data access helpers
- `supabase/migrations` - database and storage schema
- `docs` - feature notes and seed data

## Getting Started

Install dependencies:

```bash
npm install
```

Copy the example environment file and fill in the required values:

```bash
cp .env.local.example .env.local
```

Required environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `OPENROUTER_API_KEY`
- `GROQ_API_KEY`
- `REPLICATE_API_TOKEN`
- `OPENAI_API_KEY`

Run the development server:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Quality Checks

```bash
npm run lint
npm run build
```

## Notes

This repository intentionally excludes local agent instructions and personal
workspace files so the public tree stays focused on the product code.
