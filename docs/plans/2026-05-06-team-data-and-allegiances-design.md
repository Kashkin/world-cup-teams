---
status: design
date: 2026-05-06
project: world-cup-2026
---

# World Cup 2026 — Team Data & Allegiances App — Design

## Goal

Two artefacts:

1. A dataset of all 48 teams qualified for the 2026 FIFA World Cup with: confederation, current FIFA ranking, appearances, trophies, last trophy, total match wins at WC, best-ever finish.
2. A small SvelteKit app where a user picks any number of teams and orders them as their "favourite teams" list. Persists locally. Shareable via URL. Printable.

Hosted on Vercel. No backend. No data storage.

## Stack

- SvelteKit + `adapter-static`
- Tailwind + shadcn-svelte
- `svelte-dnd-action` for drag-and-drop reorder
- `runed` (`PersistedState`) for localStorage-bound reactive state
- `tsx` to run the scraper script via `pnpm fetch:teams`
- `wtf_wikipedia` to parse Wikipedia wikitext into typed tables/infoboxes
- `zod` to validate scraped output
- pnpm for package management

## Repo layout

```
world-cup-2026/
├── scripts/
│   └── fetch-teams.ts        # one-shot scraper
├── data/
│   ├── teams.json            # canonical, committed
│   └── teams.csv             # exported alongside, committed
├── src/
│   ├── lib/teams.ts          # imports data/teams.json, exports typed Team[]
│   ├── lib/ranking.ts        # URL-hash encode/decode, share helpers
│   ├── lib/components/
│   │   ├── TeamCard.svelte
│   │   ├── UnrankedPool.svelte
│   │   └── RankedList.svelte
│   └── routes/+page.svelte   # the only page
├── static/
│   └── flags/                # SVGs downloaded by the scraper
└── svelte.config.js
```

The scraper and the app are independent — the app never makes network calls at runtime, it just imports `data/teams.json`. The scraper runs by hand when data needs refreshing.

## Data

```ts
type Team = {
  code: string; // 3-letter FIFA code, e.g. "ARG" — primary key
  name: string; // "Argentina"
  confederation: 'AFC' | 'CAF' | 'CONCACAF' | 'CONMEBOL' | 'OFC' | 'UEFA';
  flag: string; // /flags/arg.svg
  ranking: number | null; // current FIFA ranking
  appearances: number; // count incl. 2026
  trophies: number; // WC titles
  lastTrophy: number | null; // year, null if never won
  matchWins: number; // total WC matches won, all time
  bestFinish:
    | 'Champion'
    | 'Runner-up'
    | 'Third'
    | 'Fourth'
    | 'Quarter-finals'
    | 'Round of 16'
    | 'Group stage';
};
```

Decisions baked in:

- **3-letter FIFA code as PK** — short, stable, URL-friendly. Share URL stays well under 200 chars even for full 48-team rankings.
- **`bestFinish` as string union** rather than numeric round — both FIFA and Wikipedia report it textually, and it's easier to render.
- **`appearances` includes 2026** — they've all qualified, so it's `historical + 1`. Scraper enforces consistently.
- **No "qualified for 2026" boolean** — the dataset _is_ the qualified teams.

`teams.csv` is a flat dump of the same fields, sorted by `ranking` ascending, nulls last.

## Scraper

`scripts/fetch-teams.ts`, run via `pnpm fetch:teams` (which calls `tsx scripts/fetch-teams.ts`). Imperative, top-to-bottom.

**Why Wikipedia, not FIFA.** FIFA's `cxm-api.fifa.com` listing endpoint exists and is open, but at the time of writing it returns only 28 of 48 teams (UEFA almost entirely missing) and the per-team data is unstructured prose inside news articles. Wikipedia's "{Country} at the FIFA World Cup" pages all have the same templated table — Year / Round / Position / Pld / W / D / L / GF / GA — from which every historical field falls out cleanly.

**Sources:**

- `https://en.wikipedia.org/w/api.php?action=parse&page={slug}&format=json&prop=wikitext` — wikitext for each team's WC history page and each team's national-team page.
- `wtf_wikipedia` (npm) parses the wikitext into typed access to `.tables()`, `.infobox()`, etc. Avoids hand-rolled regex.
- A hand-curated `WC2026_TEAMS` constants table in the script: 48 entries of `{ code, name, confederation, flagSlug, wpHistorySlug, wpTeamSlug }`. ~30 minutes to assemble; stable.

**Steps:**

1. **Define the constants table.** 48 hand-curated entries with FIFA codes, confederation, and Wikipedia article slugs. Source list: Wikipedia's "2026 FIFA World Cup" article.
2. **For each team, fetch the "X at the FIFA World Cup" wikitext.** Parse the results-by-tournament table → derive `appearances` (row count + 1 for 2026), `trophies`, `lastTrophy`, `matchWins`, `bestFinish`. First-time qualifiers (no such page exists) get sensible defaults (0 / null / "Group stage").
3. **For each team, fetch the "{Country} national football team" wikitext.** Pull current FIFA ranking from the infobox.
4. **Validate on a small representative subset before scaling.** Run the parser against 4 teams that exercise different shapes — Brazil (5-time champion, max stats), England (1 trophy, mid-tier), Senegal (group-stage history, no trophy), Cabo Verde (first-time qualifier, no history page). Eyeball the output. Fix the parser before fanning out.
5. **Run on all 48.** Throttle 200 ms between requests.
6. **Download flag SVGs** from Wikimedia (consistent URL pattern keyed by FIFA code) into `static/flags/<code>.svg`.
7. **Validate** with a Zod schema. Script exits non-zero if any team is missing any required field.
8. **Write** `data/teams.json` (sorted by ranking) and `data/teams.csv`.
9. **Print summary** — counts, any nulls.

No retries, no caching, no test suite — re-run the whole script if it flakes. ~50 + 50 requests at 200 ms each is ~20 seconds.

**FIFA still useful for:** sanity-checking ranking and confederation against Wikipedia (Wikipedia infobox values can lag). Optional cross-check; not load-bearing.

## App — components

Single route, `src/routes/+page.svelte`. Two-column layout collapsing to stacked on mobile.

```
┌────────────────────────────────────────────────────────────┐
│  Header: title · Share · Print · Reset                     │
├──────────────────────────┬─────────────────────────────────┤
│  UnrankedPool            │  RankedList                     │
│  [search]                │  1. Argentina         [↑][↓][×] │
│  • Algeria        [+]    │  2. Brazil            [↑][↓][×] │
│  • Australia      [+]    │  ...                            │
│  ... (drag source)       │  (drag target + reorderable)    │
└──────────────────────────┴─────────────────────────────────┘
```

- **`<TeamCard>`** — flag, name, confederation badge, ranking pill. Pure props.
- **`<UnrankedPool>`** — fuzzy filter on name/code/confederation. Lists teams not currently ranked. Each card has a `+` button (mobile) and is a drag source (desktop).
- **`<RankedList>`** — ordered list with up/down/× per row (mobile), drag-reorderable (desktop, `svelte-dnd-action`).
- **Header buttons:**
  - **Share** — copies the current URL (which already encodes the ranking) and toasts "Copied".
  - **Print** — `window.print()`.
  - **Reset** — shadcn confirm dialog → clear ranking + localStorage.

Single source of truth: a `string[]` of FIFA codes, in order. `UnrankedPool` is `teams.filter(t => !ranking.current.includes(t.code))`.

## Persistence & sharing

State lives in a `runed.PersistedState` instance keyed `wc26.ranking`. That handles localStorage read/write and cross-tab sync automatically.

```ts
import { PersistedState } from 'runed';
const ranking = new PersistedState<string[]>('wc26.ranking', []);
```

A `$effect` mirrors `ranking.current` into `location.hash` (`#r=ARG,BRA,FRA,…`) so the address bar always reflects the current state — Share is just `navigator.clipboard.writeText(location.href)`.

**Boot logic** (runs in `onMount`, since SSR can't read `localStorage` or `location`):

- If `location.hash` is present:
  - If `localStorage` is empty → adopt the shared ranking as the user's own.
  - If `localStorage` has a non-empty list → enter **preview mode**: show the shared ranking with a banner _"You're viewing a shared list. [Save as mine] · [Restore mine]"_. Don't write to localStorage until [Save as mine] is clicked.
- Else: use whatever `PersistedState` loaded.

**Note on runed API:** verify the `PersistedState` constructor signature against the README at install time — it has shifted across runed versions.

## Print stylesheet

`@media print` rules in `app.css`:

- **Hide:** unranked pool, header buttons, search, +/×/up-down controls, hover states.
- **Show:** title, ranked list, generated date footer.
- **Layout:** single column, full width. Each row: `1. 🇦🇷 Argentina · CONMEBOL · #1`. Flags inlined as SVG so they print.
- **Page setup:** `@page { margin: 1.5cm; }`. `break-inside: avoid` on rows.
- `print-color-adjust: exact` so confederation badges/flags render in colour.

~30 lines of CSS, sits in the global stylesheet.

## Testing

Light.

- **Scraper:** `zod` validates output at the end of the script. The committed JSON is the test artefact — eyeball it once on first generation, commit, trust thereafter. No unit tests.
- **App:** Playwright e2e covers three flows:
  1. Add 3 teams from pool → ranking shows 3 in order, URL hash updates.
  2. Reload → ranking restored from localStorage.
  3. Open URL with `#r=ARG,BRA` while another list is saved → preview banner appears; `[Save as mine]` persists, `[Restore mine]` reverts.

No component-level unit tests — components are thin enough that e2e covers them.

## Open / deferred

- **Constants table assembly.** 48 hand-curated rows mapping FIFA code, confederation, and Wikipedia slugs. First task of Phase 2 in the plan.
- **First-time qualifiers.** Cabo Verde is the obvious one; Curaçao, Uzbekistan, and Jordan are also candidates. Their "X at the FIFA World Cup" pages may not exist — the scraper handles 404 as "no historical data" rather than as an error. Confirm during the small-set validation step.
- **Best-finish tie-breaking.** A team that reached the SF in 1990 and a team that reached the SF in 2022 both report "Semi-finals" — fine, but if we ever want to add "year of best finish" this is the place to extend. Not in scope.
- **Confederation icons / colour palette.** Visual polish for `TeamCard` — defer to implementation, not blocking design.
