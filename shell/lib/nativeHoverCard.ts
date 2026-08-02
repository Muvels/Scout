import { useSyncExternalStore } from 'react';
import { tabs, type TabHoverCardAnchor } from 'tbf/shell';

/**
 * Whether the running framework binary supports native tab hover cards
 * (tabs.showHoverCard). Unknown until the first attempt; components keep the
 * web-rendered fallback mounted only once the native path has failed, so an
 * older binary degrades gracefully and a newer one feels browser-native.
 */
let supported: boolean | undefined;

/**
 * The latest issued show — a monotonically increasing sequence plus the tab
 * it targeted. A hide sends only from the row of the latest show (sliding
 * the pointer to the next tab fires the new row's show and the old row's
 * hide in unspecified order, and the stale hide must not kill the moved
 * card). The record is only ever cleared in the same breath as sending a
 * hide, so bookkeeping cannot drift from wire state: a visible card always
 * has exactly one path that will hide it.
 */
let lastShow: { readonly seq: number; readonly tabId: string } | undefined;
let showSequence = 0;

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of [...listeners]) listener();
}

export function useNativeHoverCardSupport(): boolean | undefined {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => supported,
  );
}

export function showNativeHoverCard(
  tabId: string,
  anchor: TabHoverCardAnchor,
): void {
  const seq = ++showSequence;
  lastShow = { seq, tabId };
  void tabs
    .showHoverCard(tabId, {
      x: anchor.x,
      y: anchor.y,
      width: anchor.width,
      height: anchor.height,
    })
    .then(() => {
      if (supported !== true) {
        supported = true;
        emit();
      }
    })
    .catch((reason: unknown) => {
      // Only a missing capability demotes to the web card — a not-found for
      // a tab that closed mid-hover is a race, not a verdict on the binary.
      const message = reason instanceof Error ? reason.message : '';
      if (
        supported !== false
        && (message.includes('unsupported') || message.includes('unavailable'))
      ) {
        supported = false;
        emit();
      }
      // A show that failed while still the latest leaves the card in an
      // unknown state — possibly visible with no row left that would ever
      // hide it. It must die, not linger.
      if (lastShow?.seq === seq) {
        lastShow = undefined;
        void tabs.hideHoverCard().catch(() => {
          // The card dies with its tab or window anyway.
        });
      }
    });
}

export function hideNativeHoverCard(tabId: string): void {
  if (lastShow?.tabId !== tabId) return;
  lastShow = undefined;
  void tabs.hideHoverCard().catch(() => {
    // The card dies with its tab or window anyway; a failed hide is moot.
  });
}
