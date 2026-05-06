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

function parseHistorical(wikitext: string): Historical {
  const doc = wtf(wikitext);
  const tables = doc.tables();

  // The results-by-tournament table has columns Year, Round, Position, Pld, W, ...
  const table = tables.find((t) => {
    const rows = t.json() as Array<Record<string, unknown>>;
    if (!rows.length) return false;
    const keys = Object.keys(rows[0]);
    return keys.includes('Year') && keys.includes('Round') && keys.includes('W');
  });

  if (!table) {
    throw new Error('results-by-tournament table not found');
  }

  const rows = table.json() as Array<Record<string, unknown>>;
  const parsed = rows.map((r) => {
    const yearText = cellText(r['Year']);
    const yearMatch = yearText.match(/(\d{4})/);
    const roundRaw = cellText(r['Round']).replace(/'''/g, '').trim();
    const round = roundRaw.toLowerCase();
    const winsText = cellText(r['W']).trim();
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

  // Wikipedia's "Total" row aggregates across all tournaments and is typically more accurate
  // than summing per-row wins, since some Champions rows have blank W cells due to rowspan
  // markup. Fall back to per-row sum if no Total row is present.
  const totalRow = parsed.find((r) => r.yearText.includes('total') && r.wins > 0);
  const summedWins = yearRows.reduce((sum, r) => sum + r.wins, 0);
  const matchWins = totalRow ? totalRow.wins : summedWins;

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
    const entry = WC2026_TEAMS.find((t) => t.code === code);
    if (!entry) throw new Error(`${code} missing from constants`);
    const h = await parseOne(entry);
    console.log(`${code} ${entry.name}:`, h);
  }
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
