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

  it('decodes nullish input as empty array', () => {
    expect(decodeRanking(null)).toEqual([]);
    expect(decodeRanking(undefined)).toEqual([]);
  });

  it('decodes garbage input as empty array', () => {
    expect(decodeRanking('!@#$')).toEqual([]);
  });

  it('strips invalid codes when decoding', () => {
    expect(decodeRanking('ARG,xx,BRA,123,GER')).toEqual(['ARG', 'BRA', 'GER']);
  });

  it('strips invalid codes when encoding', () => {
    expect(encodeRanking(['ARG', 'xx', 'BRA'])).toBe('ARG,BRA');
  });
});
