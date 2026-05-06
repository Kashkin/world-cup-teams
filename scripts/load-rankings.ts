import { readFile, writeFile } from 'node:fs/promises';

// Parse the rankings.html the user saved from FIFA's site.
// Each row has:
//   <h3 class="custom-rank-cell_rankNumber__...">1</h3>
//   <a href="/fifa-world-ranking/FRA?gender=men" ...>
const html = await readFile('data/rankings.html', 'utf8');

// Match rank+code pairs in document order.
const rowRe =
  /<h3[^>]*custom-rank-cell_rankNumber[^>]*>(\d+)<\/h3>[\s\S]*?<a[^>]+href="\/fifa-world-ranking\/([A-Z]{3})\?/g;

const codeToRank = new Map<string, number>();
for (const m of html.matchAll(rowRe)) {
  const rank = parseInt(m[1], 10);
  const code = m[2];
  if (!codeToRank.has(code)) codeToRank.set(code, rank);
}
console.log(`Parsed ${codeToRank.size} (rank, code) pairs`);

// Read teams.csv, add ranking column after confederation, write back.
const csv = await readFile('data/teams.csv', 'utf8');
const lines = csv.trim().split('\n');
const [headerLine, ...dataLines] = lines;
const headers = headerLine.split(',');

if (headers.includes('ranking')) {
  console.log('teams.csv already has a ranking column — overwriting in place');
}

const codeIdx = headers.indexOf('code');
const confIdx = headers.indexOf('confederation');
const rankIdx = headers.indexOf('ranking');

let outHeaders: string[];
if (rankIdx >= 0) {
  outHeaders = headers;
} else {
  outHeaders = [...headers.slice(0, confIdx + 1), 'ranking', ...headers.slice(confIdx + 1)];
}

const outLines = [outHeaders.join(',')];
let matched = 0;
const missing: string[] = [];
for (const line of dataLines) {
  const cells = line.split(',');
  const code = cells[codeIdx];
  const rank = codeToRank.get(code);
  if (rank != null) matched++;
  else missing.push(code);
  const rankStr = rank?.toString() ?? '';
  let outCells: string[];
  if (rankIdx >= 0) {
    outCells = [...cells];
    outCells[rankIdx] = rankStr;
  } else {
    outCells = [...cells.slice(0, confIdx + 1), rankStr, ...cells.slice(confIdx + 1)];
  }
  outLines.push(outCells.join(','));
}

await writeFile('data/teams.csv', outLines.join('\n') + '\n');

console.log(`Matched ${matched}/48 teams.`);
if (missing.length) console.log(`Missing ranking for: ${missing.join(', ')}`);
