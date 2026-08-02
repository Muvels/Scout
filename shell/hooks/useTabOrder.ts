import {
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import type { Tab } from 'tbf/shell';
import type { EntryInfo } from '../../shared/ipc.js';
import { isDormantEntry } from '../lib/shellStore.js';

type Section = 'pinned' | 'regular';

/**
 * One section row: a live tab, or a dormant entry — a saved tab with
 * nothing behind it, presented from its cached identity and loaded only
 * when clicked.
 */
export type TabRow =
  | { kind: 'live'; id: string; tab: Tab }
  | { kind: 'dormant'; id: string; url: string; title?: string };

/**
 * Shell-owned tab arrangement. Both sections' orders are the active
 * space's lists (pins are per-space too), mixing live tabs with dormant
 * entries; the framework has no reorder API, so the lists are the truth
 * and dragging across the pinned divider calls the shell's own pin
 * toggle. Dormant entries drag like any row — with no tab involved, a
 * cross-divider move is purely a list move.
 */
export function useTabOrder(
  openTabs: Tab[],
  pinnedOrder: string[],
  regularOrder: string[],
  setPinnedOrder: (ids: string[]) => void,
  setRegularOrder: (ids: string[]) => void,
  entryInfo: Record<string, EntryInfo>,
  setTabPinned: (tabId: string, pinned: boolean) => void,
) {
  const [draggingId, setDraggingId] = useState<string>();
  const snapshot = useRef<{
    pinned: string[];
    regular: string[];
  } | undefined>(undefined);

  const sections = useMemo(() => {
    const byId = new Map(openTabs.map((tab) => [tab.id, tab]));
    const rows = (order: string[]): TabRow[] => {
      const list: TabRow[] = [];
      for (const id of order) {
        if (isDormantEntry(id)) {
          const info = entryInfo[id];
          if (info !== undefined) {
            list.push({
              kind: 'dormant',
              id,
              url: info.url,
              ...(info.title === undefined ? {} : { title: info.title }),
            });
          }
          continue;
        }
        const tab = byId.get(id);
        if (tab !== undefined) list.push({ kind: 'live', id, tab });
      }
      return list;
    };
    const pinned = rows(pinnedOrder);
    const regular = rows(regularOrder);
    // Tabs no list holds yet (created this instant, the claim pending)
    // render at the end of the section the claim will route them to.
    const listed = new Set([...pinnedOrder, ...regularOrder]);
    for (const tab of openTabs) {
      if (listed.has(tab.id)) continue;
      (tab.pinned ? pinned : regular).push({
        kind: 'live',
        id: tab.id,
        tab,
      });
    }
    return { pinned, regular };
  }, [openTabs, pinnedOrder, regularOrder, entryInfo]);

  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;

  const rowIds = useCallback((section: Section): string[] =>
    sectionsRef.current[section].map((row) => row.id), []);

  const sectionOf = useCallback((id: string): Section | undefined => {
    if (id === 'pinned' || id === 'regular') return id;
    if (sectionsRef.current.pinned.some((row) => row.id === id)) {
      return 'pinned';
    }
    if (sectionsRef.current.regular.some((row) => row.id === id)) {
      return 'regular';
    }
    return undefined;
  }, []);

  const onDragStart = useCallback((event: DragStartEvent) => {
    snapshot.current = {
      pinned: rowIds('pinned'),
      regular: rowIds('regular'),
    };
    setDraggingId(String(event.active.id));
  }, [rowIds]);

  const onDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    const from = sectionOf(activeId);
    const to = sectionOf(overId);
    if (!from || !to || from === to) return;

    const source = rowIds(from).filter((id) => id !== activeId);
    const target = rowIds(to);
    const overIndex = target.indexOf(overId);
    target.splice(overIndex >= 0 ? overIndex : target.length, 0, activeId);
    if (from === 'pinned') {
      setPinnedOrder(source);
      setRegularOrder(target);
    } else {
      setPinnedOrder(target);
      setRegularOrder(source);
    }
  }, [rowIds, sectionOf, setPinnedOrder, setRegularOrder]);

  const onDragEnd = useCallback((event: DragEndEvent) => {
    setDraggingId(undefined);
    const origin = snapshot.current;
    snapshot.current = undefined;
    const { active, over } = event;
    const activeId = String(active.id);
    const section = sectionOf(activeId);
    if (!section || !origin) return;

    const overId = over ? String(over.id) : undefined;
    if (overId && overId !== activeId && sectionOf(overId) === section) {
      const ids = rowIds(section);
      const fromIndex = ids.indexOf(activeId);
      const toIndex = ids.indexOf(overId);
      if (fromIndex >= 0 && toIndex >= 0) {
        const moved = arrayMove(ids, fromIndex, toIndex);
        if (section === 'pinned') setPinnedOrder(moved);
        else setRegularOrder(moved);
      }
    }

    // A live tab dropped across the divider changes what it is; the
    // shell op moves identity along with membership. Dormant entries
    // already moved with the order — there is no tab to toggle.
    const crossed =
      origin[section === 'pinned' ? 'regular' : 'pinned'].includes(activeId);
    if (crossed && !isDormantEntry(activeId)) {
      setTabPinned(activeId, section === 'pinned');
    }
  }, [rowIds, sectionOf, setPinnedOrder, setRegularOrder, setTabPinned]);

  const onDragCancel = useCallback(() => {
    setDraggingId(undefined);
    if (snapshot.current) {
      setPinnedOrder(snapshot.current.pinned);
      setRegularOrder(snapshot.current.regular);
      snapshot.current = undefined;
    }
  }, [setPinnedOrder, setRegularOrder]);

  const dragging: TabRow | undefined = useMemo(() => {
    if (draggingId === undefined) return undefined;
    return (
      sections.pinned.find((row) => row.id === draggingId)
      ?? sections.regular.find((row) => row.id === draggingId)
    );
  }, [draggingId, sections]);

  return {
    pinned: sections.pinned,
    regular: sections.regular,
    dragging,
    onDragStart,
    onDragOver,
    onDragEnd,
    onDragCancel,
  };
}
