# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
pnpm dev          # Start dev server at localhost:4321
pnpm build        # Production build
pnpm preview      # Preview production build
pnpm db:sync      # Sync cards from MarvelCDB API
pnpm db:sync --force  # Force re-sync all cards (ignores MD5 hash cache)
pnpm lint         # Run ESLint
pnpm lint:fix     # Run ESLint with auto-fix
pnpm format       # Format with Prettier
pnpm format:check # Check formatting without writing
npx prisma db push        # Apply schema changes to Supabase (use instead of migrate dev)
npx prisma generate       # Regenerate Prisma client after schema changes
```

**Do not use `prisma migrate dev`** — the database was bootstrapped with `db push` and has no migration history. Always use `db push` + `prisma generate` for schema changes.

## Architecture

### Data Flow

Cards are sourced from the [MarvelCDB public API](https://marvelcdb.com/api/public/cards/) and synced into Postgres via `scripts/sync-cards.ts`. The sync uses MD5 hashing of relevant fields to skip unchanged records. The database has three card tables:

- **`hero_cards`** — One record per hero (e.g. "Black Panther"). Primary key is the MarvelCDB card code.
- **`hero_identities`** — Each form/side of a hero (hero, alter_ego, hero_2…). Multiple per hero.
- **`deck_cards`** — All playable cards (ally, event, support, upgrade, resource, player_side_scheme). Cards with `hero_id` set are hero-specific (only playable with that hero).

Additional models in the schema:

- `Session` / `SessionParticipant` — multiplayer session data
- `RulesDocument` — rules text with pgvector embeddings for RAG search
- `EncounterCard` — villain/modular encounter cards (synced from MarvelCDB, excluded from `deck_cards`)
- `SyncedPack` — pack metadata cache used by the sync script

### Auth

`auth-astro` wraps Auth.js. The integration **must be listed in `astro.config.ts` integrations** (not just imported in `auth.config.ts`) — this is what exposes the `auth:config` virtual module. OAuth (Google and Discord) upserts the user to Postgres inside the `jwt` callback in `auth.config.ts`; the resulting DB user id is stored as `token.dbUserId` and forwarded to `session.user.id`.

Helper functions live in `src/lib/auth.ts`:
- `getUser(context)` — returns session user or null
- `requireAuth(context)` — redirects to sign-in if unauthenticated
- `requireAdmin(context)` — returns user if admin flag is set, null otherwise (does not redirect)
- `getUserOwnedPacks(userId)` — fetches the user's owned pack codes from the DB

### CSS

Tailwind v4 is loaded via `@import "tailwindcss"` in `src/styles/global.css`. The `.marvel-glyph` class renders Marvel LCG icon glyphs inline using the bundled `MarvelGlyphs` font.

### Database Schema Notes

- `DeckCard.isPermanent` — sourced from `card.permanent` in the MarvelCDB API. When adding new fields from the API, also add them to the `hashData` object in `sync-cards.ts` so the sync detects the change.
- Faction codes from MarvelCDB map to the `Aspect` enum via `FACTION_TO_ASPECT` in the sync script. Cards with `faction_code === 'hero'` are hero-specific.
- Cards from modular/villain/scenario/campaign set types are excluded from `deck_cards`.

### Shared Card Utilities (`src/lib/cardFormatting.ts`)

Common formatting helpers used across components and pages:

- `formatCardText(text)` — converts `[[bold]]` syntax and `[energy]`/`[wild]` icons to HTML
- `formatType(t)` — converts snake_case type strings to Title Case ("player_side_scheme" → "Player Side Scheme")
- `formatTraits(traits)` — splits trait string ("Avenger. Spy.") into array
- `TYPE_COLOR` — Tailwind bg-class map keyed by card type (ally, event, support, upgrade, resource, player_side_scheme)
- `COST_BUCKETS` — `[0,1,2,3,4] as const` tuple used for cost curve charts (index 4 = "4+")
- `ASPECT_BG` — Tailwind bg-class map keyed by aspect name (Aggression → bg-red-700, etc.)
- `ASPECT_DOT` — Tailwind bg-class map for aspect indicator dots (smaller/brighter variant)
- `ASPECT_RING` — Tailwind ring-class map for aspect focus rings
- `ASPECT_TEXT_COLOR` — Tailwind text-class map for aspect-colored text

Import from here; do not re-implement in components.

### Shared Session Utilities (`src/lib/sessions.ts`)

Async session helpers:

- `getSessionByCode(code)` — fetches session with participants
- `computeSessionCollection(session)` — computes available card quantities based on collection mode
- `getTeammateUniqueCards(session, userId)` — returns unique cards claimed by other players
- `formatTeammates(session, userId)` — formats other players' data for client display
- `formatSessionForClient(session)` — strips sensitive fields before sending to client

Types: `SessionWithParticipants`, `LobbySession`, `LobbyParticipant`

**Session status constants** live in `src/lib/sessionConstants.ts` (re-exported from `sessions.ts`):

- `STATUS_LABEL` — human-readable label map (e.g. `draft` → `'Lobby'`)
- `STATUS_COLOR` — Tailwind class map for session status badge colors

### Shared General Utilities (`src/lib/utils.ts`)

- `cn(...inputs)` — tailwind-merge + clsx; use for conditional className strings in components
- `heroSlug(name, id)` — generates URL slug for hero pages
- `WARLOCK_ID` — MarvelCDB card code for Adam Warlock (special multi-aspect handling)
- `timeAgo(date)` — formats a Date as a relative string ("5m ago", "2h ago")

### Pack Data (`src/lib/packs.ts`)

- `CYCLES` — array of all pack cycles, each with `name` and `packs` list
- `ALL_PACKS` — flat list of all packs
- `ALWAYS_OWNED_CODES` — `Set<string>` of pack codes always considered owned (Core Set)

Do not duplicate pack lists elsewhere.

### Builder Data (`src/lib/builder-data.ts`)

Server-side loaders for deck builder pages:

- `loadBuilderData()` — returns `{ heroOptions, cardPool }`. Deduplicates deck cards by `name + text + resources`; tracks all card IDs and pack codes per deduped entry; keeps hero-specific cards distinct per set.
- `loadEncounterSets()` — encounter set metadata grouped by hero.

### Embeddings / RAG (`src/lib/embeddings.ts`)

AI-powered rules document search via pgvector:

- `processDocument(title, content, section?)` — chunks text, generates embeddings (Google API), stores in `RulesDocument` table
- `searchDocuments(query, limit, threshold)` — vector similarity search against stored docs
- `generateEmbeddings(texts)` / `generateQueryEmbedding(text)` — raw embedding generation
- `listDocuments()` / `deleteDocument(id)` — admin document management

### TypeScript

Use TypeScript everywhere possible. Regular `<script>` tags in `.astro` files (without `is:inline`) **are** processed by Vite and support TypeScript and ES module imports — use them for page-level client logic. Only avoid `is:inline`, which strips TypeScript/module processing entirely. Prefer a React component (`client:load`) or a `.ts` module for anything complex.

### Path Imports

The `@/` alias maps to `src/`. Use it for all cross-file imports in `.tsx`, `.ts`, and `.astro` files — do **not** use relative `../../` paths.

```ts
import { cn } from '@/lib/utils';
import { formatCardText } from '@/lib/cardFormatting';
```

Configured in both `tsconfig.json` (`paths`) and `astro.config.ts` (`vite.resolve.alias`) so the alias works in Astro frontmatter, React components, and client `<script>` tags alike.

## Sessions

Multiplayer deck-building sessions allow players to build decks together with shared or individual card pools.

**Session flow:**
1. **draft** — Owner creates session, sets collection mode
2. **drafting** — Players join, pick heroes (lock/unlock selections)
3. **building** — All players locked in, build decks
4. **completed** — Decks saved

**Collection modes** (`CollectionMode` enum):
- `single` — Only owner's packs available
- `combined` — Union of all participants' packs (card available if anyone owns it)
- `duplicates` — Sum quantities across all participants

**Key lib files:**
- `src/lib/sessions.ts` — `getSessionByCode()`, `computeSessionCollection()`, `getTeammateUniqueCards()`, `formatTeammates()`
- `src/lib/pusher.ts` — Real-time updates via Pusher (`sessionChannel()`, `EVENTS`)
