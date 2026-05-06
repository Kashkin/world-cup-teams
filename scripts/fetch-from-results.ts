import { writeFile, mkdir } from 'node:fs/promises';
import type { BestFinish } from '../src/lib/types.ts';
import { WC2026_TEAMS } from './teams-2026.ts';

const UA = 'world-cup-2026-research/0.1 (nick.rogers@portable.com.au)';
const REPO = 'https://raw.githubusercontent.com/martj42/international_results/master';

type ResultRow = {
  date: string;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  tournament: string;
  city: string;
  country: string;
  neutral: boolean;
};

type ShootoutRow = {
  date: string;
  home_team: string;
  away_team: string;
  winner: string;
};

// Parse a single CSV line, respecting quotes.
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuote) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        inQuote = false;
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuote = true;
    } else if (c === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

async function fetchCsv(name: string): Promise<string[][]> {
  const res = await fetch(`${REPO}/${name}`, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`fetch ${name}: ${res.status}`);
  const text = await res.text();
  return text.split('\n').filter(Boolean).map(parseCsvLine);
}

// Map historical/alternate team names → modern Wikipedia-aligned names that match our constants.
// Sourced from former_names.csv plus a few WC-specific aliases (Korea variants, etc.).
const NAME_ALIASES: Record<string, string> = {
  Zaïre: 'DR Congo',
  Zaire: 'DR Congo',
  'West Germany': 'Germany',
  'East Germany': 'Germany', // never qualified for WC, but just in case
  Czechoslovakia: 'Czech Republic', // approximate successor for our purposes
  'Soviet Union': 'Russia', // not a WC2026 team
  Yugoslavia: 'Serbia', // not a WC2026 team either
  'Korea Republic': 'South Korea',
  'Korea DPR': 'North Korea',
  'United States': 'United States',
  USA: 'United States',
  "Côte d'Ivoire": "Côte d'Ivoire",
  'Ivory Coast': "Côte d'Ivoire",
  'Cape Verde': 'Cape Verde',
  'Cabo Verde': 'Cape Verde',
  Iran: 'Iran',
  Türkiye: 'Turkey',
};

function canonicalName(raw: string): string {
  return NAME_ALIASES[raw] ?? raw;
}

// Map our WC2026 entry display names → the canonical form used in the dataset.
const NAME_TO_CODE = new Map<string, string>();
for (const t of WC2026_TEAMS) {
  NAME_TO_CODE.set(canonicalName(t.name), t.code);
}

type TournamentResult = {
  team: string;
  year: number;
  matches: number;
  wins: number;
  lastMatchDate: string;
  lastMatchWon: boolean;
  reachedFinal: boolean;
  wonFinal: boolean;
};

type Aggregate = {
  appearances: number;
  matchWins: number;
  trophies: number;
  lastTrophy: number | null;
  bestFinish: BestFinish;
};

function matchOutcome(
  home: string,
  away: string,
  hs: number,
  as_: number,
  shootoutWinner: string | null,
): { winner: string | null; loser: string | null } {
  if (hs > as_) return { winner: home, loser: away };
  if (as_ > hs) return { winner: away, loser: home };
  if (shootoutWinner) {
    const loser = shootoutWinner === home ? away : home;
    return { winner: shootoutWinner, loser };
  }
  return { winner: null, loser: null };
}

async function main() {
  console.log('Downloading datasets…');
  const [resultsRaw, shootoutsRaw] = await Promise.all([
    fetchCsv('results.csv'),
    fetchCsv('shootouts.csv'),
  ]);

  const [, ...resultRows] = resultsRaw;
  const [, ...shootoutRows] = shootoutsRaw;

  const results: ResultRow[] = resultRows
    .filter((r) => r[5] === 'FIFA World Cup')
    .map((r) => ({
      date: r[0],
      home_team: canonicalName(r[1]),
      away_team: canonicalName(r[2]),
      home_score: parseInt(r[3], 10),
      away_score: parseInt(r[4], 10),
      tournament: r[5],
      city: r[6],
      country: r[7],
      neutral: r[8] === 'TRUE',
    }))
    .filter((r) => Number.isFinite(r.home_score) && Number.isFinite(r.away_score));

  const shootoutByDateTeams = new Map<string, ShootoutRow>();
  for (const s of shootoutRows) {
    const key = `${s[0]}|${canonicalName(s[1])}|${canonicalName(s[2])}`;
    shootoutByDateTeams.set(key, {
      date: s[0],
      home_team: canonicalName(s[1]),
      away_team: canonicalName(s[2]),
      winner: canonicalName(s[3]),
    });
  }

  console.log(`WC matches: ${results.length}`);

  // Group by year + team → tournament-level stats.
  const yearTournaments = new Map<number, ResultRow[]>();
  for (const r of results) {
    const year = parseInt(r.date.slice(0, 4), 10);
    if (!yearTournaments.has(year)) yearTournaments.set(year, []);
    yearTournaments.get(year)!.push(r);
  }

  const perTeamYear = new Map<string, TournamentResult>(); // key: `${team}|${year}`
  for (const [year, matches] of yearTournaments) {
    // Sort by date so the last match per team (and the tournament's last match) is identifiable.
    matches.sort((a, b) => a.date.localeCompare(b.date));
    const tournamentLastDate = matches[matches.length - 1].date;
    const finalMatches = matches.filter((m) => m.date === tournamentLastDate);
    const finalMatch = finalMatches[finalMatches.length - 1]; // if multiple on last day, take last

    for (const m of matches) {
      const s = shootoutByDateTeams.get(`${m.date}|${m.home_team}|${m.away_team}`);
      const { winner } = matchOutcome(
        m.home_team,
        m.away_team,
        m.home_score,
        m.away_score,
        s?.winner ?? null,
      );

      for (const team of [m.home_team, m.away_team]) {
        const key = `${team}|${year}`;
        if (!perTeamYear.has(key)) {
          perTeamYear.set(key, {
            team,
            year,
            matches: 0,
            wins: 0,
            lastMatchDate: '',
            lastMatchWon: false,
            reachedFinal: false,
            wonFinal: false,
          });
        }
        const t = perTeamYear.get(key)!;
        t.matches++;
        if (winner === team) t.wins++;
        if (m.date >= t.lastMatchDate) {
          t.lastMatchDate = m.date;
          t.lastMatchWon = winner === team;
        }
      }
    }

    // Final-match flagging: the LAST match on the tournament's last day is the Final.
    // 1950 had no Final match — it was a 4-team round-robin where the decider
    // happened to be Uruguay vs Brazil (URU 2-1). Override that year explicitly.
    let finalWinner: string | null = null;
    let finalLoser: string | null = null;
    if (year === 1950) {
      finalWinner = 'Uruguay';
      finalLoser = 'Brazil';
    } else if (finalMatch) {
      const s = shootoutByDateTeams.get(
        `${finalMatch.date}|${finalMatch.home_team}|${finalMatch.away_team}`,
      );
      const { winner, loser } = matchOutcome(
        finalMatch.home_team,
        finalMatch.away_team,
        finalMatch.home_score,
        finalMatch.away_score,
        s?.winner ?? null,
      );
      finalWinner = winner;
      finalLoser = loser;
    }
    for (const team of [finalWinner, finalLoser]) {
      if (!team) continue;
      const t = perTeamYear.get(`${team}|${year}`);
      if (!t) continue;
      t.reachedFinal = true;
      if (team === finalWinner) t.wonFinal = true;
    }
  }

  // Aggregate per team.
  const byTeam = new Map<string, TournamentResult[]>();
  for (const t of perTeamYear.values()) {
    if (!byTeam.has(t.team)) byTeam.set(t.team, []);
    byTeam.get(t.team)!.push(t);
  }

  function deriveBestFinish(tournaments: TournamentResult[]): BestFinish {
    if (tournaments.some((t) => t.wonFinal)) return 'Champion';
    if (tournaments.some((t) => t.reachedFinal)) return 'Runner-up';
    const maxMatches = Math.max(...tournaments.map((t) => t.matches));
    // Heuristic: in modern era, 6 matches = lost SF (Third or Fourth depending on 3rd-place result).
    // Without round info we can't tell Third from Fourth precisely, so we lean Fourth unless the
    // team's last match (3rd-place playoff) was won.
    if (maxMatches >= 6) {
      const sixMatchTournaments = tournaments.filter((t) => t.matches >= 6);
      if (sixMatchTournaments.some((t) => t.lastMatchWon)) return 'Third';
      return 'Fourth';
    }
    if (maxMatches === 5) return 'Quarter-finals';
    if (maxMatches === 4) return 'Round of 16';
    return 'Group stage';
  }

  function aggregate(team: string): Aggregate {
    const ts = byTeam.get(team) ?? [];
    const trophies = ts.filter((t) => t.wonFinal).map((t) => t.year);
    return {
      appearances: ts.length,
      matchWins: ts.reduce((sum, t) => sum + t.wins, 0),
      trophies: trophies.length,
      lastTrophy: trophies.length ? Math.max(...trophies) : null,
      bestFinish: ts.length ? deriveBestFinish(ts) : 'Group stage',
    };
  }

  // Emit CSV in the same shape as data/teams.csv but on the pivot path so we don't
  // collide with the parallel manual edits to the Wikipedia-parsed version.
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
    const canonical = canonicalName(t.name);
    const a = aggregate(canonical);
    return [
      t.code,
      JSON.stringify(t.name),
      t.confederation,
      a.appearances,
      a.trophies,
      a.lastTrophy ?? '',
      a.matchWins,
      JSON.stringify(a.bestFinish),
      JSON.stringify(''),
    ].join(',');
  });

  await mkdir('data', { recursive: true });
  await writeFile('data/teams-pivot.csv', [csvHeader, ...csvRows].join('\n') + '\n');

  // Print a sanity-check table for the user.
  console.log('\n--- Pivot results ---');
  for (const t of WC2026_TEAMS) {
    const canonical = canonicalName(t.name);
    const a = aggregate(canonical);
    console.log(
      `  ${t.code} ${t.name.padEnd(24)} apps=${String(a.appearances).padStart(2)} trophies=${a.trophies} lastTr=${a.lastTrophy ?? '   -'} wins=${String(a.matchWins).padStart(3)} best=${a.bestFinish}`,
    );
  }
  console.log(`\nWrote data/teams-pivot.csv (${WC2026_TEAMS.length} rows).`);

  // Diagnostic: any of our teams that returned no tournaments?
  const missing = WC2026_TEAMS.filter((t) => !byTeam.has(canonicalName(t.name)));
  if (missing.length) {
    console.log('\nNo dataset matches for:');
    for (const t of missing)
      console.log(`  ${t.code} ${t.name} (canonical=${canonicalName(t.name)})`);
  }
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
