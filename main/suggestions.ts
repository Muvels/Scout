import type { SearchEngine } from '../shared/ipc.js';

// All three endpoints answer the OpenSearch suggest shape:
// [query, [phrase, ...], ...]. `client=chrome` keeps Google's reply JSON.
const endpoints: Record<SearchEngine, (query: string) => string> = {
  google: (query) =>
    'https://suggestqueries.google.com/complete/search?client=chrome&q=' +
    encodeURIComponent(query),
  duckduckgo: (query) =>
    `https://duckduckgo.com/ac/?q=${encodeURIComponent(query)}&type=list`,
  bing: (query) =>
    `https://api.bing.com/osjson.aspx?query=${encodeURIComponent(query)}`,
};

/**
 * Fetches typed-query completions from the selected engine. Anything that
 * goes wrong — offline, slow endpoint, unexpected payload — degrades to an
 * empty list; the palette simply shows no suggestions.
 */
export async function fetchSearchSuggestions(
  engine: SearchEngine,
  query: string,
): Promise<string[]> {
  try {
    const response = await fetch(endpoints[engine](query), {
      signal: AbortSignal.timeout(1500),
    });
    if (!response.ok) return [];
    const payload: unknown = JSON.parse(await response.text());
    const phrases: unknown = Array.isArray(payload) ? payload[1] : undefined;
    if (!Array.isArray(phrases)) return [];
    return phrases
      .filter((phrase): phrase is string => typeof phrase === 'string')
      .slice(0, 8);
  } catch {
    return [];
  }
}
