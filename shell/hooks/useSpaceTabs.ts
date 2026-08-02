import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Tab } from 'tbf/shell';
import { tabs } from 'tbf/shell';
import type { EntryInfo, TabRecord } from '../../shared/ipc.js';
import {
  dormantEntryKey,
  initialSpaceTabs,
  isDormantEntry,
  patchShellState,
  persistable,
  type SpaceTabsState as State,
} from '../lib/shellStore.js';
import type { SpacesApi } from './useSpaces.js';
import type { Perform } from '../types.js';

export type SpaceTabsApi = {
  /** The tabs the sidebar shows: the active space's, pinned and regular. */
  visibleTabs: Tab[];
  /** The active space's regular-section order, for useTabOrder. */
  regularOrder: string[];
  /** Replaces the active space's regular-section order (drag & drop). */
  setRegularOrder: (ids: string[]) => void;
  /** The active space's pinned-section order, for useTabOrder. */
  pinnedOrder: string[];
  /** Replaces the active space's pinned-section order (drag & drop). */
  setPinnedOrder: (ids: string[]) => void;
  /**
   * The framework-active tab belongs to another space and the last space
   * switch has settled: present no tab (Arc's blank state) instead of a
   * foreign space's page.
   */
  hideActive: boolean;
  /**
   * Declares a shell-intended activation (the omnibox switch-to-tab row):
   * only these may move the active space to the tab's owner. Framework
   * activations — the successor it picks after a close — never do.
   */
  followTab: (tabId: string) => void;
  /**
   * Every space's live tabs (pinned first, in section order), for
   * cross-space UI like the palette. Dormant entries have no tab to
   * switch to, so they do not appear; unclaimed tabs fold into the
   * active space, mirroring visibleTabs.
   */
  tabsBySpaceId: Record<string, Tab[]>;
  /**
   * Cached identities — URL and title — keyed like the section orders'
   * entries: dormant "ent:" keys in either section, and live pinned tab
   * ids (a pin remembers the URL it was pinned at). A dormant row
   * renders from this alone.
   */
  entryInfo: Record<string, EntryInfo>;
  /** Loads a dormant entry: opens its saved URL in a new live tab. */
  openEntry: (key: string) => void;
  /** Removes a dormant entry — closing a tab that was never loaded. */
  removeEntry: (key: string) => void;
  /**
   * The shell's pin toggle: moves the tab between the section lists and
   * keeps its identity, then syncs the framework's flag best-effort.
   * Membership in the pinned list — never the framework's flag — is what
   * makes a tab a pin.
   */
  setTabPinned: (tabId: string, pinned: boolean) => void;
};

/**
 * Shell-owned space membership. Each space keeps ordered lists of its
 * pinned and regular entries — pins are per-space, not shared. An entry
 * is either a live tab id or a dormant "ent:" key: a saved tab rendered
 * from its cached identity with nothing behind it. A launch loads
 * nothing, Arc-style — every saved tab comes back dormant and only a
 * click materializes it. Closing a live pinned tab returns its entry to
 * dormant, pointing back at the URL it was pinned at; closing a live
 * regular tab removes it, and a regular entry only returns to dormant by
 * outliving the session.
 *
 * The framework's pinned flag is deliberately never read as truth: the
 * browser flips it on its own during unrelated transitions (a closing
 * tab reports itself unpinned on the way out), so pin membership lives
 * in the lists and the flag is merely synced outward.
 */
export function useSpaceTabs(
  openTabs: Tab[],
  spaces: SpacesApi,
  perform: Perform,
  onEmptySpace: () => void,
): SpaceTabsApi {
  const activeSpaceId = spaces.active.id;
  // The shell store has loaded before mount (the entry gates on it), so
  // this snapshot is the persisted state — with id lists already turned
  // into dormant entries when they belong to a previous browser session.
  const [state, setState] = useState<State>(initialSpaceTabs);

  const stateRef = useRef(state);
  stateRef.current = state;
  const openTabsRef = useRef(openTabs);
  openTabsRef.current = openTabs;
  const activeSpaceRef = useRef(activeSpaceId);
  activeSpaceRef.current = activeSpaceId;
  /** Claiming pauses while a materialization is routing its new tab. */
  const materializing = useRef(0);
  /** Dormant keys with a materialization already running. */
  const inFlight = useRef(new Set<string>());
  /**
   * Framework flag values the shell has requested but not yet seen
   * confirmed. Adoption of externally-pinned tabs must not act on a flag
   * the shell is in the middle of clearing — the report is merely stale.
   */
  const requestedFlags = useRef(new Map<string, boolean>());

  // Reconcile membership with reality: drop closed tabs (returning a
  // closed pin to a dormant entry), close a deleted space's tabs, keep
  // every live pin's identity fresh, and claim new tabs for the active
  // space.
  const tabsSeeded = useRef(false);
  useEffect(() => {
    // An empty list means one of two things: the tab stream has not
    // seeded yet (act on nothing), or the user closed the last tab — a
    // real emission that must still reconcile, or a closed last pin
    // would never fall back to its dormant entry.
    if (openTabs.length === 0 && !tabsSeeded.current) return;
    tabsSeeded.current = openTabs.length > 0 || tabsSeeded.current;
    const present = new Map(openTabs.map((tab) => [tab.id, tab]));
    const spaceIds = new Set(spaces.spaces.map((space) => space.id));
    const current = stateRef.current;
    const entryInfo = { ...current.entryInfo };

    const removedSpaceTabs: string[] = [];
    // A dying live id that carries an identity is a pin losing its tab:
    // it falls back to a dormant entry — closing a pinned tab unloads
    // it, Arc-style — in place when it lived in the pinned list, or
    // appended to its space's pinned section when a drag had it riding
    // the regular order. A dying id without identity is a regular tab
    // closing for good.
    const strandedPins: Record<string, string[]> = {};
    const toDormant = (id: string): string | undefined => {
      const info = entryInfo[id];
      if (info === undefined) return undefined;
      const key = dormantEntryKey();
      entryInfo[key] = info;
      delete entryInfo[id];
      return key;
    };
    const tabsBySpace: Record<string, string[]> = {};
    for (const [spaceId, ids] of Object.entries(current.tabsBySpace)) {
      if (!spaceIds.has(spaceId)) {
        // A deleted space takes its tabs with it — dormant entries and
        // pins included, they belong to the space.
        removedSpaceTabs.push(...ids.filter((id) => present.has(id)));
        continue;
      }
      tabsBySpace[spaceId] = ids.filter((id) => {
        if (isDormantEntry(id)) return entryInfo[id] !== undefined;
        if (present.has(id)) return true;
        const key = toDormant(id);
        if (key !== undefined) (strandedPins[spaceId] ??= []).push(key);
        return false;
      });
    }
    const pinnedBySpace: Record<string, string[]> = {};
    for (const [spaceId, ids] of Object.entries(current.pinnedBySpace)) {
      if (!spaceIds.has(spaceId)) {
        removedSpaceTabs.push(...ids.filter((id) => present.has(id)));
        continue;
      }
      const next: string[] = [];
      for (const id of ids) {
        if (isDormantEntry(id)) {
          if (entryInfo[id] !== undefined) next.push(id);
          continue;
        }
        if (present.has(id)) {
          next.push(id);
          continue;
        }
        const key = toDormant(id);
        if (key !== undefined) next.push(key);
      }
      pinnedBySpace[spaceId] = [...next, ...(strandedPins[spaceId] ?? [])];
      delete strandedPins[spaceId];
    }
    for (const [spaceId, keys] of Object.entries(strandedPins)) {
      pinnedBySpace[spaceId] = keys;
    }

    // Requested flags resolve when the stream confirms them or the tab
    // dies; a rejected request keeps suppressing (known desync).
    for (const [id, wanted] of requestedFlags.current) {
      const tab = present.get(id);
      if (tab === undefined) requestedFlags.current.delete(id);
      else if (Boolean(tab.pinned) === wanted) {
        requestedFlags.current.delete(id);
      }
    }

    // Adopt pins made outside the shell's own toggle — another SDK
    // surface flipping the framework flag: a claimed regular tab
    // reporting itself pinned moves across the divider. Only the pinning
    // direction is trusted; the browser reports "unpinned" on its own
    // during unrelated transitions (a closing tab, most notably), so
    // that direction belongs to the shell's explicit actions alone.
    for (const [spaceId, ids] of Object.entries(tabsBySpace)) {
      const adopted = ids.filter(
        (id) =>
          !isDormantEntry(id)
          && present.get(id)?.pinned === true
          && requestedFlags.current.get(id) !== false,
      );
      if (adopted.length === 0) continue;
      tabsBySpace[spaceId] = ids.filter((id) => !adopted.includes(id));
      pinnedBySpace[spaceId] = [
        ...(pinnedBySpace[spaceId] ?? []),
        ...adopted,
      ];
    }

    // A live pin's identity stays fresh: while the tab sits on its
    // pinned URL the cached title tracks the page, and a pin that
    // arrived without an identity (claimed below on an earlier run)
    // records the URL it is on now.
    for (const ids of Object.values(pinnedBySpace)) {
      for (const id of ids) {
        if (isDormantEntry(id)) continue;
        const tab = present.get(id);
        if (tab === undefined) continue;
        const info = entryInfo[id];
        if (info === undefined) {
          entryInfo[id] = {
            url: tab.url,
            ...(tab.title ? { title: tab.title } : {}),
          };
        } else if (
          tab.url === info.url
          && tab.title
          && tab.title !== info.title
        ) {
          entryInfo[id] = { ...info, title: tab.title };
        }
      }
    }

    const claimed = new Set([
      ...Object.values(tabsBySpace).flat(),
      ...Object.values(pinnedBySpace).flat(),
    ]);
    if (materializing.current === 0) {
      for (const tab of openTabs) {
        if (claimed.has(tab.id)) continue;
        if (tab.pinned) {
          // A pinned tab the shell has not placed takes over the active
          // space's dormant pin for its URL — a pin coming back to life
          // after an upgrade or an external re-open — or a fresh slot at
          // the end of the pinned section.
          const list = pinnedBySpace[activeSpaceId] ?? [];
          const slot = list.findIndex(
            (id) => isDormantEntry(id) && entryInfo[id]?.url === tab.url,
          );
          if (slot >= 0) {
            const key = list[slot];
            entryInfo[tab.id] = entryInfo[key];
            delete entryInfo[key];
            pinnedBySpace[activeSpaceId] = [
              ...list.slice(0, slot),
              tab.id,
              ...list.slice(slot + 1),
            ];
          } else {
            entryInfo[tab.id] ??= {
              url: tab.url,
              ...(tab.title ? { title: tab.title } : {}),
            };
            pinnedBySpace[activeSpaceId] = [...list, tab.id];
          }
        } else {
          (tabsBySpace[activeSpaceId] ??= []).push(tab.id);
        }
        claimed.add(tab.id);
      }
    }

    // Identities must belong to a listed entry — and, for a live id, a
    // tab that still exists; anything else is a leftover a removed space
    // or an unpin abandoned.
    const listed = new Set([
      ...Object.values(tabsBySpace).flat(),
      ...Object.values(pinnedBySpace).flat(),
    ]);
    for (const key of Object.keys(entryInfo)) {
      const keep = isDormantEntry(key)
        ? listed.has(key)
        : listed.has(key) && present.has(key);
      if (!keep) delete entryInfo[key];
    }

    const lastActive = Object.fromEntries(
      Object.entries(current.lastActive).filter(
        ([spaceId, id]) => spaceIds.has(spaceId) && present.has(id),
      ),
    );

    const changed =
      JSON.stringify(tabsBySpace) !== JSON.stringify(current.tabsBySpace)
      || JSON.stringify(pinnedBySpace) !== JSON.stringify(current.pinnedBySpace)
      || JSON.stringify(entryInfo) !== JSON.stringify(current.entryInfo)
      || JSON.stringify(lastActive) !== JSON.stringify(current.lastActive);
    if (changed) {
      setState({ tabsBySpace, pinnedBySpace, entryInfo, lastActive });
    }
    for (const id of removedSpaceTabs) {
      perform(() => tabs.close(id));
    }
  }, [openTabs, spaces.spaces, activeSpaceId, perform]);

  // Following the active tab: remember it as its space's return point, and
  // when the shell itself activated it in another space (the omnibox
  // switch-to-tab row, declared through followTab), move there with it.
  // Two kinds of activation must NOT move the space: re-runs for the
  // still-active old tab during a space switch (spaces is a fresh object
  // each render), and framework-picked successors after a close — the
  // natively-adjacent tab can live in another space, and following it
  // would teleport the user away instead of leaving the space blank.
  const activeTab = openTabs.find((tab) => tab.active);
  const activeTabId = activeTab?.id;
  const followedTab = useRef(activeTabId);
  const followIntent = useRef<string | undefined>(undefined);
  const followTab = useCallback((tabId: string) => {
    followIntent.current = tabId;
  }, []);
  useEffect(() => {
    if (activeTabId === undefined) return;
    const ownedBy = (map: Record<string, string[]>) =>
      Object.entries(map).find(([, ids]) => ids.includes(activeTabId))?.[0];
    const owner =
      ownedBy(stateRef.current.pinnedBySpace)
      ?? ownedBy(stateRef.current.tabsBySpace);
    if (owner === undefined) return;
    const intended = followIntent.current === activeTabId;
    if (intended) followIntent.current = undefined;
    // Only an activation that is ours — in the active space, or a declared
    // follow — may set a space's return point. A framework-picked foreign
    // successor after a close must not overwrite where that space resumes.
    if (owner === activeSpaceRef.current || intended) {
      setState((current) =>
        current.lastActive[owner] === activeTabId
          ? current
          : {
              ...current,
              lastActive: { ...current.lastActive, [owner]: activeTabId },
            },
      );
    }
    const followed = followedTab.current === activeTabId;
    followedTab.current = activeTabId;
    if (!followed && intended && owner !== activeSpaceRef.current) {
      spaces.setActive(owner);
    }
  }, [activeTabId, state.tabsBySpace, state.pinnedBySpace, spaces]);

  // The framework picks the natively-adjacent tab when the active tab
  // closes — native order interleaves spaces, so that successor can live
  // elsewhere. Re-route to the closed tab's neighbor within its own
  // space; with no neighbor left, the space goes blank (hideActive)
  // rather than presenting another space's page.
  const presented = useRef<
    { id: string; spaceId: string; successors: string[] } | undefined
  >(undefined);
  useEffect(() => {
    const last = presented.current;
    if (last === undefined) return;
    if (openTabs.some((tab) => tab.id === last.id)) return;
    presented.current = undefined;
    if (activeSpaceRef.current !== last.spaceId) return;
    const claimed = new Set([
      ...Object.values(stateRef.current.tabsBySpace).flat(),
      ...Object.values(stateRef.current.pinnedBySpace).flat(),
    ]);
    const members = new Set([
      ...(stateRef.current.pinnedBySpace[last.spaceId] ?? []),
      ...(stateRef.current.tabsBySpace[last.spaceId] ?? []),
    ]);
    const current = openTabs.find((tab) => tab.active);
    if (
      current !== undefined
      && (members.has(current.id) || !claimed.has(current.id))
    ) {
      return; // the framework already landed on one of ours
    }
    const open = new Set(openTabs.map((tab) => tab.id));
    const target = last.successors.find((id) => open.has(id));
    if (target !== undefined) perform(() => tabs.activate(target));
  }, [openTabs, perform]);

  // Space switches: land on the incoming space's last active tab if it
  // is still live; otherwise the space presents its dormant rows and no
  // page. While a switch is pending the old tab keeps presenting (no
  // blank flash); pending clears when the switch settles, and only then
  // may hideActive kick in.
  const previousSpace = useRef<string | undefined>(undefined);
  const [switchPending, setSwitchPending] = useState(false);
  useEffect(() => {
    const previous = previousSpace.current;
    previousSpace.current = activeSpaceId;
    if (previous === activeSpaceId) return;
    if (previous === undefined) return; // startup: dormant rows, no page
    setSwitchPending(true);
    perform(async () => {
      try {
        // The user may have switched again before this ran; a stale
        // completion must not activate tabs — the follower would bounce
        // the newer space right back here.
        if (activeSpaceRef.current !== activeSpaceId) return;
        const regular = stateRef.current.tabsBySpace[activeSpaceId] ?? [];
        const pinned = stateRef.current.pinnedBySpace[activeSpaceId] ?? [];
        const members = new Set([...pinned, ...regular]);
        const current = openTabsRef.current.find((tab) => tab.active);
        if (current !== undefined && members.has(current.id)) return;
        const open = new Set(openTabsRef.current.map((tab) => tab.id));
        const last = stateRef.current.lastActive[activeSpaceId];
        const target =
          last !== undefined && members.has(last) && open.has(last)
            ? last
            : regular.find((id) => open.has(id))
              ?? pinned.find((id) => open.has(id));
        if (target !== undefined) {
          await tabs.activate(target);
          return;
        }
        // Dormant rows still count as content: the palette only offers
        // itself for a space with nothing at all.
        if (members.size === 0) onEmptySpace();
      } finally {
        // A newer switch owns the flag; only the current one may clear it.
        if (activeSpaceRef.current === activeSpaceId) {
          setSwitchPending(false);
        }
      }
    });
  }, [activeSpaceId, onEmptySpace, perform]);

  // Save. The persisted form carries ordered {url, pinned, title} records
  // per space — restart-safe, unlike the session-scoped id lists and
  // identities stored next to them. Dormant entries and live pins record
  // their cached identity (a relaunched pin returns to the URL it was
  // pinned at, wherever its tab has navigated); live regular tabs record
  // the page they are on, which is what their dormant rows present after
  // a relaunch.
  useEffect(() => {
    if (
      openTabs.length === 0
      && Object.keys(state.tabsBySpace).length === 0
      && Object.keys(state.pinnedBySpace).length === 0
    ) {
      return;
    }
    const byId = new Map(openTabs.map((tab) => [tab.id, tab]));
    const recordsBySpace: Record<string, TabRecord[]> = {};
    const spaceIds = new Set([
      ...Object.keys(state.tabsBySpace),
      ...Object.keys(state.pinnedBySpace),
    ]);
    for (const spaceId of spaceIds) {
      const records: TabRecord[] = [];
      const identityRecord = (id: string, pinned: boolean): boolean => {
        const info = state.entryInfo[id];
        if (info === undefined) return false;
        if (persistable(info.url)) {
          records.push({
            url: info.url,
            pinned,
            ...(info.title === undefined ? {} : { title: info.title }),
          });
        }
        return true;
      };
      const liveRecord = (id: string, pinned: boolean): boolean => {
        // An id the tab stream has not delivered yet (a tab just
        // materialized) has nothing to record; skip the whole save — the
        // emission that delivers the tab re-runs it.
        const tab = byId.get(id);
        if (tab === undefined) return false;
        if (persistable(tab.url)) {
          records.push({
            url: tab.url,
            pinned,
            ...(tab.title ? { title: tab.title } : {}),
          });
        }
        return true;
      };
      for (const id of state.pinnedBySpace[spaceId] ?? []) {
        if (isDormantEntry(id)) {
          identityRecord(id, true);
          continue;
        }
        if (identityRecord(id, true)) continue;
        if (!liveRecord(id, true)) return;
      }
      for (const id of state.tabsBySpace[spaceId] ?? []) {
        if (isDormantEntry(id)) {
          identityRecord(id, false);
          continue;
        }
        // A live pin riding the regular order mid-drag keeps recording
        // as a pin, from its identity.
        if (identityRecord(id, true)) continue;
        if (!liveRecord(id, false)) return;
      }
      recordsBySpace[spaceId] = records;
    }
    patchShellState({
      spaceTabs: {
        tabsBySpace: state.tabsBySpace,
        pinnedBySpace: state.pinnedBySpace,
        lastActive: state.lastActive,
        recordsBySpace,
        entryInfo: state.entryInfo,
      },
    });
  }, [state, openTabs]);

  const activeRegular = state.tabsBySpace[activeSpaceId];
  const regularOrder = useMemo(() => activeRegular ?? [], [activeRegular]);
  const activePinned = state.pinnedBySpace[activeSpaceId];
  const pinnedOrder = useMemo(() => activePinned ?? [], [activePinned]);

  // Both section setters claim their entries for the active space:
  // assigning a section's order also pulls the ids out of every other
  // list — the other section of the same space (a drag across the pinned
  // divider) and other spaces entirely (the drop target owns the entry
  // now).
  const setSectionOrder = useCallback(
    (section: 'pinnedBySpace' | 'tabsBySpace', ids: string[]) => {
      const spaceId = activeSpaceRef.current;
      setState((current) => {
        const strip = (
          map: Record<string, string[]>,
          own: boolean,
        ): Record<string, string[]> => {
          const next: Record<string, string[]> = {};
          for (const [id, list] of Object.entries(map)) {
            if (own && id === spaceId) continue;
            next[id] = list.filter((entryId) => !ids.includes(entryId));
          }
          return next;
        };
        const tabsBySpace = strip(
          current.tabsBySpace,
          section === 'tabsBySpace',
        );
        const pinnedBySpace = strip(
          current.pinnedBySpace,
          section === 'pinnedBySpace',
        );
        if (section === 'tabsBySpace') tabsBySpace[spaceId] = ids;
        else pinnedBySpace[spaceId] = ids;
        return { ...current, tabsBySpace, pinnedBySpace };
      });
    },
    [],
  );
  const setRegularOrder = useCallback(
    (ids: string[]) => setSectionOrder('tabsBySpace', ids),
    [setSectionOrder],
  );
  const setPinnedOrder = useCallback(
    (ids: string[]) => setSectionOrder('pinnedBySpace', ids),
    [setSectionOrder],
  );

  const setTabPinned = useCallback((tabId: string, pinned: boolean) => {
    setState((current) => {
      const owner =
        Object.entries(current.pinnedBySpace)
          .find(([, ids]) => ids.includes(tabId))?.[0]
        ?? Object.entries(current.tabsBySpace)
          .find(([, ids]) => ids.includes(tabId))?.[0]
        ?? activeSpaceRef.current;
      const remove = (map: Record<string, string[]>) =>
        Object.fromEntries(
          Object.entries(map).map(([spaceId, ids]) => [
            spaceId,
            ids.filter((id) => id !== tabId),
          ]),
        );
      const tabsBySpace = remove(current.tabsBySpace);
      const pinnedBySpace = remove(current.pinnedBySpace);
      const home = pinned ? pinnedBySpace : tabsBySpace;
      (home[owner] ??= []).push(tabId);
      const entryInfo = { ...current.entryInfo };
      if (pinned) {
        // Pinning records the URL the tab is on — what its dormant
        // entry returns to after any later unload.
        const tab = openTabsRef.current.find(
          (candidate) => candidate.id === tabId,
        );
        if (tab !== undefined) {
          entryInfo[tabId] ??= {
            url: tab.url,
            ...(tab.title ? { title: tab.title } : {}),
          };
        }
      } else {
        delete entryInfo[tabId];
      }
      return { ...current, tabsBySpace, pinnedBySpace, entryInfo };
    });
    requestedFlags.current.set(tabId, pinned);
    void tabs.setPinned(tabId, pinned).catch(() => {
      // The framework flag is an outward sync; membership already moved.
      // The unresolved request keeps suppressing adoption of the stale
      // flag.
    });
  }, []);

  /**
   * Loads a dormant entry: creates its tab at the saved URL and takes
   * the entry's slot for the live id, in whichever section holds it. The
   * materializing counter keeps the reconciler from routing the newborn
   * tab anywhere else before the swap lands, and the in-flight set makes
   * a double-click a single load.
   */
  const openEntry = useCallback((key: string) => {
    const info = stateRef.current.entryInfo[key];
    if (info === undefined || inFlight.current.has(key)) return;
    inFlight.current.add(key);
    perform(async () => {
      materializing.current += 1;
      try {
        const created = await tabs.create({ url: info.url, active: true });
        const listedIn = (map: Record<string, string[]>) =>
          Object.values(map).some((ids) => ids.includes(key));
        const pinnedEntry = listedIn(stateRef.current.pinnedBySpace);
        if (!pinnedEntry && !listedIn(stateRef.current.tabsBySpace)) {
          // Removed while the tab was being created: honor the removal.
          await tabs.close(created.id);
          return;
        }
        setState((current) => {
          const swap = (map: Record<string, string[]>) =>
            Object.fromEntries(
              Object.entries(map).map(([spaceId, ids]) => [
                spaceId,
                ids.map((id) => (id === key ? created.id : id)),
              ]),
            );
          const entryInfo = { ...current.entryInfo };
          delete entryInfo[key];
          // Only a pin keeps an identity while live — the anchor it
          // returns to. A regular tab's record follows the tab itself.
          if (pinnedEntry) entryInfo[created.id] = info;
          return {
            ...current,
            tabsBySpace: swap(current.tabsBySpace),
            pinnedBySpace: swap(current.pinnedBySpace),
            entryInfo,
          };
        });
        if (pinnedEntry) {
          void tabs.setPinned(created.id, true).catch(() => {
            // The framework flag is an outward sync; the entry's section
            // is what makes it a pin.
          });
        }
      } finally {
        materializing.current -= 1;
        inFlight.current.delete(key);
      }
    });
  }, [perform]);

  const removeEntry = useCallback((key: string) => {
    setState((current) => {
      if (current.entryInfo[key] === undefined) return current;
      const remove = (map: Record<string, string[]>) =>
        Object.fromEntries(
          Object.entries(map).map(([spaceId, ids]) => [
            spaceId,
            ids.filter((id) => id !== key),
          ]),
        );
      const entryInfo = { ...current.entryInfo };
      delete entryInfo[key];
      return {
        ...current,
        tabsBySpace: remove(current.tabsBySpace),
        pinnedBySpace: remove(current.pinnedBySpace),
        entryInfo,
      };
    });
  }, []);

  const visibleTabs = useMemo(() => {
    const claimed = new Set([
      ...Object.values(state.tabsBySpace).flat(),
      ...Object.values(state.pinnedBySpace).flat(),
    ]);
    const members = new Set([...pinnedOrder, ...regularOrder]);
    return openTabs.filter(
      (tab) =>
        members.has(tab.id)
        // A tab no space has claimed yet is headed for the active one.
        || !claimed.has(tab.id),
    );
  }, [openTabs, pinnedOrder, regularOrder, state.tabsBySpace, state.pinnedBySpace]);

  const tabsBySpaceId = useMemo(() => {
    const byId = new Map(openTabs.map((tab) => [tab.id, tab]));
    const claimed = new Set([
      ...Object.values(state.tabsBySpace).flat(),
      ...Object.values(state.pinnedBySpace).flat(),
    ]);
    const result: Record<string, Tab[]> = {};
    for (const space of spaces.spaces) {
      const ids = [
        ...(state.pinnedBySpace[space.id] ?? []),
        ...(state.tabsBySpace[space.id] ?? []),
      ];
      const list: Tab[] = [];
      for (const id of ids) {
        const tab = byId.get(id);
        if (tab !== undefined) list.push(tab);
      }
      if (space.id === activeSpaceId) {
        for (const tab of openTabs) {
          if (!claimed.has(tab.id)) list.push(tab);
        }
      }
      result[space.id] = list;
    }
    return result;
  }, [
    openTabs,
    spaces.spaces,
    activeSpaceId,
    state.tabsBySpace,
    state.pinnedBySpace,
  ]);

  // Presenting decisions. While a switch is in flight (the render before
  // its effect runs, or its async body still working) the old tab keeps
  // showing; once settled, an active tab that is not among the space's
  // visible tabs is hidden. A member snapshot also records the close
  // successors: this space's neighbors of the presented tab, nearest
  // following first, then preceding, then the other section.
  const settled =
    previousSpace.current === activeSpaceId && !switchPending;
  const activeVisible =
    activeTab !== undefined
    && visibleTabs.some((tab) => tab.id === activeTab.id);
  const hideActive = settled && activeTab !== undefined && !activeVisible;
  if (activeTab !== undefined && activeVisible) {
    const inRegular = regularOrder.indexOf(activeTab.id);
    const inPinned = pinnedOrder.indexOf(activeTab.id);
    const successors =
      inRegular >= 0
        ? [
            ...regularOrder.slice(inRegular + 1),
            ...regularOrder.slice(0, inRegular).reverse(),
            ...pinnedOrder,
          ]
        : inPinned >= 0
          ? [
              ...pinnedOrder.slice(inPinned + 1),
              ...pinnedOrder.slice(0, inPinned).reverse(),
              ...regularOrder,
            ]
          : [...regularOrder, ...pinnedOrder]; // unclaimed newcomer
    presented.current = {
      id: activeTab.id,
      spaceId: activeSpaceId,
      successors,
    };
  }

  return {
    visibleTabs,
    regularOrder,
    setRegularOrder,
    pinnedOrder,
    setPinnedOrder,
    hideActive,
    followTab,
    tabsBySpaceId,
    entryInfo: state.entryInfo,
    openEntry,
    removeEntry,
    setTabPinned,
  };
}
