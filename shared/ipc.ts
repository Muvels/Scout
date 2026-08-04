import { defineIpc } from 'tbf/ipc';
import { z } from 'zod';

const searchEngineSchema = z.enum(['google', 'duckduckgo', 'bing']);

const spaceIconSchema = z.object({
  kind: z.enum(['emoji', 'symbol']),
  value: z.string().min(1).max(32),
});

const spaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  gradientTo: z.string().optional(),
  icon: spaceIconSchema.optional(),
});

const idListsSchema = z.record(z.array(z.string()));

/** One resurrectable tab: enough to reopen it in its section, in order. */
const tabRecordSchema = z.object({
  url: z.string(),
  pinned: z.boolean(),
  /** Last-known title, so an unloaded pin can present itself. */
  title: z.string().optional(),
});

/**
 * A sidebar entry's cached identity: the URL a dormant entry loads when
 * clicked — for pins, the URL the tab was pinned at, Arc-style — and the
 * title shown while no tab backs it. Keyed like the section lists'
 * entries: a live pinned tab id, or the "ent:" key of a dormant entry in
 * either section.
 */
const entryInfoSchema = z.object({
  url: z.string(),
  title: z.string().optional(),
});

const storedSpacesSchema = z.object({
  spaces: z.array(spaceSchema),
  activeId: z.string(),
});

const storedSpaceTabsSchema = z.object({
  /** Session-scoped ids — only valid while sessionStamp still matches. */
  tabsBySpace: idListsSchema,
  pinnedBySpace: idListsSchema,
  lastActive: z.record(z.string()),
  /** The restart-safe form: ordered {url, pinned} records per space. */
  recordsBySpace: z.record(z.array(tabRecordSchema)),
  /**
   * Cached identities for the section lists' dormant entries and live
   * pins. Session-scoped alongside the id lists (a fresh launch rebuilds
   * both from recordsBySpace); absent in files written before tabs went
   * lazy.
   */
  entryInfo: z.record(entryInfoSchema).optional(),
});

export const shellStateSchema = z.object({
  version: z.literal(1),
  /**
   * Stamp of the browser session that wrote the id lists. The shell keeps
   * its copy in sessionStorage — which survives shell reloads but not
   * browser relaunches — so a mismatch on load means every stored tab id
   * is stale (Chromium reuses session ids across launches) and tabs must
   * resurrect from recordsBySpace instead.
   */
  sessionStamp: z.string().optional(),
  spaces: storedSpacesSchema.optional(),
  spaceTabs: storedSpaceTabsSchema.optional(),
});

export type SearchEngine = z.infer<typeof searchEngineSchema>;
export type ShellState = z.infer<typeof shellStateSchema>;
export type StoredSpaces = z.infer<typeof storedSpacesSchema>;
export type StoredSpaceTabs = z.infer<typeof storedSpaceTabsSchema>;
export type TabRecord = z.infer<typeof tabRecordSchema>;
export type EntryInfo = z.infer<typeof entryInfoSchema>;

export const ipc = defineIpc({
  getProduct: {
    req: z.undefined(),
    res: z.object({ name: z.string(), home: z.string().url() }),
  },
  getShellState: {
    req: z.undefined(),
    res: shellStateSchema.nullable(),
  },
  setShellState: {
    req: shellStateSchema,
    res: z.undefined(),
  },
  /**
   * Typed-query completions from the selected search engine's suggest
   * endpoint, fetched by the main process: the shell document's CSP (and
   * the endpoints' missing CORS headers) rule out fetching from the shell.
   */
  getSearchSuggestions: {
    req: z.object({
      query: z.string().min(1).max(200),
      engine: searchEngineSchema,
    }),
    res: z.array(z.string()),
  },
});
