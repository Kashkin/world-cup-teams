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
  const yearRows = rows
    .map((r) => {
      const yearText = cellText(r['Year']);
      const yearMatch = yearText.match(/(\d{4})/);
      const roundRaw = cellText(r['Round']).replace(/'''/g, '').trim();
      const round = roundRaw.toLowerCase();
      const winsText = cellText(r['W']).trim();
      const wins = parseInt(winsText, 10);
      return {
        year: yearMatch ? parseInt(yearMatch[1], 10) : NaN,
        round,
        wins: Number.isFinite(wins) ? wins : 0,
        winsValid: winsText !== '' && Number.isFinite(wins),
      };
    })
    // Only count tournaments the team actually played: valid year + valid W column
    // (filters out future rows like 2026/2030/2034 with no results, and Total row)
    .filter((r) => Number.isFinite(r.year) && r.winsValid);

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
    matchWins: yearRows.reduce((sum, r) => sum + r.wins, 0),
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
  const brazil = WC2026_TEAMS.find((t) => t.code === 'BRA');
  if (!brazil) throw new Error('BRA missing from constants');
  const historical = await parseOne(brazil);
  console.log('Brazil historical:', historical);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
