import { connectMainIpcTransport } from 'tbf/shell';
import {
  ipc,
  type EntryInfo,
  type ShellState,
  type StoredSpaces,
  type StoredSpaceTabs,
  type TabRecord,
} from '../../shared/ipc.js';
import { DEFAULT_SPACE, type Space } from './spaces.js';

const SESSION_STAMP_KEY = 'scout.session-stamp.v1';
// Legacy localStorage keys, read once to seed the file store on upgrade.
const LEGACY_SPACES_KEY = 'scout.spaces.v1';
const LEGACY_SPACE_TABS_KEY = 'scout.space-tabs.v1';
const LEGACY_ORDER_KEY = 'scout.tab-order.v1';
const LEGACY_PINS_KEY = 'scout.pinned-urls.v1';

/** Only committed page URLs are worth resurrecting on a later launch. */
export function persistable(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

/**
 * A section-list entry that is a dormant tab — a saved entry with no tab
 * behind it — rather than a live tab id. Tab ids are Chromium session
 * ids (numeric strings), so the prefix cannot collide.
 */
export function isDormantEntry(id: string): boolean {
  return id.startsWith('ent:');
}

/** A fresh identity for a dormant entry. */
export function dormantEntryKey(): string {
  return `ent:${crypto.randomUUID()}`;
}

/**
 * The runtime shape useSpaceTabs works with. Both section lists mix live
 * tab ids with the "ent:" keys of dormant entries — saved tabs no tab
 * backs yet — and entryInfo carries the cached identity (URL and title)
 * of every dormant entry and every live pin under the same key. Ids are
 * session-scoped, only trusted while the browser session that wrote them
 * is still alive; dormant entries are restart-safe and rebuild from the
 * persisted records, so a launch loads nothing until a row is clicked.
 */
export type SpaceTabsState = {
  tabsBySpace: Record<string, string[]>;
  pinnedBySpace: Record<string, string[]>;
  entryInfo: Record<string, EntryInfo>;
  lastActive: Record<string, string>;
};

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function stringRecord(value: unknown): Record<string, string> {
  if (typeof value !== 'object' || value === null) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
}

function listRecord(value: unknown): Record<string, string[]> {
  if (typeof value !== 'object' || value === null) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, list]) => [
      key,
      stringArray(list),
    ]),
  );
}

function isSpace(value: unknown): value is Space {
  const space = value as Space;
  return (
    typeof space?.id === 'string'
    && typeof space.name === 'string'
    && typeof space.color === 'string'
    && (space.gradientTo === undefined || typeof space.gradientTo === 'string')
    && (
      space.icon === undefined
      || (
        typeof space.icon === 'object'
        && space.icon !== null
        && (space.icon.kind === 'emoji' || space.icon.kind === 'symbol')
        && typeof space.icon.value === 'string'
        && space.icon.value.length > 0
        && space.icon.value.length <= 32
      )
    )
  );
}

/** The pre-per-space pin set, once global to the whole browser. */
function legacyPins(): string[] {
  try {
    const raw = localStorage.getItem(LEGACY_PINS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? [
          ...new Set(
            parsed.filter(
              (item): item is string =>
                typeof item === 'string' && persistable(item),
            ),
          ),
        ]
      : [];
  } catch {
    return [];
  }
}

function legacySpaces(): StoredSpaces | undefined {
  try {
    const raw = localStorage.getItem(LEGACY_SPACES_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Partial<StoredSpaces>;
    const spaces = Array.isArray(parsed.spaces)
      ? parsed.spaces.filter(isSpace)
      : [];
    if (spaces.length === 0) return undefined;
    const activeId = spaces.some((space) => space.id === parsed.activeId)
      ? String(parsed.activeId)
      : spaces[0].id;
    return { spaces, activeId };
  } catch {
    return undefined;
  }
}

function legacySpaceTabs(activeSpaceId: string): StoredSpaceTabs | undefined {
  try {
    const raw = localStorage.getItem(LEGACY_SPACE_TABS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const urlsBySpace = listRecord(parsed.urlsBySpace);
      // A save that predates per-space pins carries no pinned queues; the
      // old global pin set seeds the space the user is looking at.
      const pins = parsed.pinnedUrlsBySpace === undefined ? legacyPins() : [];
      const pinnedUrlsBySpace =
        parsed.pinnedUrlsBySpace !== undefined
          ? listRecord(parsed.pinnedUrlsBySpace)
          : pins.length > 0
            ? { [activeSpaceId]: pins }
            : {};
      const recordsBySpace: Record<string, TabRecord[]> = {};
      const spaceIds = new Set([
        ...Object.keys(urlsBySpace),
        ...Object.keys(pinnedUrlsBySpace),
      ]);
      for (const spaceId of spaceIds) {
        recordsBySpace[spaceId] = [
          ...(pinnedUrlsBySpace[spaceId] ?? []).map((url) => ({
            url,
            pinned: true,
          })),
          ...(urlsBySpace[spaceId] ?? []).map((url) => ({
            url,
            pinned: false,
          })),
        ];
      }
      return {
        tabsBySpace: listRecord(parsed.tabsBySpace),
        pinnedBySpace: listRecord(parsed.pinnedBySpace),
        lastActive: stringRecord(parsed.lastActive),
        recordsBySpace,
      };
    }
    // First run with spaces: the pre-spaces sidebar order and global pins
    // seed the active space, so an in-session upgrade keeps the list the
    // user was looking at.
    const legacy = localStorage.getItem(LEGACY_ORDER_KEY);
    const regular = legacy
      ? stringArray((JSON.parse(legacy) as { regular?: unknown }).regular)
      : [];
    const pins = legacyPins();
    if (regular.length === 0 && pins.length === 0) return undefined;
    return {
      tabsBySpace: regular.length > 0 ? { [activeSpaceId]: regular } : {},
      pinnedBySpace: {},
      lastActive: {},
      recordsBySpace:
        pins.length > 0
          ? { [activeSpaceId]: pins.map((url) => ({ url, pinned: true })) }
          : {},
    };
  } catch {
    return undefined;
  }
}

function legacyState(): ShellState {
  const spaces = legacySpaces();
  const activeId = spaces?.activeId ?? DEFAULT_SPACE.id;
  const spaceTabs = legacySpaceTabs(activeId);
  return {
    version: 1,
    ...(spaces === undefined ? {} : { spaces }),
    ...(spaceTabs === undefined ? {} : { spaceTabs }),
  };
}

function sessionStamp(): string | undefined {
  try {
    let value = sessionStorage.getItem(SESSION_STAMP_KEY);
    if (value === null) {
      value = crypto.randomUUID();
      sessionStorage.setItem(SESSION_STAMP_KEY, value);
    }
    return value;
  } catch {
    return undefined; // treated as a fresh session: ids stale, URLs replay
  }
}

let cached: ShellState | null = null;
let loaded = false;
let idsValid = false;
let stamp: string | undefined;
let send: ((state: ShellState) => Promise<void>) | undefined;
let loadPromise: Promise<void> | undefined;

/**
 * Loads the persisted shell state from the main process, once. Must have
 * resolved before any consumer of the initial* accessors mounts: the
 * accessors are synchronous snapshots of what this load produced. A store
 * that is absent (first launch, old binary, unreachable main) falls back
 * to the legacy localStorage keys, which seeds the file on the next save.
 */
export function loadShellStore(): Promise<void> {
  loadPromise ??= (async () => {
    stamp = sessionStamp();
    try {
      const transport = await connectMainIpcTransport();
      const bound = ipc.bind(transport);
      send = async (state: ShellState) => {
        await bound.invoke('setShellState', state);
      };
      cached = await bound.invoke('getShellState', undefined);
    } catch {
      send = undefined; // main unreachable: run session-only, never write
      cached = null;
    }
    if (cached === null) {
      // The migrating document is the same session that last wrote the
      // legacy keys whenever this is a live upgrade, so its id lists stay
      // trusted; on a cold launch they simply match no live tab.
      cached = legacyState();
      idsValid = true;
    } else {
      idsValid = stamp !== undefined && cached.sessionStamp === stamp;
    }
    loaded = true;
  })();
  return loadPromise;
}

/** The persisted spaces list, if the store (or migration) produced one. */
export function initialSpaces(): StoredSpaces | undefined {
  return cached?.spaces;
}

/**
 * The persisted space-tab state in runtime shape. A load whose session
 * stamp still matches this browser session (a shell reload) restores the
 * section lists — live ids and dormant keys — with their identities
 * verbatim. Any other load (a browser relaunch, or a file from before
 * entries carried identities) rebuilds every space from the restart-safe
 * records alone: each record becomes a dormant entry in its section,
 * rendered from its cached title and URL, loaded only when clicked.
 */
export function initialSpaceTabs(): SpaceTabsState {
  const stored = cached?.spaceTabs;
  if (stored === undefined) {
    return {
      tabsBySpace: {},
      pinnedBySpace: {},
      entryInfo: {},
      lastActive: {},
    };
  }
  if (idsValid && stored.entryInfo !== undefined) {
    return {
      tabsBySpace: stored.tabsBySpace,
      pinnedBySpace: stored.pinnedBySpace,
      entryInfo: stored.entryInfo,
      lastActive: stored.lastActive,
    };
  }
  const tabsBySpace: Record<string, string[]> = {};
  const pinnedBySpace: Record<string, string[]> = {};
  const entryInfo: Record<string, EntryInfo> = {};
  for (const [spaceId, records] of Object.entries(stored.recordsBySpace)) {
    for (const record of records) {
      const key = dormantEntryKey();
      entryInfo[key] = {
        url: record.url,
        ...(record.title === undefined ? {} : { title: record.title }),
      };
      const lists = record.pinned ? pinnedBySpace : tabsBySpace;
      (lists[spaceId] ??= []).push(key);
    }
  }
  return { tabsBySpace, pinnedBySpace, entryInfo, lastActive: {} };
}

/**
 * Merges a domain into the persisted blob and writes it through to main.
 * Saves are refused until the initial load resolves — a write before that
 * would clobber the file with default state.
 */
export function patchShellState(
  patch: Partial<Pick<ShellState, 'spaces' | 'spaceTabs'>>,
): void {
  if (!loaded) return;
  cached = {
    ...(cached ?? { version: 1 }),
    ...patch,
    version: 1,
    ...(stamp === undefined ? {} : { sessionStamp: stamp }),
  };
  if (send === undefined) return;
  void send(cached).catch(() => {
    // Persistence is a convenience; the session keeps working without it.
  });
}
