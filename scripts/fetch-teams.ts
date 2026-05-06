import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { z } from 'zod';
import { TeamSchema, type Team } from '../src/lib/types.ts';
import { WC2026_TEAMS, type Wc2026Entry } from './teams-2026.ts';

const UA = 'world-cup-2026-research/0.1 (nick.rogers@portable.com.au)';

// Minimal CSV parser. Handles quoted fields, escaped quotes, and unquoted fields.
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

const CsvRowSchema = z.object({
  code: z.string().length(3),
  name: z.string().min(1),
  confederation: z.enum(['AFC', 'CAF', 'CONCACAF', 'CONMEBOL', 'OFC', 'UEFA']),
  appearances: z.coerce.number().int().nonnegative(),
  trophies: z.coerce.number().int().nonnegative(),
  lastTrophy: z
    .union([z.literal(''), z.coerce.number().int().min(1930).max(2026)])
    .transform((v) => (v === '' ? null : v)),
  matchWins: z.coerce.number().int().nonnegative(),
  bestFinish: z.enum([
    'Champion',
    'Runner-up',
    'Third',
    'Fourth',
    'Quarter-finals',
    'Round of 16',
    'Group stage',
  ]),
});

async function readTeamsCsv(): Promise<Map<string, z.infer<typeof CsvRowSchema>>> {
  const text = await readFile('data/teams.csv', 'utf8');
  const lines = text.split('\n').filter(Boolean);
  const [headerLine, ...dataLines] = lines;
  const headers = parseCsvLine(headerLine);
  const out = new Map<string, z.infer<typeof CsvRowSchema>>();
  for (const line of dataLines) {
    const cells = parseCsvLine(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => (obj[h] = cells[i] ?? ''));
    const parsed = CsvRowSchema.parse(obj);
    out.set(parsed.code, parsed);
  }
  return out;
}

async function flagSvgUrl(flagFile: string): Promise<string> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&titles=File:${encodeURIComponent(flagFile)}&prop=imageinfo&iiprop=url&format=json`;
  const res = await fetch(url, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`flag URL lookup failed for ${flagFile}: ${res.status}`);
  const json = (await res.json()) as {
    query?: { pages?: Record<string, { imageinfo?: Array<{ url?: string }> }> };
  };
  const pages = json.query?.pages ?? {};
  const page = Object.values(pages)[0];
  const direct = page?.imageinfo?.[0]?.url;
  if (!direct) throw new Error(`no imageinfo URL for ${flagFile}`);
  return direct;
}

async function downloadFlag(entry: Wc2026Entry): Promise<void> {
  const url = await flagSvgUrl(entry.flagFile);
  const res = await fetch(url, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`flag fetch failed for ${entry.code}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await mkdir('static/flags', { recursive: true });
  await writeFile(`static/flags/${entry.code.toLowerCase()}.svg`, buf);
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log('Reading data/teams.csv…');
  const csv = await readTeamsCsv();
  if (csv.size !== 48) throw new Error(`expected 48 rows, got ${csv.size}`);

  console.log('Downloading flags…');
  for (const entry of WC2026_TEAMS) {
    process.stdout.write(`  ${entry.code} ${entry.flagFile} `);
    try {
      await downloadFlag(entry);
      console.log('✓');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`✗ ${msg}`);
    }
    await sleep(200);
  }

  console.log('Assembling teams.json…');
  const teams: Team[] = WC2026_TEAMS.map((entry) => {
    const row = csv.get(entry.code);
    if (!row) throw new Error(`no CSV row for ${entry.code}`);
    return {
      code: entry.code,
      name: entry.name,
      confederation: entry.confederation,
      flag: `/flags/${entry.code.toLowerCase()}.svg`,
      ranking: null, // TODO: pull from FIFA's monthly ranking when we wire it up
      appearances: row.appearances,
      trophies: row.trophies,
      lastTrophy: row.lastTrophy,
      matchWins: row.matchWins,
      bestFinish: row.bestFinish,
    };
  });

  const validated = z.array(TeamSchema).length(48).parse(teams);
  // Sort: by ranking ascending (null last), then by name.
  const sorted = [...validated].sort((a, b) => {
    if (a.ranking == null && b.ranking == null) return a.name.localeCompare(b.name);
    if (a.ranking == null) return 1;
    if (b.ranking == null) return -1;
    return a.ranking - b.ranking;
  });

  await mkdir('data', { recursive: true });
  await writeFile('data/teams.json', JSON.stringify(sorted, null, 2) + '\n');

  console.log(`\nWrote data/teams.json (${sorted.length} teams).`);
  console.log(
    `  Champions: ${sorted
      .filter((t) => t.trophies > 0)
      .map((t) => t.code)
      .join(', ')}`,
  );
  console.log(
    `  First-time qualifiers: ${sorted
      .filter((t) => t.appearances === 0)
      .map((t) => t.code)
      .join(', ')}`,
  );
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
