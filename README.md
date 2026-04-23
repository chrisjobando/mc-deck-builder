# Marvel Champions AI Deck Builder

An AI-powered deck builder for the Marvel Champions LCG. Build optimized decks for 1–4 players with Claude AI recommendations based on your owned card collection.

## Stack

- **Astro 6** (SSR, Vercel adapter) + **React 19**
- **Tailwind CSS v4**
- **Prisma** + **Supabase** (PostgreSQL)
- **auth-astro** — Google & Discord OAuth
- **Anthropic AI SDK** — Claude-powered deck suggestions

## Getting Started

```sh
pnpm install
cp .env.example .env   # fill in your credentials
pnpm dev
```

## Environment Variables

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | Supabase PostgreSQL connection string |
| `AUTH_SECRET` | Random secret for Auth.js session signing |
| `AUTH_TRUST_HOST` | Set to `true` |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth credentials |
| `AUTH_DISCORD_ID` / `AUTH_DISCORD_SECRET` | Discord OAuth credentials |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude |

## Commands

| Command | Action |
| --- | --- |
| `pnpm dev` | Start dev server at `localhost:4321` |
| `pnpm build` | Build for production |
| `pnpm preview` | Preview production build |
| `pnpm db:sync` | Sync cards from MarvelCDB API |
