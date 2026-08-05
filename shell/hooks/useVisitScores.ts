import { useEffect, useState } from 'react';

export type VisitScore = {
  count: number;
  lastVisitTime: number;
};

type HistoryApi = {
  getVisits: (details: { url: string }) => Promise<{
    visitTime?: number;
  }[]>;
};

function shellHistory(): HistoryApi | undefined {
  const shell = globalThis as typeof globalThis & {
    chrome?: { history?: HistoryApi };
  };
  return shell.chrome?.history;
}

/**
 * Visit frequency for a small, caller-owned URL set. The caller supplies
 * current-space URLs only, so profile-wide history can rank those entries
 * without leaking a site from another space into the palette.
 */
export function useVisitScores(
  urls: readonly string[],
): ReadonlyMap<string, VisitScore> {
  const [scores, setScores] = useState<ReadonlyMap<string, VisitScore>>(
    () => new Map(),
  );

  useEffect(() => {
    let stale = false;
    setScores(new Map());
    if (urls.length === 0) return;

    try {
      const history = shellHistory();
      if (typeof history?.getVisits !== 'function') return;
      void Promise.all(
        urls.map(async (url) => {
          try {
            const visits = await history.getVisits({ url });
            return [
              url,
              {
                count: visits.length,
                lastVisitTime: visits.reduce(
                  (latest, visit) => Math.max(latest, visit.visitTime ?? 0),
                  0,
                ),
              },
            ] as const;
          } catch {
            return [url, { count: 0, lastVisitTime: 0 }] as const;
          }
        }),
      ).then((entries) => {
        if (!stale) setScores(new Map(entries));
      });
    } catch {
      // Tests and older runtimes can omit the history grant. Sidebar order
      // remains the deterministic recommendation fallback in that case.
    }

    return () => {
      stale = true;
    };
  }, [urls]);

  return scores;
}
