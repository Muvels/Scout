import { useEffect, useState } from 'react';
import { connectMainIpcTransport } from 'tbf/shell';
import { omnibox, type OmniboxMatch } from 'tbf/shell/services';
import { ipc, type SearchEngine } from '../../shared/ipc.js';

export type PaletteSuggestions = {
  /** Typed-query completions from the selected search engine. */
  readonly phrases: readonly string[];
  /** The browser's own autocomplete matches (history, bookmarks, URLs). */
  readonly matches: readonly OmniboxMatch[];
};

/**
 * One shared main-process connection for suggestion queries; unreachable
 * main (old harnesses, tests) latches to undefined and the palette simply
 * shows no engine phrases.
 */
let mainClient:
  | Promise<ReturnType<typeof ipc.bind> | undefined>
  | undefined;
const mainIpc = () => {
  mainClient ??= connectMainIpcTransport()
    .then((transport) => ipc.bind(transport))
    .catch(() => undefined);
  return mainClient;
};

/**
 * Live palette suggestions for a typed query, from two independent
 * sources: the selected engine's suggest endpoint (proxied through the
 * main process — the shell's CSP and the endpoints' missing CORS headers
 * rule out fetching here) and the browser's own omnibox autocomplete for
 * history/bookmark/URL matches. Each source fails closed on its own, so a
 * missing native bridge still leaves engine phrases and vice versa.
 */
export function useSearchSuggestions(
  query: string,
  engine: SearchEngine,
): PaletteSuggestions {
  const [phrases, setPhrases] = useState<readonly string[]>([]);
  const [matches, setMatches] = useState<readonly OmniboxMatch[]>([]);

  useEffect(() => {
    if (query === '') {
      setPhrases([]);
      setMatches([]);
      return;
    }
    // Do not leave the previous query's history result visible (and selected)
    // while Chromium evaluates the new input.
    setMatches([]);
    let stale = false;
    let unsubscribe: (() => void) | undefined;
    try {
      // Results stream through the event channel. Subscribing THROWS
      // synchronously when the native bridge is missing.
      unsubscribe = omnibox.onResults((results) => {
        if (!stale) setMatches(results);
      });
    } catch {
      // Older binary: engine phrases still work.
    }
    const handle = window.setTimeout(() => {
      if (unsubscribe !== undefined) {
        omnibox.start(query).catch(() => {
          // A newer keystroke superseded this request; the event stream
          // is the source of truth.
        });
      }
      void mainIpc().then(async (bound) => {
        if (bound === undefined) return;
        try {
          const suggested = await bound.invoke('getSearchSuggestions', {
            query,
            engine,
          });
          if (!stale) setPhrases(suggested);
        } catch {
          // Main unreachable or offline: no phrases this round.
        }
      });
    }, 120);
    return () => {
      stale = true;
      window.clearTimeout(handle);
      unsubscribe?.();
    };
  }, [query, engine]);

  return { phrases, matches };
}
