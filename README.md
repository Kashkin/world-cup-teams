# World Cup 2026 — My Teams

A small SvelteKit app for picking and ranking your favourite teams from the 48 nations
qualified for the 2026 FIFA World Cup. Drag-to-reorder, persists locally, sharable via
URL, prints to a clean single-column ranking.

## Stack

- **SvelteKit 2** + Svelte 5 (runes), `adapter-static` → static SPA
- **Tailwind v4** + **shadcn-svelte** (dark theme, magenta accent, Bebas Neue + Permanent Marker for display)
- **`runed.PersistedState`** for localStorage-backed reactive state
- **`svelte-dnd-action`** for drag-to-reorder
- **`@lucide/svelte`** for icons (deep-imported per CLAUDE.md)
- **`zod`** to validate scraped data
- **Vitest** (unit) + **Playwright** (e2e)
- **pnpm** + Node 24+ (see `.nvmrc`)

## Getting started

```bash
nvm use            # picks up Node 24 from .nvmrc
pnpm install
pnpm dev           # http://localhost:5173
```

Other scripts:

| Command                            | What                                                                 |
| ---------------------------------- | -------------------------------------------------------------------- |
| `pnpm dev`                         | Vite dev server with HMR                                             |
| `pnpm build`                       | Production build → `build/`                                          |
| `pnpm preview`                     | Serve `build/` locally                                               |
| `pnpm check`                       | `svelte-check` (typecheck)                                           |
| `pnpm lint`                        | ESLint                                                               |
| `pnpm format`                      | Prettier write                                                       |
| `pnpm format:check`                | Prettier check (used by lefthook)                                    |
| `pnpm test:unit` / `pnpm test:e2e` | Vitest + Playwright                                                  |
| `pnpm test`                        | both                                                                 |
| `pnpm fetch:teams`                 | re-assemble `data/teams.json` from `data/teams.csv` + download flags |

## Project layout

```
data/
  teams.csv              canonical hand-curated team data (source of truth)
  teams.json             assembled output, imported by the app
  quotes.json            random quote pool for the squad-section callout
  rankings.html          snapshot of the FIFA Rankings table (input to load-rankings.ts)
scripts/
  teams-2026.ts          48-team constants table (codes, names, slugs, flag filenames)
  fetch-teams.ts         reads teams.csv, downloads flag SVGs from Wikimedia, emits teams.json
  fetch-from-results.ts  pivot: regenerates stats from martj42/international_results CSV
  load-rankings.ts       parses rankings.html → adds 'ranking' column to teams.csv
src/
  lib/
    types.ts             Team type + Zod schema
    teams.ts             import + validate teams.json, expose teams[] + teamsByCode
    ranking.ts           URL-hash encode/decode (with tests)
    quotes.ts            random-quote helper over data/quotes.json
    transitions.ts       crossfade pair shared between pool ↔ ranked
    components/
      TeamCard.svelte    flag, name, stats, conf badge, optional actions snippet
      UnrankedPool.svelte
      RankedList.svelte  squad header, dnd-zone, accent cards, empty state, quote callout
      SoccerBall.svelte
  routes/
    +layout.svelte       SEO meta + favicons + manifest
    +page.svelte         the only route — pool + squad grid
e2e/
  ranking.e2e.ts         5 Playwright scenarios
static/
  flags/                 48 team flag SVGs (downloaded once by fetch-teams.ts)
  world-cup-hero.png     hero image
  favicon.svg, .ico, ...
docs/plans/              design + implementation plans (mirror of Obsidian)
```

## Data — how to refresh

`data/teams.csv` is the source of truth. It's CSV so it can be edited directly in any
spreadsheet/text editor.

**Columns:** `code, name, confederation, ranking, appearances, trophies, lastTrophy, matchWins, bestFinish`

After editing the CSV, regenerate the JSON the app uses:

```bash
pnpm fetch:teams
```

That script:

1. Reads `data/teams.csv` and validates each row with Zod
2. Downloads each team's flag SVG from Wikimedia Commons (URLs derived from `scripts/teams-2026.ts`)
3. Writes `data/teams.json` sorted by FIFA ranking (nulls last)

### Re-deriving stats from scratch

Two helper scripts can rebuild parts of the CSV from upstream sources:

- `pnpm exec tsx scripts/fetch-from-results.ts` — pulls every WC match ever played
  from [martj42/international_results](https://github.com/martj42/international_results),
  aggregates per-team stats (appearances, wins, trophies, lastTrophy, bestFinish), and
  writes a candidate `data/teams-pivot.csv`. Hand-merge into `teams.csv` if the numbers
  look better than what's there.
- `pnpm exec tsx scripts/load-rankings.ts` — re-parses `data/rankings.html` (a saved
  copy of the FIFA Men's World Ranking table from fifa.com) and updates the `ranking`
  column in `teams.csv`. Replace `rankings.html` with a fresh save from DevTools when
  rankings update.

### Editing quotes

`data/quotes.json` is the random-quote pool. Format: `{ "text": "...", "author": "Name" | null }`.
A new pick rotates in on every page load.

## State, share links, persistence

- **State:** a single `string[]` of FIFA codes is the source of truth; everything else (flags,
  stats) is derived from `teamsByCode`.
- **Persistence:** `runed.PersistedState` mirrors `wc26.ranking` to localStorage and syncs
  across tabs.
- **Sharing:** the URL hash always reflects the current ranking (`#r=ARG,BRA,FRA…`). Click
  Share to copy the URL.
- **Preview mode:** opening a `#r=...` URL on a device that already has a saved list shows
  the shared ranking with a banner — `Save as mine` adopts it, `Restore mine` reverts.
  Implicit save on any edit.

## Deployment

Targets Vercel via `adapter-static`. Drop the repo into Vercel, set the framework to SvelteKit
(auto-detected), build command `pnpm build`, output `build`.

Before deploying, update `SITE_URL` in `src/routes/+layout.svelte` to the real domain — it's
used for `og:url`, `og:image`, and `<link rel="canonical">`.

## Testing

```bash
pnpm test          # unit + e2e
pnpm test:unit     # vitest only
pnpm test:e2e      # playwright only
```

Hooks: lefthook runs `pnpm lint` + `pnpm format:check` pre-commit. `.claude/settings.json`
auto-formats on every save in Claude Code.

## Conventions

- ESM only (`"type": "module"`); use `import type` for type-only imports
- Avoid `any` — use `unknown` + narrowing
- Lucide icons are deep-imported (`import Camera from '@lucide/svelte/icons/camera'`); the
  barrel import is banned via `no-restricted-imports`
- Tailwind classes follow shadcn theming — see `src/routes/layout.css` for the OKLCH palette
- shadcn-svelte components in `src/lib/components/ui/` are vendored as-shipped; eslint
  disables `svelte/no-navigation-without-resolve` for that path
