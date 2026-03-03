# StudyFlash Support Platform

Internal support platform MVP for triaging, translating, and responding to multilingual customer tickets with AI assistance.

## Quick Start

### Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project (free tier works)
- A [Groq API key](https://console.groq.com) (free tier works -- 30 RPM)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in:

| Variable | Required | Where to get it |
|---|---|---|
| `DATABASE_URL` | Yes | Supabase > Project Settings > Database > Connection string (Session mode / port 5432) |
| `NEXTAUTH_SECRET` | Yes | Run `openssl rand -base64 32` |
| `GROQ_API_KEY` | Yes | [Groq Console](https://console.groq.com) |
| `DEMO_MODE` | Set to `"true"` | Enables credential-based demo login (no OAuth needed) |
| `NEXT_PUBLIC_DEMO_MODE` | Set to `"true"` | Exposes demo mode flag to the login page |

Leave `GOOGLE_CLIENT_ID`, `MICROSOFT_GRAPH_*` blank for demo mode.

### 3. Push schema to database

```bash
npx prisma db push
```

### 4. Seed with ticket data

```bash
npm run seed
```

This parses the first 20 ticket files in `tickets/` (default), creates 3 demo users, and populates the database. Takes ~10 seconds without AI, or ~30 seconds with AI categorization/translation if `GROQ_API_KEY` is set.

To seed only a few tickets for quick testing:

```bash
npm run seed -- --limit=10
```

### 5. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). In demo mode, click any user on the login page to sign in.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, Server Components) |
| UI | Tailwind CSS + shadcn/ui |
| Database | PostgreSQL via Supabase + Prisma ORM |
| AI | Groq (Llama 3.3 70B Versatile) |
| Email | Microsoft Graph API (optional, demo mode fallback) |
| Auth | NextAuth v5 (Google OAuth + demo credentials) |
| Deployment | Vercel + Supabase (both free tier) |

## Project Structure

```
app/
  (auth)/login/          Login page (demo user picker + Google OAuth)
  (dashboard)/
    tickets/             Ticket list with filters, search, pagination
    tickets/[id]/        Ticket detail: conversation, AI draft, enrichment
    settings/            Team management
  api/
    tickets/             CRUD + nested routes for messages, comments, AI, enrichment
    sync/outlook/        Manual Outlook sync trigger
    auth/[...nextauth]/  NextAuth handlers
lib/
  services/
    ai.ts                Groq/Llama: categorize, translate, draft, assign
    email.ts             Graph API: sync, reply, sender detection
    enrichment.ts        Mocked Sentry/PostHog/user data
  auth.ts                NextAuth config
  prisma.ts              Prisma client singleton
scripts/
  seed.ts                Parse tickets + populate database
tickets/                 100 raw support ticket .txt files
```

## Key Features

- **Multilingual support**: Incoming tickets (DE/FR/NL/IT) are auto-translated to English for agents. Agent replies are translated back to the customer's language before sending.
- **AI triage**: Tickets are auto-categorized, prioritized, and assigned based on content. Confidence thresholds control auto-apply vs. suggest-only.
- **AI draft responses**: One-click draft generation in the customer's language using conversation context.
- **Outlook thread parity**: Replies sent from the platform use the Graph API reply endpoint to stay in the same Outlook conversation thread.
- **Data enrichment**: Sentry errors, PostHog recordings, and user profile data displayed alongside each ticket (mocked for MVP).

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run seed` | Seed database from ticket files |
| `npm run seed -- --limit=N` | Seed first N tickets (default: 20) |
| `npm run db:reset` | Wipe all data (then re-seed) |
| `npx prisma db push` | Push schema to database |
| `npx prisma studio` | Open Prisma Studio (DB browser) |

## Deploy to Vercel

1. Push to GitHub
2. Import in [Vercel](https://vercel.com) (auto-detects Next.js)
3. Add environment variables in Vercel dashboard
4. Run `npx prisma db push` against your Supabase database
5. Deploy
