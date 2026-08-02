import type { Tab } from 'tbf/shell';
import type { SearchEngine } from '../../shared/ipc.js';

/** What a row presents: a live tab, or a dormant pin's cached identity. */
type Presentable = Pick<Tab, 'url' | 'title'>;

export function tabTitle(tab: Presentable): string {
  const title = tab.title.trim();
  if (title) return title;

  try {
    return new URL(tab.url).hostname || 'New tab';
  } catch {
    return 'New tab';
  }
}

export function tabHost(tab: Presentable | undefined): string {
  if (!tab) return 'Search or enter URL';

  try {
    const url = new URL(tab.url);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.hostname.replace(/^www\./, '') || 'New tab';
    }
    // chrome://settings and friends read better whole than as a bare host.
    return tab.url.replace(/\/$/, '');
  } catch {
    return tabTitle(tab);
  }
}

const SEARCH_URLS: Record<SearchEngine, string> = {
  google: 'https://www.google.com/search?q=',
  duckduckgo: 'https://duckduckgo.com/?q=',
  bing: 'https://www.bing.com/search?q=',
};

// The scout://settings choice, applied by the shell once the setting loads
// or its beacon arrives. Module state rather than a parameter because the
// engine only shapes the produced search URL, never how input classifies.
let activeSearchUrl = SEARCH_URLS.google;

export function setSearchEngine(engine: SearchEngine): void {
  activeSearchUrl = SEARCH_URLS[engine] ?? activeSearchUrl;
}

// Schemes the address bar navigates to directly; anything else typed with a
// colon is far more likely a search ("weather: berlin") than a protocol.
const NAVIGABLE_SCHEME =
  /^(https?|chrome|chrome-untrusted|about|file|view-source|devtools):/i;

// A bare address needs a dot (example.com), a port (localhost:8080), or to
// be localhost; lone words are searches.
const BARE_ADDRESS =
  /^([\w-]+(\.[\w-]+)+|localhost)(:\d+)?([/?#]|$)/i;

function navigableDestination(input: string): string | undefined {
  if (/\s/.test(input)) return undefined;
  if (NAVIGABLE_SCHEME.test(input)) {
    try {
      return new URL(input).href;
    } catch {
      // Malformed despite the scheme; treat it as a query.
    }
  } else if (BARE_ADDRESS.test(input)) {
    try {
      return new URL(`https://${input}`).href;
    } catch {
      // Malformed despite looking like a host; treat it as a query.
    }
  }
  return undefined;
}

export function destinationForInput(value: string): string | undefined {
  const input = value.trim();
  if (!input) return undefined;
  return (
    navigableDestination(input)
    ?? `${activeSearchUrl}${encodeURIComponent(input)}`
  );
}

/** Whether the input reads as an address rather than a search query. */
export function isNavigableInput(value: string): boolean {
  const input = value.trim();
  return input !== '' && navigableDestination(input) !== undefined;
}

export function faviconFallback(title: string): string {
  return title.trim().slice(0, 1).toUpperCase() || '•';
}

/**
 * The favicon for a page with no live tab behind it — a dormant pin.
 * chrome://favicon2 serves the profile's icon store (the same source the
 * SDK rewrites live tabs' favicons to), so a site visited in any earlier
 * session paints its icon without loading anything; an icon the store has
 * never seen fails to load and the caller falls back to a monogram.
 * allowGoogleServerFallback=0 keeps the shell off the network.
 */
export function faviconForUrl(pageUrl: string): string {
  const scale =
    typeof globalThis.devicePixelRatio === 'number'
    && globalThis.devicePixelRatio >= 2
      ? '2x'
      : '1x';
  return (
    'chrome://favicon2/?size=16'
    + `&scaleFactor=${scale}`
    + `&pageUrl=${encodeURIComponent(pageUrl)}`
    + '&allowGoogleServerFallback=0'
  );
}
