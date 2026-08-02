import { useEffect, useRef, useState } from 'react';
import type { Tab } from 'tbf/shell';
import { TabView } from 'tbf/shell/react';
import { cn } from '../lib/utils.js';
import type { SidebarSide } from '../types.js';

const PAGE_RADIUS = 10;

function LoadingBar({ loading }: { loading: boolean }) {
  const barRef = useRef<HTMLDivElement>(null);
  const shownRef = useRef(0.06);
  const [visible, setVisible] = useState(loading);

  useEffect(() => {
    if (loading) setVisible(true);
  }, [loading]);

  // Drawn by a self-owned rAF writing transform directly. A CSS keyframe or
  // transition here would trip the SDK's document-wide animation watchers
  // and keep per-frame layout tracking alive for the whole page load.
  useEffect(() => {
    const bar = barRef.current;
    if (bar === null || !visible) return;
    const started = performance.now();
    let finishedAt: number | undefined;
    let fadeFrom = shownRef.current;
    let frame = 0;
    const tick = (now: number) => {
      if (loading) {
        const seconds = (now - started) / 1000;
        shownRef.current = Math.min(
          0.88,
          0.06 + 0.82 * (1 - Math.exp(-seconds / 2.4)),
        );
        bar.style.opacity = '1';
        bar.style.transform = `scaleX(${shownRef.current})`;
      } else {
        if (finishedAt === undefined) {
          finishedAt = now;
          fadeFrom = shownRef.current;
        }
        const gone = Math.min(1, (now - finishedAt) / 400);
        bar.style.transform = `scaleX(${fadeFrom + (1 - fadeFrom) * gone})`;
        bar.style.opacity = String(1 - gone);
        if (gone >= 1) {
          shownRef.current = 0.06;
          setVisible(false);
          return;
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [loading, visible]);

  if (!visible) return null;
  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-30 h-[3px] overflow-hidden rounded-t-[10px]"
      role="progressbar"
      aria-label="Page loading"
    >
      <div
        ref={barRef}
        className="h-full w-full origin-left rounded-r-full bg-accent shadow-[0_0_10px_var(--accent)]"
        style={{ transform: 'scaleX(0.06)', opacity: 1 }}
      />
    </div>
  );
}

type BrowserViewportProps = {
  active: Tab | undefined;
  paneIds: (string | undefined)[];
  split: boolean;
  side: SidebarSide;
  /** The active tab has not painted yet — its surface below is blank. */
  coverPageHole: boolean;
};

export function BrowserViewport({
  active,
  paneIds,
  split,
  side,
  coverPageHole,
}: BrowserViewportProps) {
  return (
    <section
      // Only the edge away from the sidebar carries a margin: the sidebar
      // column (or collapsed gutter) already provides the other one.
      className={cn(
        'relative z-10 my-1.5 flex min-h-0 min-w-0 flex-1 gap-1',
        side === 'right' ? 'ml-1.5' : 'mr-1.5',
      )}
      aria-label="Active tab content"
    >
      {paneIds.map((id, pane) => id ? (
          <TabView
            key={pane}
            tabId={id}
            composite="below-shell"
            cornerRadius={PAGE_RADIUS}
            className="block h-full min-w-0 flex-1"
            style={{ order: pane }}
            ariaLabel={`Browser tab ${pane + 1}`}
          />
        ) : null)}

      {/* No tab open: just the bare content wash — New Tab or ⌘T floats
          the omnibox palette over it. */}
      {!active && (
        <div
          className="absolute inset-0 rounded-[10px] bg-content-empty"
          aria-hidden="true"
        />
      )}

      {/* A tab that has not painted yet has no surface below the shell —
          cover the hole so the desktop does not show through. The cover
          lifts at the tab's first paint, not at load completion, so page
          content appears while the loading bar is still running. */}
      {active && coverPageHole && (
        <div
          className="absolute inset-0 z-10 rounded-[10px] bg-content-empty"
          aria-hidden="true"
        />
      )}

      {active && (
        <LoadingBar
          key={active.id}
          loading={active.status === 'loading'}
        />
      )}

      {/* Paints ALL of the window chrome — gutters, corner notches, and the
          area behind the sidebar — as one slightly-translucent layer (the
          desktop shimmers through), plus a hairline on the card edge. The
          page rect itself stays alpha-0: the tab composites below the
          shell. The 480px outer shadow reaches past the widest sidebar and
          is clipped by the window silhouette; a single paint source keeps
          the translucency seam-free. The card's elevation shadow lives in
          Browser above the gradient wash, which paints over this layer. */}
      <div
        className="pointer-events-none absolute inset-0 z-20 rounded-[10px] shadow-[inset_0_0_0_1px_rgba(9,14,24,0.1),0_0_0_480px_var(--chrome)]"
        aria-hidden="true"
      />

      {split && (
        <span className="pointer-events-none absolute left-1/2 top-3 z-20 h-[calc(100%-24px)] w-px bg-black/8" />
      )}
    </section>
  );
}
