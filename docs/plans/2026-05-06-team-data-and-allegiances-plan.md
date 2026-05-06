---
status: plan
date: 2026-05-06
project: world-cup-2026
design: [[2026-05-06-team-data-and-allegiances-design]]
---

# World Cup 2026 — Team Data & Allegiances Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Scrape the 48 qualified WC2026 teams from Wikipedia into a committed JSON+CSV dataset, then ship a SvelteKit static site that lets a user pick and rank their favourite teams (drag/tap), persist locally via `runed.PersistedState`, share via URL hash, and print.

**Architecture:** Single SvelteKit project. Scraper is `scripts/fetch-teams.ts` run by hand via `pnpm fetch:teams`; output (`data/teams.json`, `data/teams.csv`, `static/flags/*.svg`) is committed. App imports `data/teams.json` at build time — zero runtime network calls. State is a single `string[]` of FIFA codes mirrored to localStorage (via `runed`) and `location.hash` (for share links). Two-column UI (pool + ranking) collapses to stacked on mobile. Deployed to Vercel via `adapter-static`.

**Tech Stack:** SvelteKit 2 + Svelte 5 (runes) · `adapter-static` · Tailwind v4 · shadcn-svelte · `svelte-dnd-action` · `runed` · `wtf_wikipedia` · `zod` · `tsx` · pnpm · Playwright (e2e).

**Related skills:** `@ts-scaffolding:ts-sveltekit` for the scaffold step. `@playwright-e2e` for the test suite. `@make-interfaces-feel-better` for visual polish in the UI tasks. `@superpowers:test-driven-development` for the scraper and helpers (skip TDD for thin UI components — covered by e2e instead).

**Conventions used in this plan:**

- `wc26/` is the working directory `/Users/nick.rogers/Code/world-cup-2026`.
- File paths are relative to that directory.
- Each task ends with a commit. Commits use Conventional Commits prefixes.

---

## Phase 1 — Scaffold

### Task 1: Scaffold SvelteKit + base config

**Skill:** Use `@ts-scaffolding:ts-sveltekit`. It will route via `ts-base` first, then run `sv create`, then offer the integration menu.

**Step 1: Run the scaffold**

In `wc26/` (currently empty):

```bash
cd /Users/nick.rogers/Code/world-cup-2026
```

Invoke the scaffold skill. When it asks integrations, select: **Tailwind, Playwright, shadcn-svelte**. Skip Storybook.

**Step 2: Verify dev server runs**

```bash
pnpm dev
```

Open `http://localhost:5173`. Expected: SvelteKit welcome page renders. Stop the server.

**Step 3: Switch to adapter-static**

Install:

```bash
pnpm remove @sveltejs/adapter-auto
pnpm add -D @sveltejs/adapter-static
```

Edit `svelte.config.js`:

```js
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({ fallback: 'index.html' }),
  },
};
```

Add to `src/routes/+layout.ts`:

```ts
export const prerender = true;
```

**Step 4: Verify build still works**

```bash
pnpm build
```

Expected: builds to `build/` with no errors.

**Step 5: Commit**

```bash
git init
git add -A
git commit -m "chore: scaffold sveltekit with tailwind, shadcn, playwright, adapter-static"
```

---

### Task 2: Add app dependencies

**Files:**

- Modify: `package.json`

**Step 1: Install runtime + dev deps**

```bash
pnpm add runed svelte-dnd-action
pnpm add -D zod wtf_wikipedia tsx @types/node
```

Read each README before relying on the API:

- `node_modules/runed/README.md` — confirm `PersistedState` import path and constructor signature
- `node_modules/svelte-dnd-action/README.md` — confirm `dndzone` action usage with Svelte 5
- `node_modules/wtf_wikipedia/README.md` — confirm the `tables()` and `infobox()` access pattern

Note in this plan if any API differs from what the design assumed.

**Step 2: Add scripts to `package.json`**

Add under `"scripts"`:

```json
"fetch:teams": "tsx scripts/fetch-teams.ts"
```

**Step 3: Verify type-check passes**

```bash
pnpm check
```

Expected: 0 errors, 0 warnings.

**Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add runed, svelte-dnd-action, zod, tsx"
```

---

## Phase 2 — Scraper

### Task 3: Define `Team` type and Zod schema

**Files:**

- Create: `src/lib/types.ts`

**Step 1: Write the file**

```ts
import { z } from 'zod';

export const ConfederationSchema = z.enum(['AFC', 'CAF', 'CONCACAF', 'CONMEBOL', 'OFC', 'UEFA']);

export const BestFinishSchema = z.enum([
  'Champion',
  'Runner-up',
  'Third',
  'Fourth',
  'Quarter-finals',
  'Round of 16',
  'Group stage',
]);

export const TeamSchema = z.object({
  code: z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/),
  name: z.string().min(1),
  confederation: ConfederationSchema,
  flag: z.string().startsWith('/flags/'),
  ranking: z.number().int().positive().nullable(),
  appearances: z.number().int().nonnegative(),
  trophies: z.number().int().nonnegative(),
  lastTrophy: z.number().int().min(1930).max(2026).nullable(),
  matchWins: z.number().int().nonnegative(),
  bestFinish: BestFinishSchema,
});

export type Team = z.infer<typeof TeamSchema>;
export type Confederation = z.infer<typeof ConfederationSchema>;
export type BestFinish = z.infer<typeof BestFinishSchema>;
```

**Step 2: Verify types compile**

```bash
pnpm check
```

Expected: pass.

**Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: define Team type and zod schema"
```

---

### Task 4: Build the `WC2026_TEAMS` constants table

**Files:**

- Create: `scripts/teams-2026.ts`

The qualified-teams list is hand-curated: 48 entries each with FIFA code, name, confederation, and the two Wikipedia article slugs we'll need. This is the source of truth for _which teams_ the scraper processes; Wikipedia provides the _stats_ per team.

**Step 1: Source the team list**

Open `https://en.wikipedia.org/wiki/2026_FIFA_World_Cup` (server-rendered, real HTML). Find the "Qualified teams" table. Confirm 48 rows. Note any first-time qualifiers (no historical WC page).

**Step 2: Write the constants file**

```ts
// scripts/teams-2026.ts
export type Wc2026Entry = {
  code: string; // 3-letter FIFA code, e.g. "ARG"
  name: string; // display name, e.g. "Argentina"
  confederation: 'AFC' | 'CAF' | 'CONCACAF' | 'CONMEBOL' | 'OFC' | 'UEFA';
  wpHistory: string | null; // Wikipedia slug for "X at the FIFA World Cup", or null for first-timers
  wpTeam: string; // Wikipedia slug for "X national football team"
};

export const WC2026_TEAMS: Wc2026Entry[] = [
  {
    code: 'ARG',
    name: 'Argentina',
    confederation: 'CONMEBOL',
    wpHistory: 'Argentina_at_the_FIFA_World_Cup',
    wpTeam: 'Argentina_national_football_team',
  },
  {
    code: 'BRA',
    name: 'Brazil',
    confederation: 'CONMEBOL',
    wpHistory: 'Brazil_at_the_FIFA_World_Cup',
    wpTeam: 'Brazil_national_football_team',
  },
  // ... 46 more rows
  {
    code: 'CPV',
    name: 'Cabo Verde',
    confederation: 'CAF',
    wpHistory: null, // first WC qualification
    wpTeam: 'Cape_Verde_national_football_team',
  },
];
```

Aim for slug accuracy — open each URL in the browser to confirm before committing the row. Wikipedia redirects gracefully but it's worth getting right.

**Step 3: Verify count and uniqueness**

Add a temporary check at the bottom of the file (or a one-off `tsx -e`):

```ts
if (WC2026_TEAMS.length !== 48) throw new Error(`expected 48, got ${WC2026_TEAMS.length}`);
const codes = new Set(WC2026_TEAMS.map((t) => t.code));
if (codes.size !== 48) throw new Error('duplicate FIFA codes');
```

**Step 4: Commit**

```bash
git add scripts/teams-2026.ts
git commit -m "feat(scraper): add 48-team WC2026 constants table"
```

---

### Task 5: Scraper skeleton — fetch and parse one team

**Files:**

- Create: `scripts/fetch-teams.ts`

Build the parser end-to-end against **Brazil only** first. Get the parse correct on one team before generalising.

**Step 1: Set up wiki fetcher**

```ts
// scripts/fetch-teams.ts
import { writeFile, mkdir } from 'node:fs/promises';
import wtf from 'wtf_wikipedia';
import { TeamSchema, type Team, type BestFinish } from '../src/lib/types.ts';
import { WC2026_TEAMS, type Wc2026Entry } from './teams-2026.ts';

const UA = 'world-cup-2026-research/0.1 (nick.rogers@portable.com.au)';

async function fetchWikitext(slug: string): Promise<string | null> {
  const url = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(slug)}&format=json&prop=wikitext&redirects=1`;
  const res = await fetch(url, { headers: { 'user-agent': UA } });
  if (!res.ok) return null;
  const json = (await res.json()) as { parse?: { wikitext: { '*': string } } };
  return json.parse?.wikitext['*'] ?? null;
}
```

**Step 2: Parse the results-by-tournament table**

The table has columns Year / Round / Position / Pld / W / D / L / GF / GA. It's the first sortable wikitable on the "X at the FIFA World Cup" page. Use `wtf_wikipedia` to access it:

```ts
const ROUND_TO_FINISH: Record<string, BestFinish> = {
  Champions: 'Champion',
  'Runners-up': 'Runner-up',
  'Third place': 'Third',
  'Fourth place': 'Fourth',
  'Quarter-finals': 'Quarter-finals',
  'Round of 16': 'Round of 16',
  // historical names
  'Second round': 'Round of 16',
  'First round': 'Group stage',
  'Group stage': 'Group stage',
};

const FINISH_RANK: Record<BestFinish, number> = {
  Champion: 1,
  'Runner-up': 2,
  Third: 3,
  Fourth: 4,
  'Quarter-finals': 5,
  'Round of 16': 6,
  'Group stage': 7,
};

type Historical = {
  appearances: number;
  trophies: number;
  lastTrophy: number | null;
  matchWins: number;
  bestFinish: BestFinish;
};

function parseHistorical(wikitext: string): Historical {
  const doc = wtf(wikitext);
  const tables = doc.tables();
  // The first table whose header includes 'Year' AND 'W' AND 'Round' is ours.
  const table = tables.find((t) => {
    const keys = Object.keys(t.json()[0] ?? {});
    return keys.includes('Year') && keys.includes('Round') && keys.includes('W');
  });
  if (!table) throw new Error('results-by-tournament table not found');

  const rows = table.json() as Array<Record<string, { text: string }>>;
  // Filter out any "Total" footer row by requiring a parseable year.
  const yearRows = rows
    .map((r) => ({
      year: parseInt(r['Year']?.text?.match(/\d{4}/)?.[0] ?? '', 10),
      round: r['Round']?.text?.replace(/'''/g, '').trim(),
      wins: parseInt(r['W']?.text ?? '0', 10),
    }))
    .filter((r) => Number.isFinite(r.year));

  const champYears = yearRows.filter((r) => r.round === 'Champions').map((r) => r.year);
  const finishes = yearRows.map((r) => ROUND_TO_FINISH[r.round ?? ''] ?? 'Group stage');
  const bestFinish = finishes.reduce<BestFinish>(
    (best, f) => (FINISH_RANK[f] < FINISH_RANK[best] ? f : best),
    'Group stage',
  );

  return {
    appearances: yearRows.length, // historical only — +1 for 2026 added later
    trophies: champYears.length,
    lastTrophy: champYears.length ? Math.max(...champYears) : null,
    matchWins: yearRows.reduce((sum, r) => sum + r.wins, 0),
    bestFinish,
  };
}
```

**Step 3: Run end-to-end on Brazil**

```ts
async function main() {
  const brazil = WC2026_TEAMS.find((t) => t.code === 'BRA')!;
  const wt = await fetchWikitext(brazil.wpHistory!);
  if (!wt) throw new Error('no wikitext for Brazil');
  const historical = parseHistorical(wt);
  console.log('Brazil historical:', historical);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

```bash
pnpm fetch:teams
```

Expected output (verified against Wikipedia text in research):

```
Brazil historical: {
  appearances: 22,
  trophies: 5,
  lastTrophy: 2002,
  matchWins: 76,
  bestFinish: 'Champion'
}
```

If the numbers are off, adjust the parser before continuing. Common issues: the table includes a "Total" footer row (filter by valid year), or `'''Champions'''` markup needs stripping (handled by the regex above).

**Step 4: Commit**

```bash
git add scripts/fetch-teams.ts
git commit -m "feat(scraper): parse historical WC stats for one team"
```

---

### Task 6: Validate the parser on a representative subset

Before running across all 48 teams, exercise the parser on four teams that probe different shapes. **This is the gate** — only proceed to Task 7 if all four parse correctly.

**Test set:**

| Team             | Why                                      | Expected                                                                  |
| ---------------- | ---------------------------------------- | ------------------------------------------------------------------------- |
| Brazil (BRA)     | Top of every column                      | apps 22, trophies 5, lastTrophy 2002, wins 76, finish Champion            |
| England (ENG)    | Single trophy, mid-volume                | apps ~16, trophies 1, lastTrophy 1966, wins ~30, finish Champion          |
| Senegal (SEN)    | No trophy, group/QF history              | apps 3, trophies 0, lastTrophy null, wins ~3, finish Quarter-finals       |
| Cabo Verde (CPV) | First-time qualifier — `wpHistory: null` | apps 0, trophies 0, lastTrophy null, wins 0, finish Group stage (default) |

**Step 1: Wire the subset run**

```ts
async function parseOne(entry: Wc2026Entry): Promise<Historical> {
  if (!entry.wpHistory) {
    return {
      appearances: 0,
      trophies: 0,
      lastTrophy: null,
      matchWins: 0,
      bestFinish: 'Group stage',
    };
  }
  const wt = await fetchWikitext(entry.wpHistory);
  if (!wt) {
    console.warn(`  no wikitext for ${entry.code}; treating as no history`);
    return {
      appearances: 0,
      trophies: 0,
      lastTrophy: null,
      matchWins: 0,
      bestFinish: 'Group stage',
    };
  }
  return parseHistorical(wt);
}

async function main() {
  const codes = ['BRA', 'ENG', 'SEN', 'CPV'];
  for (const code of codes) {
    const entry = WC2026_TEAMS.find((t) => t.code === code)!;
    const h = await parseOne(entry);
    console.log(code, h);
  }
}
```

**Step 2: Run**

```bash
pnpm fetch:teams
```

**Step 3: Compare each team's output to the expected values above.** Where they don't match, fix `parseHistorical()` before continuing. Common adjustments:

- **Round-name aliases** that the table uses (e.g. "Eighth-finals" instead of "Round of 16") — extend `ROUND_TO_FINISH`.
- **Tied/reordered columns** in older articles — log the table headers if `find()` returns nothing.
- **Multi-row "Did not qualify" entries** — these have no integer year and should already be filtered, but verify.

Once all four match, this gate is passed.

**Step 4: Commit**

```bash
git add scripts/fetch-teams.ts
git commit -m "test(scraper): validate parser on representative subset"
```

---

### Task 7: Run the parser across all 48 teams

**Files:**

- Modify: `scripts/fetch-teams.ts`

**Step 1: Replace the subset loop with the full run**

```ts
async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const historicalByCode = new Map<string, Historical>();
  for (const entry of WC2026_TEAMS) {
    process.stdout.write(`  ${entry.code} ${entry.name}... `);
    const h = await parseOne(entry);
    historicalByCode.set(entry.code, h);
    console.log(
      `apps=${h.appearances} trophies=${h.trophies} wins=${h.matchWins} best=${h.bestFinish}`,
    );
    await sleep(200);
  }
  console.log(`\nParsed historical stats for ${historicalByCode.size} teams.`);
}
```

**Step 2: Run**

```bash
pnpm fetch:teams
```

Expected: a line per team, ~10 seconds total. Eyeball the output for plausibility — flag any team whose numbers look off (e.g. `apps=0` for a team with known WC history, `trophies=2` for someone other than France/Uruguay).

**Step 3: Commit**

```bash
git add scripts/fetch-teams.ts
git commit -m "feat(scraper): parse historical stats for all 48 teams"
```

---

### Task 8: Add FIFA ranking from national-team article

**Files:**

- Modify: `scripts/fetch-teams.ts`

The "{Country} national football team" article has the current FIFA ranking in its infobox. Pull it.

**Step 1: Add infobox parser**

```ts
function parseRanking(wikitext: string): number | null {
  const doc = wtf(wikitext);
  const infobox = doc.infobox();
  if (!infobox) return null;
  const fields = infobox.json() as Record<string, { text?: string }>;
  // Common keys: 'fifa rank', 'FIFA Rank', 'fifa_rank'. Normalise.
  for (const [key, value] of Object.entries(fields)) {
    if (/fifa.*rank/i.test(key) && value?.text) {
      const m = value.text.match(/^\s*(\d+)/);
      if (m) return parseInt(m[1], 10);
    }
  }
  return null;
}

async function fetchRanking(entry: Wc2026Entry): Promise<number | null> {
  const wt = await fetchWikitext(entry.wpTeam);
  if (!wt) return null;
  return parseRanking(wt);
}
```

**Step 2: Wire into main loop**

```ts
const rankingByCode = new Map<string, number | null>();
for (const entry of WC2026_TEAMS) {
  const r = await fetchRanking(entry);
  rankingByCode.set(entry.code, r);
  console.log(`  ${entry.code} ranking: ${r ?? '(unknown)'}`);
  await sleep(200);
}
```

**Step 3: Run and sanity-check**

```bash
pnpm fetch:teams
```

Expected: most teams have a ranking (top teams 1–30, qualifiers up to ~80). If a meaningful share are null, debug the infobox key matching — the field may live under "fifa_rank" with underscore or similar.

**Step 4: Commit**

```bash
git add scripts/fetch-teams.ts
git commit -m "feat(scraper): pull current FIFA ranking from infobox"
```

---

### Task 9: Download flag SVGs

**Files:**

- Modify: `scripts/fetch-teams.ts`
- Create: `static/flags/` (directory)

Wikimedia Commons hosts an SVG flag for every nation under a stable URL pattern. We bundle them locally so the app has zero runtime network deps.

**Step 1: Source the flag URLs**

Add a `flagUrl()` helper that returns the Wikimedia Commons URL for a given FIFA code. Easiest path: a hand-built map keyed by FIFA code → Wikimedia file name (e.g. `ARG → Flag_of_Argentina.svg`). Many will follow `Flag_of_<Country>.svg` but enough don't (USA → `Flag_of_the_United_States.svg`) that we maintain the map. Add it to `scripts/teams-2026.ts` as a `flagFile` field on `Wc2026Entry`.

```ts
// in teams-2026.ts, extend the type:
flagFile: string; // e.g. "Flag_of_Argentina.svg"
```

Wikimedia raster URL pattern (returns SVG when extension is .svg):

```
https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Flag_of_<X>.svg/1024px-Flag_of_<X>.svg.png
```

For our use we want the SVG directly. The MediaWiki API resolves the canonical URL:

```
https://en.wikipedia.org/w/api.php?action=query&titles=File:<flagFile>&prop=imageinfo&iiprop=url&format=json
```

**Step 2: Implement the downloader**

```ts
async function flagSvgUrl(flagFile: string): Promise<string> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&titles=File:${encodeURIComponent(flagFile)}&prop=imageinfo&iiprop=url&format=json`;
  const res = await fetch(url, { headers: { 'user-agent': UA } });
  const json = (await res.json()) as any;
  const pages = json.query?.pages ?? {};
  const page = Object.values(pages)[0] as any;
  const direct = page?.imageinfo?.[0]?.url;
  if (!direct) throw new Error(`flag URL not found for ${flagFile}`);
  return direct;
}

async function downloadFlag(entry: Wc2026Entry) {
  const url = await flagSvgUrl(entry.flagFile);
  const res = await fetch(url, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`flag fetch failed: ${entry.code}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await mkdir('static/flags', { recursive: true });
  await writeFile(`static/flags/${entry.code.toLowerCase()}.svg`, buf);
}
```

**Step 3: Run**

```bash
pnpm fetch:teams
ls static/flags | wc -l
```

Expected: 48 files. Open a few in the browser to confirm they render.

**Step 4: Commit**

```bash
git add scripts/fetch-teams.ts scripts/teams-2026.ts static/flags/
git commit -m "feat(scraper): download flag SVGs from Wikimedia Commons"
```

---

### Task 10: Write JSON + CSV outputs

**Files:**

- Modify: `scripts/fetch-teams.ts`

**Step 1: Assemble `Team[]`, validate, write**

Add at end of `main()`, after historical, ranking, and flags are collected:

```ts
import { z } from 'zod';

const teams: Team[] = WC2026_TEAMS.map((entry) => {
  const h = historicalByCode.get(entry.code)!;
  return {
    code: entry.code,
    name: entry.name,
    confederation: entry.confederation,
    flag: `/flags/${entry.code.toLowerCase()}.svg`,
    ranking: rankingByCode.get(entry.code) ?? null,
    appearances: h.appearances + 1, // include 2026
    trophies: h.trophies,
    lastTrophy: h.lastTrophy,
    matchWins: h.matchWins,
    bestFinish: h.bestFinish,
  };
});

const TeamsSchema = z.array(TeamSchema).length(48);
const validated = TeamsSchema.parse(teams);

const sorted = [...validated].sort((a, b) => {
  if (a.ranking == null && b.ranking == null) return a.name.localeCompare(b.name);
  if (a.ranking == null) return 1;
  if (b.ranking == null) return -1;
  return a.ranking - b.ranking;
});

await mkdir('data', { recursive: true });
await writeFile('data/teams.json', JSON.stringify(sorted, null, 2));

const csvHeader = [
  'code',
  'name',
  'confederation',
  'ranking',
  'appearances',
  'trophies',
  'lastTrophy',
  'matchWins',
  'bestFinish',
].join(',');
const csvRows = sorted.map((t) =>
  [
    t.code,
    JSON.stringify(t.name),
    t.confederation,
    t.ranking ?? '',
    t.appearances,
    t.trophies,
    t.lastTrophy ?? '',
    t.matchWins,
    JSON.stringify(t.bestFinish),
  ].join(','),
);
await writeFile('data/teams.csv', [csvHeader, ...csvRows].join('\n') + '\n');

console.log('\nSummary:');
console.log(`  Teams: ${sorted.length}`);
console.log(`  Without ranking: ${sorted.filter((t) => t.ranking == null).length}`);
console.log(`  Without trophy: ${sorted.filter((t) => t.lastTrophy == null).length}`);
console.log(`  First-time qualifiers: ${sorted.filter((t) => t.appearances === 1).length}`);
```

**Step 2: Run**

```bash
pnpm fetch:teams
```

Expected: `data/teams.json` and `data/teams.csv` written. Open both, eyeball:

- 48 entries
- Argentina near top by ranking
- Trophy count reasonable (Brazil 5, Germany 4, Italy 4, Argentina 3, France 2, Uruguay 2, England 1, Spain 1)
- Match wins reasonable (Brazil ~76, Germany ~70)
- First-time qualifiers count matches the qualifying summary on Wikipedia

**Step 3: Commit**

```bash
git add scripts/fetch-teams.ts data/teams.json data/teams.csv
git commit -m "feat(scraper): emit teams.json and teams.csv"
```

---

## Phase 3 — App data layer

### Task 11: Type-safe data import

**Files:**

- Create: `src/lib/teams.ts`

**Step 1: Write the file**

```ts
import { TeamSchema, type Team } from './types';
import raw from '../../data/teams.json';

export const teams: readonly Team[] = Object.freeze(raw.map((t) => TeamSchema.parse(t)));

export const teamsByCode: ReadonlyMap<string, Team> = new Map(teams.map((t) => [t.code, t]));
```

**Step 2: Enable JSON imports if needed**

Check `tsconfig.json` includes `"resolveJsonModule": true`. SvelteKit's default tsconfig usually does — verify.

**Step 3: Verify**

```bash
pnpm check
```

Expected: pass.

**Step 4: Commit**

```bash
git add src/lib/teams.ts
git commit -m "feat: typed data import"
```

---

### Task 12: URL-hash ranking codec — TDD

**Files:**

- Create: `src/lib/ranking.ts`
- Create: `src/lib/ranking.test.ts`
- Modify: `package.json` (add vitest if not present from scaffold)

**Step 1: Confirm vitest is set up**

If the SvelteKit scaffold didn't include vitest:

```bash
pnpm add -D vitest @vitest/ui
```

Add `"test:unit": "vitest"` to `package.json` scripts.

**Step 2: Write the failing test**

`src/lib/ranking.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { encodeRanking, decodeRanking } from './ranking';

describe('encodeRanking / decodeRanking', () => {
  it('round-trips a ranking', () => {
    const ranking = ['ARG', 'BRA', 'FRA'];
    expect(decodeRanking(encodeRanking(ranking))).toEqual(ranking);
  });

  it('encodes empty ranking as empty string', () => {
    expect(encodeRanking([])).toBe('');
  });

  it('decodes empty string as empty array', () => {
    expect(decodeRanking('')).toEqual([]);
  });

  it('decodes garbage input as empty array', () => {
    expect(decodeRanking('!@#$')).toEqual([]);
    expect(decodeRanking(null as any)).toEqual([]);
    expect(decodeRanking(undefined as any)).toEqual([]);
  });

  it('strips invalid codes', () => {
    expect(decodeRanking('ARG,xx,BRA,123')).toEqual(['ARG', 'BRA']);
  });
});
```

**Step 3: Run, expect failure**

```bash
pnpm test:unit -- --run
```

Expected: FAIL with "module not found".

**Step 4: Implement**

`src/lib/ranking.ts`:

```ts
const CODE_RE = /^[A-Z]{3}$/;

export function encodeRanking(ranking: readonly string[]): string {
  return ranking.filter((c) => CODE_RE.test(c)).join(',');
}

export function decodeRanking(input: string | null | undefined): string[] {
  if (!input) return [];
  return input.split(',').filter((c) => CODE_RE.test(c));
}
```

**Step 5: Run, expect pass**

```bash
pnpm test:unit -- --run
```

Expected: 5 tests pass.

**Step 6: Commit**

```bash
git add src/lib/ranking.ts src/lib/ranking.test.ts package.json pnpm-lock.yaml
git commit -m "feat: ranking url codec with tests"
```

---

## Phase 4 — App UI

These tasks build bottom-up. UI is verified manually in the browser; e2e tests come in Phase 6.

For visual polish across these tasks, apply principles from `@make-interfaces-feel-better` (tabular numerals for rank/ranking numbers, optical alignment, subtle shadows on cards).

### Task 13: `<TeamCard>` component

**Files:**

- Create: `src/lib/components/TeamCard.svelte`

**Step 1: Write the component**

```svelte
<script lang="ts">
  import type { Team } from '$lib/types';

  interface Props {
    team: Team;
    rank?: number; // optional position label
  }
  let { team, rank }: Props = $props();
</script>

<article class="flex items-center gap-3 rounded-lg border bg-card px-3 py-2 shadow-sm">
  {#if rank != null}
    <span class="tabular-nums text-muted-foreground w-6 text-right">{rank}.</span>
  {/if}
  <img src={team.flag} alt="" class="size-6 rounded-sm" />
  <span class="font-medium flex-1">{team.name}</span>
  <span class="text-xs text-muted-foreground">{team.confederation}</span>
  {#if team.ranking != null}
    <span class="tabular-nums text-xs text-muted-foreground">#{team.ranking}</span>
  {/if}
</article>
```

**Step 2: Smoke-test on a temporary route**

Edit `src/routes/+page.svelte` temporarily to render a few `TeamCard`s with sample teams from `lib/teams`.

```bash
pnpm dev
```

Visit `http://localhost:5173`. Expected: cards render with flags, names, confederations, rankings. Stop server.

**Step 3: Revert the temporary route changes** (or leave for next task to overwrite).

**Step 4: Commit**

```bash
git add src/lib/components/TeamCard.svelte
git commit -m "feat(ui): TeamCard component"
```

---

### Task 14: `<UnrankedPool>` with search

**Files:**

- Create: `src/lib/components/UnrankedPool.svelte`

**Step 1: Write the component**

```svelte
<script lang="ts">
  import type { Team } from '$lib/types';
  import TeamCard from './TeamCard.svelte';
  import { Input } from '$lib/components/ui/input';     // shadcn-svelte
  import { Button } from '$lib/components/ui/button';

  interface Props {
    teams: readonly Team[];
    onAdd: (code: string) => void;
  }
  let { teams, onAdd }: Props = $props();

  let query = $state('');

  let filtered = $derived(
    teams.filter((t) => {
      if (!query) return true;
      const q = query.toLowerCase();
      return t.name.toLowerCase().includes(q)
        || t.code.toLowerCase().includes(q)
        || t.confederation.toLowerCase().includes(q);
    })
  );
</script>

<section class="flex flex-col gap-2">
  <Input bind:value={query} placeholder="Search teams" />
  <ul class="flex flex-col gap-2">
    {#each filtered as team (team.code)}
      <li class="flex items-center gap-2">
        <div class="flex-1"><TeamCard {team} /></div>
        <Button size="sm" variant="ghost" onclick={() => onAdd(team.code)} aria-label="Add {team.name}">+</Button>
      </li>
    {/each}
  </ul>
</section>
```

**Step 2: Manual verification**

Wire into `+page.svelte` temporarily, with state:

```svelte
<script lang="ts">
  import { teams } from '$lib/teams';
  import UnrankedPool from '$lib/components/UnrankedPool.svelte';
  let added = $state<string[]>([]);
</script>

<UnrankedPool teams={teams.filter(t => !added.includes(t.code))} onAdd={(c) => added = [...added, c]} />
<pre>{JSON.stringify(added)}</pre>
```

Run `pnpm dev`. Expected: search filters teams, `+` button moves them out of pool. Stop server.

**Step 3: Commit**

```bash
git add src/lib/components/UnrankedPool.svelte
git commit -m "feat(ui): UnrankedPool with search"
```

---

### Task 15: `<RankedList>` with reorder controls

**Files:**

- Create: `src/lib/components/RankedList.svelte`

**Step 1: Write the component**

Tap-friendly controls first — drag comes in Task 17.

```svelte
<script lang="ts">
  import type { Team } from '$lib/types';
  import { teamsByCode } from '$lib/teams';
  import TeamCard from './TeamCard.svelte';
  import { Button } from '$lib/components/ui/button';

  interface Props {
    ranking: string[]; // FIFA codes in order
    onReorder: (next: string[]) => void;
    onRemove: (code: string) => void;
  }
  let { ranking, onReorder, onRemove }: Props = $props();

  function move(i: number, delta: number) {
    const j = i + delta;
    if (j < 0 || j >= ranking.length) return;
    const next = [...ranking];
    [next[i], next[j]] = [next[j], next[i]];
    onReorder(next);
  }
</script>

<ol class="flex flex-col gap-2">
  {#each ranking as code, i (code)}
    {@const team = teamsByCode.get(code)}
    {#if team}
      <li class="flex items-center gap-2">
        <div class="flex-1"><TeamCard {team} rank={i + 1} /></div>
        <Button size="sm" variant="ghost" onclick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">↑</Button>
        <Button size="sm" variant="ghost" onclick={() => move(i, 1)} disabled={i === ranking.length - 1} aria-label="Move down">↓</Button>
        <Button size="sm" variant="ghost" onclick={() => onRemove(code)} aria-label="Remove {team.name}">×</Button>
      </li>
    {/if}
  {/each}
</ol>

{#if ranking.length === 0}
  <p class="text-muted-foreground text-sm">Pick teams from the left to start your list.</p>
{/if}
```

**Step 2: Manual verification** in `+page.svelte` — extend the previous test wiring with `RankedList` rendering the `added` array. Confirm up/down/× work.

**Step 3: Commit**

```bash
git add src/lib/components/RankedList.svelte
git commit -m "feat(ui): RankedList with reorder controls"
```

---

### Task 16: Wire the page with `PersistedState` + URL hash

**Files:**

- Modify: `src/routes/+page.svelte`

**Step 1: Read `runed` README**

Open `node_modules/runed/README.md`. Confirm the `PersistedState` import and constructor signature. Adjust the snippet below if the API differs.

**Step 2: Write the page**

Replace `+page.svelte` contents:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { PersistedState } from 'runed';
  import { teams } from '$lib/teams';
  import { encodeRanking, decodeRanking } from '$lib/ranking';
  import UnrankedPool from '$lib/components/UnrankedPool.svelte';
  import RankedList from '$lib/components/RankedList.svelte';

  const ranking = new PersistedState<string[]>('wc26.ranking', []);

  // Mirror ranking → URL hash
  $effect(() => {
    const encoded = encodeRanking(ranking.current);
    const next = encoded ? `#r=${encoded}` : '';
    if (location.hash !== next) {
      history.replaceState(null, '', `${location.pathname}${location.search}${next}`);
    }
  });

  // Boot: read URL hash if present
  onMount(() => {
    const hash = location.hash;
    if (!hash.startsWith('#r=')) return;
    const incoming = decodeRanking(hash.slice(3));
    if (incoming.length === 0) return;
    if (ranking.current.length === 0) {
      ranking.current = incoming;
    }
    // else: preview-mode banner handled in Task 18
  });

  let unrankedTeams = $derived(
    teams.filter((t) => !ranking.current.includes(t.code))
  );

  function add(code: string) {
    ranking.current = [...ranking.current, code];
  }
  function remove(code: string) {
    ranking.current = ranking.current.filter((c) => c !== code);
  }
  function reorder(next: string[]) {
    ranking.current = next;
  }
</script>

<main class="mx-auto max-w-5xl p-4">
  <h1 class="text-2xl font-semibold mb-4">World Cup 2026 — My Teams</h1>
  <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
    <UnrankedPool teams={unrankedTeams} onAdd={add} />
    <RankedList ranking={ranking.current} onReorder={reorder} onRemove={remove} />
  </div>
</main>
```

**Step 3: Manual verification**

```bash
pnpm dev
```

- Add a few teams. Reload. Expected: ranking persists.
- Open DevTools → Application → Local Storage. Expected: key `wc26.ranking` with array.
- Address bar updates with `#r=...` as you add/remove.
- Open the same URL in a second tab. Expected: ranking syncs across tabs (runed handles this).

Stop server.

**Step 4: Commit**

```bash
git add src/routes/+page.svelte
git commit -m "feat(ui): wire page with persisted state and url hash"
```

---

### Task 17: Add drag-and-drop reorder

**Files:**

- Modify: `src/lib/components/RankedList.svelte`
- Modify: `src/lib/components/UnrankedPool.svelte` (drag source)

**Step 1: Read `svelte-dnd-action` README**

Open `node_modules/svelte-dnd-action/README.md`. Confirm Svelte 5 usage — the action is `dndzone`, takes `items` and emits `consider`/`finalize` events. Note any breaking changes.

**Step 2: Make `<RankedList>` a drop zone + reorderable**

Wrap the `<ol>` with `use:dndzone`. Items must be objects with `id`. Map ranking codes → `{ id: code }` for the action, then back.

```svelte
<script lang="ts">
  // ... existing imports
  import { dndzone } from 'svelte-dnd-action';

  // ... existing props

  let items = $derived(ranking.map((code) => ({ id: code })));

  function handleDnd(e: CustomEvent<{ items: { id: string }[] }>) {
    onReorder(e.detail.items.map((i) => i.id));
  }
</script>

<ol class="flex flex-col gap-2"
    use:dndzone={{ items, flipDurationMs: 150, type: 'teams' }}
    onconsider={handleDnd}
    onfinalize={handleDnd}>
  {#each items as { id } (id)}
    {@const team = teamsByCode.get(id)}
    {#if team}
      <!-- existing li content, using id as code -->
    {/if}
  {/each}
</ol>
```

(Adjust API per README — Svelte 5 prop syntax for actions may differ.)

**Step 3: Make `<UnrankedPool>` a drag source into the ranking**

Use the same `type: 'teams'` so items can move between zones. The pool's `onfinalize` receives the new pool list — anything missing was dropped into the ranking. Convert that back to an `onAdd(code)` call for each removed item, OR emit a single `onItemsChanged(remainingCodes)` and let `+page.svelte` reconcile against `teams`.

Recommended: **emit `onItemsChanged`**, let parent reconcile. Simpler.

**Step 4: Manual verification**

```bash
pnpm dev
```

- Drag an unranked team into the ranked column. Expected: it moves.
- Drag within ranked to reorder. Expected: order updates, persists, hash updates.
- On mobile viewport (DevTools device mode), drag still works but the +/↑↓ buttons remain primary path.

**Step 5: Commit**

```bash
git add src/lib/components/RankedList.svelte src/lib/components/UnrankedPool.svelte src/routes/+page.svelte
git commit -m "feat(ui): drag-and-drop reorder via svelte-dnd-action"
```

---

### Task 18: Header + share-link preview banner

**Files:**

- Modify: `src/routes/+page.svelte`

**Step 1: Add header buttons**

Add Share, Print, Reset to the top of `<main>`:

```svelte
<header class="flex items-center justify-between mb-4">
  <h1 class="text-2xl font-semibold">World Cup 2026 — My Teams</h1>
  <div class="flex gap-2">
    <Button variant="outline" onclick={share}>Share</Button>
    <Button variant="outline" onclick={() => window.print()}>Print</Button>
    <Button variant="ghost" onclick={confirmReset}>Reset</Button>
  </div>
</header>
```

```ts
async function share() {
  await navigator.clipboard.writeText(location.href);
  toast('Copied!'); // shadcn toast
}

function confirmReset() {
  if (confirm('Clear your ranking?')) ranking.current = [];
}
```

(Shadcn toast or `Sonner` is fine — confirm what the scaffold added.)

**Step 2: Add preview-banner state**

Replace the `onMount` boot logic:

```ts
let previewMode = $state(false);
let savedSnapshot = $state<string[]>([]);

onMount(() => {
  const hash = location.hash;
  if (!hash.startsWith('#r=')) return;
  const incoming = decodeRanking(hash.slice(3));
  if (incoming.length === 0) return;
  if (ranking.current.length === 0) {
    ranking.current = incoming;
  } else {
    // Don't write to storage; just show this without persisting.
    savedSnapshot = ranking.current;
    ranking.current = incoming;
    previewMode = true;
  }
});

function saveAsMine() {
  previewMode = false;
  // ranking.current is already the incoming ranking; just stop being in preview
  // (PersistedState already wrote it because ranking.current was assigned)
}

function restoreMine() {
  ranking.current = savedSnapshot;
  previewMode = false;
}
```

**Wait** — `PersistedState` writes on every `ranking.current` assignment. That defeats preview mode. Two options:

- **Option A (recommended):** On preview entry, snapshot then assign — but DON'T write the incoming via `PersistedState`. Use a separate `$state` for the displayed ranking and only push to `ranking.current` on Save:

```ts
let displayed = $state<string[]>([]);
let previewMode = $state(false);

onMount(() => {
  // ... read hash → incoming
  if (ranking.current.length === 0) {
    ranking.current = incoming;
    displayed = incoming;
  } else {
    displayed = incoming;
    previewMode = true;
  }
  // outside preview: keep displayed mirrored
});

$effect(() => {
  if (!previewMode) displayed = ranking.current;
});

function saveAsMine() {
  ranking.current = displayed;
  previewMode = false;
}
function restoreMine() {
  displayed = ranking.current;
  previewMode = false;
}
```

Then change all UI bindings to read/write `displayed`, with handlers updating `ranking.current` only when `!previewMode` (otherwise just `displayed`):

```ts
function add(code: string) {
  if (previewMode) displayed = [...displayed, code];
  else ranking.current = [...ranking.current, code];
}
// ...same shape for remove() and reorder()
```

**Step 3: Render the banner**

```svelte
{#if previewMode}
  <div class="border rounded-md bg-muted p-3 mb-4 flex items-center justify-between">
    <p>You're viewing a shared list.</p>
    <div class="flex gap-2">
      <Button onclick={saveAsMine}>Save as mine</Button>
      <Button variant="outline" onclick={restoreMine}>Restore mine</Button>
    </div>
  </div>
{/if}
```

**Step 4: Manual verification**

- With saved ranking `[A, B, C]`, open `?r=X,Y,Z`. Expected: banner shows, displayed ranking is `[X, Y, Z]`, localStorage still `[A, B, C]`.
- Click Save → banner gone, localStorage `[X, Y, Z]`.
- Reopen with saved `[A, B, C]` and `?r=X,Y,Z`, click Restore → banner gone, displayed `[A, B, C]`.

**Step 5: Commit**

```bash
git add src/routes/+page.svelte
git commit -m "feat(ui): header buttons and shared-link preview mode"
```

---

## Phase 5 — Print stylesheet

### Task 19: Print styles

**Files:**

- Modify: `src/app.css` (or whatever the global stylesheet is named)

**Step 1: Add print rules**

```css
@media print {
  /* Hide app chrome */
  header button,
  .unranked-pool,
  .ranked-controls,
  .preview-banner {
    display: none !important;
  }

  /* Single column */
  main {
    max-width: none;
    padding: 0;
  }
  main > div {
    display: block;
  }

  /* Compact rows */
  ol li {
    break-inside: avoid;
    padding: 0.25rem 0;
  }

  /* Make sure colour prints */
  * {
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }

  @page {
    margin: 1.5cm;
  }

  /* Footer with date */
  body::after {
    content: 'World Cup 2026 — My Teams · ' attr(data-print-date);
    display: block;
    margin-top: 2rem;
    font-size: 0.75rem;
    color: #666;
  }
}
```

Add corresponding class names (`unranked-pool`, `ranked-controls`, `preview-banner`) to the relevant elements. For the date, set `document.body.dataset.printDate = new Date().toLocaleDateString();` once on mount.

**Step 2: Manual verification**

```bash
pnpm dev
```

In Chrome, Cmd+P. Expected: only ranking visible, single column, footer with date, ranking numbers tabular.

**Step 3: Commit**

```bash
git add src/app.css src/routes/+page.svelte
git commit -m "feat(ui): print stylesheet"
```

---

## Phase 6 — E2E tests

Use `@playwright-e2e` for patterns.

### Task 20: Playwright config + first test

**Files:**

- Verify: `playwright.config.ts` exists from scaffold
- Create: `tests/ranking.spec.ts`

**Step 1: Verify config**

```bash
cat playwright.config.ts
```

Expected: file exists, `webServer` config points at `pnpm dev` or `pnpm preview`.

**Step 2: Write add-three-teams test**

```ts
import { test, expect } from '@playwright/test';

test('add three teams from pool', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /add Argentina/i }).click();
  await page.getByRole('button', { name: /add Brazil/i }).click();
  await page.getByRole('button', { name: /add France/i }).click();

  const ranked = page.locator('ol li');
  await expect(ranked).toHaveCount(3);
  await expect(ranked.nth(0)).toContainText('Argentina');
  await expect(ranked.nth(1)).toContainText('Brazil');
  await expect(ranked.nth(2)).toContainText('France');

  await expect(page).toHaveURL(/#r=ARG,BRA,FRA/);
});
```

**Step 3: Run**

```bash
pnpm exec playwright test ranking.spec.ts
```

Expected: pass. If team aria-labels don't match, fix them in `UnrankedPool.svelte`.

**Step 4: Commit**

```bash
git add tests/ranking.spec.ts playwright.config.ts
git commit -m "test(e2e): add three teams from pool"
```

---

### Task 21: Reload-restores test

**Files:**

- Modify: `tests/ranking.spec.ts`

**Step 1: Add test**

```ts
test('ranking persists across reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /add Argentina/i }).click();
  await page.getByRole('button', { name: /add Brazil/i }).click();
  await page.reload();
  const ranked = page.locator('ol li');
  await expect(ranked).toHaveCount(2);
  await expect(ranked.nth(0)).toContainText('Argentina');
});
```

**Step 2: Run, expect pass.**

```bash
pnpm exec playwright test ranking.spec.ts
```

**Step 3: Commit**

```bash
git add tests/ranking.spec.ts
git commit -m "test(e2e): reload restores ranking"
```

---

### Task 22: Shared-URL preview-mode test

**Files:**

- Modify: `tests/ranking.spec.ts`

**Step 1: Add test**

```ts
test('shared url shows preview banner when local list exists', async ({ page, context }) => {
  // Seed local storage with an existing ranking
  await context.addInitScript(() => {
    localStorage.setItem('wc26.ranking', JSON.stringify(['ARG', 'BRA']));
  });

  await page.goto('/#r=FRA,GER');

  await expect(page.getByText(/viewing a shared list/i)).toBeVisible();
  const ranked = page.locator('ol li');
  await expect(ranked.nth(0)).toContainText('France');

  // Restore mine
  await page.getByRole('button', { name: /restore mine/i }).click();
  await expect(ranked.nth(0)).toContainText('Argentina');

  // localStorage was never overwritten by the shared list
  const stored = await page.evaluate(() => localStorage.getItem('wc26.ranking'));
  expect(stored).toBe(JSON.stringify(['ARG', 'BRA']));
});

test('shared url adopts directly when no local list', async ({ page }) => {
  await page.goto('/#r=FRA,GER');
  await expect(page.getByText(/viewing a shared list/i)).not.toBeVisible();
  const ranked = page.locator('ol li');
  await expect(ranked.nth(0)).toContainText('France');
});
```

**Step 2: Run, expect pass.**

```bash
pnpm exec playwright test ranking.spec.ts
```

**Step 3: Commit**

```bash
git add tests/ranking.spec.ts
git commit -m "test(e2e): shared url preview behaviour"
```

---

## Phase 7 — Deploy

### Task 23: Deploy to Vercel

**Files:**

- Create: `vercel.json` (if not auto-detected)

**Step 1: Push to GitHub**

```bash
gh repo create world-cup-2026 --public --source=. --remote=origin --push
```

(Or use the existing remote setup if Nick already created a repo.)

**Step 2: Connect on Vercel**

In the Vercel UI: New Project → import `world-cup-2026` → framework SvelteKit (auto-detected) → build command `pnpm build` → output `build`.

**Step 3: First deploy**

Push triggers deploy. Open the deployed URL. Smoke test:

- Add a team. Reload. Persists.
- Copy URL with `#r=...`. Open in incognito. Loads with that ranking.
- Print preview shows clean output.

**Step 4: Commit any deploy config**

```bash
git add vercel.json # if any
git commit -m "chore: vercel deploy config"
git push
```

---

## Done criteria

- [ ] `data/teams.json` and `data/teams.csv` committed, 48 teams, all fields populated and zod-valid.
- [ ] `static/flags/` has 48 flag files.
- [ ] Dev server renders the app with pool + ranking.
- [ ] Adding/removing/reordering works on desktop (drag) and mobile (buttons).
- [ ] Reload restores ranking from localStorage.
- [ ] URL hash reflects ranking; share link works.
- [ ] Shared link in fresh browser adopts directly; in browser with existing list shows preview banner.
- [ ] Print preview shows clean single-column output with date footer.
- [ ] All Playwright tests pass.
- [ ] Deployed to Vercel; URL works end-to-end in incognito.
