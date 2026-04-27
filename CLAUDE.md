# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
pnpm dev          # Start dev server at localhost:4321
pnpm build        # Production build
pnpm preview      # Preview production build
pnpm db:sync      # Sync cards from MarvelCDB API
pnpm db:sync --force  # Force re-sync all cards (ignores MD5 hash cache)
npx prisma db push        # Apply schema changes to Supabase (use instead of migrate dev)
npx prisma generate       # Regenerate Prisma client after schema changes
```

**Do not use `prisma migrate dev`** — the database was bootstrapped with `db push` and has no migration history. Always use `db push` + `prisma generate` for schema changes.

## Architecture

### Data Flow

Cards are sourced from the [MarvelCDB public API](https://marvelcdb.com/api/public/cards/) and synced into Postgres via `scripts/sync-cards.mjs`. The sync uses MD5 hashing of relevant fields to skip unchanged records. The database has three card tables:

- **`hero_cards`** — One record per hero (e.g. "Black Panther"). Primary key is the MarvelCDB card code.
- **`hero_identities`** — Each form/side of a hero (hero, alter_ego, hero_2…). Multiple per hero.
- **`deck_cards`** — All playable cards (ally, event, support, upgrade, resource, player_side_scheme). Cards with `hero_id` set are hero-specific (only playable with that hero).

### Auth

`auth-astro` wraps Auth.js. The integration **must be listed in `astro.config.mjs` integrations** (not just imported in `auth.config.ts`) — this is what exposes the `auth:config` virtual module. OAuth upserts the user to Postgres inside the `jwt` callback in `auth.config.ts`; the resulting DB user id is stored as `token.dbUserId` and forwarded to `session.user.id`.

Helper functions live in `src/lib/auth.ts`:
- `getUser(context)` — returns session user or null
- `requireAuth(context)` — redirects to sign-in if unauthenticated

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

### Database Schema Notes

- `DeckCard.isPermanent` — sourced from `card.permanent` in the MarvelCDB API. When adding new fields from the API, also add them to the `hashData` object in `sync-cards.mjs` so the sync detects the change.
- Faction codes from MarvelCDB map to the `Aspect` enum via `FACTION_TO_ASPECT` in the sync script. Cards with `faction_code === 'hero'` are hero-specific.
- Cards from modular/villain/scenario/campaign set types are excluded from `deck_cards`.

### Shared Card Utilities (`src/lib/cardFormatting.ts`)

Common formatting helpers used across components and pages:

- `formatCardText(text)` — converts `[[bold]]` syntax and `[energy]`/`[wild]` icons to HTML
- `formatType(t)` — converts snake_case type strings to Title Case ("player_side_scheme" → "Player Side Scheme")
- `TYPE_COLOR` — Tailwind bg-class map keyed by card type (ally, event, support, upgrade, resource, player_side_scheme)
- `COST_BUCKETS` — `[0,1,2,3,4,5,6] as const` tuple used for cost curve charts

Import from here; do not re-implement in components.

### TypeScript

Use TypeScript everywhere possible. Regular `<script>` tags in `.astro` files (without `is:inline`) **are** processed by Vite and support TypeScript and ES module imports — use them for page-level client logic. Only avoid `is:inline`, which strips TypeScript/module processing entirely. Prefer a React component (`client:load`) or a `.ts` module for anything complex.

### Planned Features (not yet built)

- `/sessions` — Multiplayer deck-building sessions
