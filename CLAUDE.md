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

### Browse Page (`src/pages/browse.astro`)

The most complex file. Server-side Astro frontmatter fetches and pre-processes card data; client-side `<script>` handles filtering and modals.

**Server-side consolidation:**
- Deck cards appearing in multiple packs are merged into one display entry with all art variants collected and quantities summed. Dedup key: `name + text + heroId` — the `heroId` component keeps Black Panther's "Vibranium" separate from Shuri's "Vibranium".
- `displayCards` (rendered in the grid) excludes hero-specific cards (`heroId !== null`). `allCards` (serialized to JSON for the modal) includes everything.
- Hero-specific card names are pipe-joined (`|||` separator) into a `data-hero-cards` attribute so searching for a hero-specific card name surfaces the hero in the grid.

**Client-side data passing:**
Card data is passed via a hidden `<div id="cards-data" data-cards={cardsJson}>` element, **not** via `define:vars`. The script reads it with `JSON.parse(document.getElementById('cards-data').dataset.cards)`. This is intentional — `define:vars` forces `is:inline` behavior which strips TypeScript processing.

**Modal navigation state:**
```
parentHeroId: string | null   — hero we came from
parentPage: 'hero-cards' | null — whether we came from the hero cards sub-page
```
Back button routing in `renderDeckCardModal`: if `parentPage === 'hero-cards'` → `renderHeroCardsPage`, otherwise → `renderHeroModal`.

### CSS

Tailwind v4 is loaded via `@import "tailwindcss"` in `src/styles/global.css`. **Tailwind preflight applies `max-width: 100%` to all `<img>` elements**, which breaks rotated PSS card images. The `.pss-img` class overrides this with `max-width: none` and handles the rotation math: a landscape (88×63) image fills a portrait (63×88) container by sizing the element to `width: calc(88/63 * 100%)` before applying `rotate(-90deg)`.

**CSS variables** for aspect and type colors are defined in `src/styles/global.css`:

- `--color-aspect-{name}` / `--color-aspect-dot-{name}` / `--color-aspect-text-{name}` / `--color-aspect-ring-{name}`
- `--color-type-{name}` (underscores in type names become hyphens: `player_side_scheme` → `player-side-scheme`)

Use these CSS vars (or the Tailwind map constants from `cardFormatting.ts`) rather than hardcoding colors.

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

Used by `CollectionGrid` and session collection computation. Do not duplicate pack lists elsewhere.

### Builder Data (`src/lib/builder-data.ts`)

Server-side loaders for deck builder pages:

- `loadBuilderData()` — returns `{ heroOptions, cardPool }`. Deduplicates deck cards by `name + text + resources`; tracks all card IDs and pack codes per deduped entry; keeps hero-specific cards distinct per set.
- `loadEncounterSets()` — encounter set metadata grouped by hero.

### Dialog Utilities (`src/lib/dialog.ts`)

Client-side dialog helpers (no framework dependency):

- `showConfirm(message, options)` → `Promise<boolean>` — confirmation dialog
- `showAlert(message, options)` → `Promise<void>` — alert dialog

Used in `DeckBuilder` for MarvelCDB import mismatches and destructive actions.

### Embeddings / RAG (`src/lib/embeddings.ts`)

AI-powered rules document search via pgvector:

- `processDocument(title, content, section?)` — chunks text, generates embeddings (Google API), stores in `RulesDocument` table
- `searchDocuments(query, limit, threshold)` — vector similarity search against stored docs
- `generateEmbeddings(texts)` / `generateQueryEmbedding(text)` — raw embedding generation
- `listDocuments()` / `deleteDocument(id)` — admin document management

Managed via `src/pages/admin/documents.astro` (admin-only).

### TypeScript

Use TypeScript everywhere possible. Regular `<script>` tags in `.astro` files (without `is:inline`) **are** processed by Vite and support TypeScript and ES module imports — use them for page-level client logic. Only avoid `is:inline`, which strips TypeScript/module processing entirely. Prefer a React component (`client:load`) or a `.ts` module for anything complex.

### Path Imports

The `@/` alias maps to `src/`. Use it for all cross-file imports in `.tsx`, `.ts`, and `.astro` files — do **not** use relative `../../` paths.

```ts
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatCardText } from '@/lib/cardFormatting';
import { AspectBadge } from '@/components/ui/marvel';
```

Configured in both `tsconfig.json` (`paths`) and `astro.config.ts` (`vite.resolve.alias`) so the alias works in Astro frontmatter, React components, and client `<script>` tags alike.

## Components

### `src/components/DeckBuilder.tsx`

The main deck builder UI (1700+ lines). Three-step flow: hero selection → aspect selection → deck editor.

- Bootstraps via `<div id="heroes-data">` and `<div id="cards-data">` DOM elements (same `define:vars`-avoidance pattern as browse.astro)
- MarvelCDB import: user pastes a URL/ID → hero/aspect mismatch handled via `showConfirm` dialog
- AI suggestions: streams from `/api/builder/suggest`, rendered with `formatAiResponse()`
- Session mode: receives `sessionContext` (teammates, collection mode, unique claims) to show teammates panel and conflict warnings
- Effective quantity per card is session-aware (respects collection mode + teammate claims on unique cards)
- "Owned only" filter toggle gates hero/card lists by pack ownership

### `src/components/CardModal.tsx`

Dialog showing full card details. PSS cards use landscape ratio — the 88×63 `.pss-img` CSS rules apply (see CSS section).

### `src/components/CollectionGrid.tsx`

Interactive pack selector grouped by cycles from `packs.ts`. Always-owned packs (Core Set) are shown as disabled checkboxes. Floating save bar appears only when dirty; saves to `/api/user/collection`.

### `src/components/DeckGrid.tsx`

Grid of saved decks with a modal preview panel. Preview includes: hero image with alter ego toggle, type breakdown bar, cost curve chart. Supports copy, delete, and edit (links to builder with `?deck={id}`).

### `src/components/SessionLobby.tsx`

Session hero selection and status management. Four phases: draft → drafting → building → completed.

- Real-time sync via Pusher events: `participant-joined`, `participant-updated`, `participant-locked`, `status-changed`
- Adam Warlock special case: auto-selects all 4 aspects
- Aspect picker logic: single-aspect heroes replace the current selection; multi-aspect heroes (Spider-Woman) require exactly 2, replacing the oldest when full
- Ghost slots show "Waiting for player…" for up to 4 players

### Marvel UI Components (`src/components/ui/marvel/`)

Domain components exported from `src/components/ui/marvel/index.ts`. Use these for consistent aspect/type styling:

- `AspectBadge` — aspect badge using CSS var `--color-aspect-{name}`; sizes: `sm` | `md`
- `AspectButton` — selectable aspect with optional recommendation pill and reason tooltip
- `CardTypeBadge` — type badge using CSS var `--color-type-{name}`
- `DeckProgress` — deck size progress bar: neutral <40, green 40–50, red >50 cards
- `StatBox` — stat display box; sizes `xs` | `md`; null value renders as "—"
- `StatusBadge` — session status badge using `STATUS_LABEL` + `STATUS_COLOR` from `sessionConstants.ts`

## Sessions (`/sessions`)

Multiplayer deck-building sessions allow players to build decks together with shared or individual card pools.

**Session flow:**
1. **draft** — Owner creates session, sets collection mode
2. **drafting** — Players join, pick heroes (lock/unlock selections)
3. **building** — All players locked in, build decks at `/sessions/[code]/[hero]/[aspects]`
4. **completed** — Decks saved

**Collection modes** (`CollectionMode` enum):
- `single` — Only owner's packs available
- `combined` — Union of all participants' packs (card available if anyone owns it)
- `duplicates` — Sum quantities across all participants

**Key files:**
- `src/lib/sessions.ts` — `getSessionByCode()`, `computeSessionCollection()`, `getTeammateUniqueCards()`, `formatTeammates()`
- `src/lib/pusher.ts` — Real-time updates via Pusher (`sessionChannel()`, `EVENTS`)
- `src/components/SessionLobby.tsx` — Hero selection, lock/unlock, status management
- `src/components/DeckBuilder.tsx` — Session-aware building with teammates panel and conflict warnings for unique cards claimed by others

**Session builder page:**
URL pattern: `/sessions/[code]/[hero]/[aspects]` — reuses `DeckBuilder` with `sessionContext` prop containing teammates, collection mode, and save endpoint.
