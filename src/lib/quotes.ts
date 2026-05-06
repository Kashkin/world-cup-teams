import quotesData from '../../data/quotes.json';

export type Quote = {
  text: string;
  author: string | null;
};

export const quotes: readonly Quote[] = Object.freeze(quotesData);

/** Pick a random quote. Cryptographic randomness is overkill — Math.random is fine. */
export function randomQuote(): Quote {
  return quotes[Math.floor(Math.random() * quotes.length)];
}
