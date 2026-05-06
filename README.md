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

## Testing

```bash
pnpm test          # unit + e2e
pnpm test:unit     # vitest only
pnpm test:e2e      # playwright only
```

## Conventions

- ESM only (`"type": "module"`); use `import type` for type-only imports
- Avoid `any` — use `unknown` + narrowing
- Lucide icons are deep-imported (`import Camera from '@lucide/svelte/icons/camera'`); the
  barrel import is banned via `no-restricted-imports`
- Tailwind classes follow shadcn theming — see `src/routes/layout.css` for the OKLCH palette
- shadcn-svelte components in `src/lib/components/ui/` are vendored as-shipped; eslint
  disables `svelte/no-navigation-without-resolve` for that path
