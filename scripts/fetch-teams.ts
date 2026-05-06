import wtf from 'wtf_wikipedia';
import type { BestFinish } from '../src/lib/types.ts';
import { WC2026_TEAMS, type Wc2026Entry } from './teams-2026.ts';

const UA = 'world-cup-2026-research/0.1 (nick.rogers@portable.com.au)';

const ROUND_TO_FINISH: Record<string, BestFinish> = {
  champions: 'Champion',
  'runners-up': 'Runner-up',
  'third place': 'Third',
  'fourth place': 'Fourth',
  'quarter-finals': 'Quarter-finals',
  'round of 16': 'Round of 16',
  // historical aliases
  'second round': 'Round of 16',
  'second group stage': 'Round of 16',
  'first round': 'Group stage',
  'group stage': 'Group stage',
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

async function fetchWikitext(slug: string): Promise<string | null> {
  const url = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(slug)}&format=json&prop=wikitext&redirects=1`;
  const res = await fetch(url, { headers: { 'user-agent': UA } });
  if (!res.ok) return null;
  const json = (await res.json()) as { parse?: { wikitext: { '*': string } } };
  return json.parse?.wikitext['*'] ?? null;
}

function cellText(cell: unknown): string {
  if (cell == null) return '';
  if (typeof cell === 'string') return cell;
  if (typeof cell === 'object' && 'text' in cell) {
    return String((cell as { text: unknown }).text ?? '');
  }
  return '';
}

// Pick the table key matching any of the candidates (case-insensitive).
function pickKey(keys: string[], candidates: string[]): string | undefined {
  const lower = candidates.map((c) => c.toLowerCase());
  return keys.find((k) => lower.includes(k.toLowerCase()));
}

function parseHistorical(wikitext: string): Historical {
  const doc = wtf(wikitext);
  const tables = doc.tables();

  // Find the results-by-tournament table. Header names vary across team pages:
  //   Round / Result / Position
  //   W / Won
  // We require a Year column plus at least one of Round/Result and a wins column.
  let pickedKeys: { year: string; round: string; wins: string } | undefined;
  const table = tables.find((t) => {
    const rows = t.json() as Array<Record<string, unknown>>;
    if (!rows.length) return false;
    const keys = Object.keys(rows[0]);
    const year = pickKey(keys, ['Year']);
    const round = pickKey(keys, ['Round', 'Result']);
    const wins = pickKey(keys, ['W', 'Won']);
    if (year && round && wins) {
      pickedKeys = { year, round, wins };
      return true;
    }
    return false;
  });

  if (!table || !pickedKeys) {
    throw new Error('results-by-tournament table not found');
  }
  const KEY_YEAR = pickedKeys.year;
  const KEY_ROUND = pickedKeys.round;
  const KEY_WINS = pickedKeys.wins;

  const rows = table.json() as Array<Record<string, unknown>>;
  const parsed = rows.map((r) => {
    const yearText = cellText(r[KEY_YEAR]);
    const yearMatch = yearText.match(/(\d{4})/);
    const roundRaw = cellText(r[KEY_ROUND]).replace(/'''/g, '').trim();
    const round = roundRaw.toLowerCase();
    const winsText = cellText(r[KEY_WINS]).trim();
    const wins = parseInt(winsText, 10);
    return {
      year: yearMatch ? parseInt(yearMatch[1], 10) : NaN,
      yearText: yearText.toLowerCase(),
      round,
      wins: Number.isFinite(wins) ? wins : 0,
    };
  });

  // Only count tournaments the team actually played: valid past year + recognised round.
  // Filters out future tournaments (Qualified / To be determined), DNQ rows, and non-rounds.
  // Wikipedia's W column is sometimes blank for trophy rows (e.g. England 1966) — we don't
  // gate on it, so trophies/finish are still recognised; missing wins just contribute 0.
  const yearRows = parsed.filter(
    (r) => Number.isFinite(r.year) && r.year < 2026 && Object.hasOwn(ROUND_TO_FINISH, r.round),
  );

  // Sum per-row wins. Some teams' tables have a "Total" row that combines WC + qualification
  // wins (e.g. Canada's combined table) — those are unsafe to read as the WC-only total.
  // The trade-off: a few teams undercount by 1-3 (e.g. England, where the 1966 Champions row
  // has a blank W cell due to rowspan markup).
  const matchWins = yearRows.reduce((sum, r) => sum + r.wins, 0);

  const champYears = yearRows.filter((r) => r.round === 'champions').map((r) => r.year);
  const finishes = yearRows.map((r) => ROUND_TO_FINISH[r.round] ?? 'Group stage');
  const bestFinish = finishes.reduce<BestFinish>(
    (best, f) => (FINISH_RANK[f] < FINISH_RANK[best] ? f : best),
    'Group stage',
  );

  return {
    appearances: yearRows.length,
    trophies: champYears.length,
    lastTrophy: champYears.length ? Math.max(...champYears) : null,
    matchWins,
    bestFinish,
  };
}

const NO_HISTORY: Historical = {
  appearances: 0,
  trophies: 0,
  lastTrophy: null,
  matchWins: 0,
  bestFinish: 'Group stage',
};

async function parseOne(entry: Wc2026Entry): Promise<Historical> {
  if (!entry.wpHistory) return NO_HISTORY;
  const wt = await fetchWikitext(entry.wpHistory);
  if (!wt) {
    console.warn(`  [${entry.code}] no wikitext at ${entry.wpHistory}`);
    return NO_HISTORY;
  }
  try {
    return parseHistorical(wt);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`  [${entry.code}] parse error: ${msg}`);
    return NO_HISTORY;
  }
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// Flag teams whose parsed output is known suspect — the user reviews and corrects these
// in data/teams.csv before we proceed to JSON emit.
const PARSE_FAILURES = new Set(['USA', 'AUS', 'BEL', 'FRA', 'GER', 'NED']);
const INFLATED_WINS_SUSPECTED = new Set([
  'ARG',
  'IRN',
  'JPN',
  'KOR',
  'KSA',
  'MAR',
  'TUN',
  'BIH',
  'ESP',
  'SWE',
  'CAN',
  'PAN',
  'IRQ',
  'QAT',
]);

async function main() {
  const { writeFile, mkdir } = await import('node:fs/promises');
  const historicalByCode = new Map<string, Historical>();
  for (const entry of WC2026_TEAMS) {
    process.stdout.write(`  ${entry.code} ${entry.name.padEnd(24)} `);
    const h = await parseOne(entry);
    historicalByCode.set(entry.code, h);
    console.log(
      `apps=${String(h.appearances).padStart(2)} trophies=${h.trophies} wins=${String(h.matchWins).padStart(3)} best=${h.bestFinish}`,
    );
    await sleep(200);
  }

  // Write CSV for user review.
  const csvHeader = [
    'code',
    'name',
    'confederation',
    'appearances',
    'trophies',
    'lastTrophy',
    'matchWins',
    'bestFinish',
    'review',
  ].join(',');
  const csvRows = WC2026_TEAMS.map((t) => {
    const h = historicalByCode.get(t.code)!;
    let review = '';
    if (PARSE_FAILURES.has(t.code)) review = 'PARSE_FAILED — please fill from Wikipedia';
    else if (INFLATED_WINS_SUSPECTED.has(t.code))
      review = 'matchWins likely inflated (WC + qualification combined)';
    else if (!t.wpHistory) review = 'first-time qualifier — defaults applied';
    return [
      t.code,
      JSON.stringify(t.name),
      t.confederation,
      h.appearances,
      h.trophies,
      h.lastTrophy ?? '',
      h.matchWins,
      JSON.stringify(h.bestFinish),
      JSON.stringify(review),
    ].join(',');
  });
  await mkdir('data', { recursive: true });
  await writeFile('data/teams.csv', [csvHeader, ...csvRows].join('\n') + '\n');

  console.log(`\nWrote data/teams.csv (${WC2026_TEAMS.length} rows).`);
  console.log(`  ${PARSE_FAILURES.size} teams need full historical fill (review="PARSE_FAILED").`);
  console.log(`  ${INFLATED_WINS_SUSPECTED.size} teams have suspected inflated matchWins.`);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
