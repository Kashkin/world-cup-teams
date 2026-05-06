const CODE_RE = /^[A-Z]{3}$/;

export function encodeRanking(ranking: readonly string[]): string {
  return ranking.filter((c) => CODE_RE.test(c)).join(',');
}

export function decodeRanking(input: string | null | undefined): string[] {
  if (!input) return [];
  return input.split(',').filter((c) => CODE_RE.test(c));
}
