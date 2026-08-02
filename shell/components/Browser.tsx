import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { commands, extensions, tabs, windows } from 'tbf/shell';
import { ShellOverlay, type TbfTabViewElement } from 'tbf/shell/react';
import { usePanes } from '../hooks/usePanes.js';
import { useProduct } from '../hooks/useProduct.js';
import { useSpaces } from '../hooks/useSpaces.js';
import { useSpaceTabs } from '../hooks/useSpaceTabs.js';
import { destinationForInput, setSearchEngine } from '../lib/browser.js';
import { cn } from '../lib/utils.js';
import type { SearchEngine } from '../../shared/ipc.js';
import type { OmniboxMode, Perform, SidebarSide } from '../types.js';
import { BrowserViewport } from './BrowserViewport.js';
import { ErrorToast } from './ErrorToast.js';
import { Omnibox } from './Omnibox.js';
import { Sidebar } from './Sidebar.js';
import { SiteInfoPopover } from './SiteInfoPopover.js';
import { TooltipProvider } from './ui/tooltip.js';
import noiseTexture from '../../assets/noise-light.png';

const DEFAULT_SIDEBAR_WIDTH = 200;
const SIDEBAR_OPEN_KEY = 'scout.sidebar-open.v5';
const SIDEBAR_WIDTH_KEY = 'scout.sidebar-width.v5';
const SIDEBAR_SIDE_KEY = 'scout.sidebar-side.v1';
const NOISE_KEY = 'scout.noise-bg.v1';
const PALETTE_SCOPE_KEY = 'scout.palette-scope.v1';
const SEARCH_ENGINE_KEY = 'scout.search-engine.v1';
const CONTENT_BLOCKER_KEY = 'scout.content-blocker.v1';
// The bundled uBlock Origin's id, fixed by the "key" field in
// extensions/ublock/manifest.json.
const CONTENT_BLOCKER_EXTENSION_ID = 'gjhofpnohmhinlhhhmdhfcdbajahcblk';

function storedBoolean(key: string, fallback: boolean): boolean {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value === 'true';
  } catch {
    return fallback;
  }
}

function storedNumber(key: string, fallback: number): number {
  try {
    const value = Number(localStorage.getItem(key));
    return Number.isFinite(value) && value > 0 ? value : fallback;
  } catch {
    return fallback;
  }
}

function storedSide(key: string): SidebarSide {
  try {
    return localStorage.getItem(key) === 'right' ? 'right' : 'left';
  } catch {
    return 'left';
  }
}

function storedEngine(key: string): SearchEngine {
  try {
    const value = localStorage.getItem(key);
    return value === 'duckduckgo' || value === 'bing' ? value : 'google';
  } catch {
    return 'google';
  }
}

// scout://settings lives on its own origin and has no storage or IPC in
// common with the shell; it announces shell-facing settings by flashing
// them through its URL fragment, which arrives here as a tab url update.
function beaconedSide(tabList: { url: string }[]): SidebarSide | undefined {
  for (const tab of tabList) {
    // The reported url is canonicalized ("scout://settings/#…").
    if (!tab.url.startsWith('scout://settings')) continue;
    const match = /[#&]sidebar-side=(left|right)(?:&|$)/.exec(tab.url);
    if (match) return match[1] as SidebarSide;
  }
  return undefined;
}

function beaconedNoise(tabList: { url: string }[]): boolean | undefined {
  for (const tab of tabList) {
    if (!tab.url.startsWith('scout://settings')) continue;
    const match = /[#&]noise-bg=(on|off)(?:&|$)/.exec(tab.url);
    if (match) return match[1] === 'on';
  }
  return undefined;
}

function beaconedPaletteScope(tabList: { url: string }[]): boolean | undefined {
  for (const tab of tabList) {
    if (!tab.url.startsWith('scout://settings')) continue;
    const match = /[#&]palette-scope=(on|off)(?:&|$)/.exec(tab.url);
    if (match) return match[1] === 'on';
  }
  return undefined;
}

function beaconedContentBlocker(
  tabList: { url: string }[],
): boolean | undefined {
  for (const tab of tabList) {
    if (!tab.url.startsWith('scout://settings')) continue;
    const match = /[#&]content-blocker=(on|off)(?:&|$)/.exec(tab.url);
    if (match) return match[1] === 'on';
  }
  return undefined;
}

function beaconedEngine(
  tabList: { url: string }[],
): SearchEngine | undefined {
  for (const tab of tabList) {
    if (!tab.url.startsWith('scout://settings')) continue;
    const match = /[#&]search-engine=(google|duckduckgo|bing)(?:&|$)/.exec(
      tab.url,
    );
    if (match) return match[1] as SearchEngine;
  }
  return undefined;
}

export function Browser() {
  const openTabs = tabs.useTabs();
  const frameworkActive = openTabs.find((tab) => tab.active);
  const [error, setError] = useState<string>();
  const [omnibox, setOmnibox] = useState<OmniboxMode>();
  const [siteInfo, setSiteInfo] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(
    () => storedBoolean(SIDEBAR_OPEN_KEY, true),
  );
  const [peek, setPeek] = useState(false);
  const [sidebarWidth, setSidebarWidthState] = useState(
    () => storedNumber(SIDEBAR_WIDTH_KEY, DEFAULT_SIDEBAR_WIDTH),
  );
  const spaces = useSpaces();
  const [sidebarSide, setSidebarSideState] = useState<SidebarSide>(
    () => storedSide(SIDEBAR_SIDE_KEY),
  );
  const [noiseBg, setNoiseBg] = useState(
    () => storedBoolean(NOISE_KEY, false),
  );
  const [paletteScope, setPaletteScope] = useState(
    () => storedBoolean(PALETTE_SCOPE_KEY, false),
  );
  const [searchEngine, setSearchEngineState] = useState<SearchEngine>(
    () => storedEngine(SEARCH_ENGINE_KEY),
  );
  const [contentBlocker, setContentBlocker] = useState(
    () => storedBoolean(CONTENT_BLOCKER_KEY, true),
  );
  const right = sidebarSide === 'right';
  // The page card's inset on the sidebar's side — the sidebar's width, or
  // the collapsed gutter. The gradient mask and the elevation shadow
  // share it.
  const pageEdge = sidebarOpen ? sidebarWidth : 6;

  // Apply the side the settings page beacons through its URL fragment.
  const beaconed = beaconedSide(openTabs);
  useEffect(() => {
    if (beaconed === undefined) return;
    setSidebarSideState(beaconed);
    try {
      localStorage.setItem(SIDEBAR_SIDE_KEY, beaconed);
    } catch {
      // Persistence is a convenience; the flip still applies this session.
    }
  }, [beaconed]);

  // Same channel for the noise-texture toggle.
  const beaconedNoiseOn = beaconedNoise(openTabs);
  useEffect(() => {
    if (beaconedNoiseOn === undefined) return;
    setNoiseBg(beaconedNoiseOn);
    try {
      localStorage.setItem(NOISE_KEY, String(beaconedNoiseOn));
    } catch {
      // Persistence is a convenience; the toggle still applies this session.
    }
  }, [beaconedNoiseOn]);

  // Same channel for the palette's current-space-only scope.
  const beaconedScope = beaconedPaletteScope(openTabs);
  useEffect(() => {
    if (beaconedScope === undefined) return;
    setPaletteScope(beaconedScope);
    try {
      localStorage.setItem(PALETTE_SCOPE_KEY, String(beaconedScope));
    } catch {
      // Persistence is a convenience; the toggle still applies this session.
    }
  }, [beaconedScope]);

  // Same channel for the search engine; the choice also retargets typed
  // searches (destinationForInput) via the lib/browser module setter.
  const beaconedSearch = beaconedEngine(openTabs);
  useEffect(() => {
    if (beaconedSearch === undefined) return;
    setSearchEngineState(beaconedSearch);
    try {
      localStorage.setItem(SEARCH_ENGINE_KEY, beaconedSearch);
    } catch {
      // Persistence is a convenience; the choice still applies this session.
    }
  }, [beaconedSearch]);
  useEffect(() => {
    setSearchEngine(searchEngine);
  }, [searchEngine]);

  // Same channel for the ad & tracker blocking toggle.
  const beaconedBlocker = beaconedContentBlocker(openTabs);
  useEffect(() => {
    if (beaconedBlocker === undefined) return;
    setContentBlocker(beaconedBlocker);
    try {
      localStorage.setItem(CONTENT_BLOCKER_KEY, String(beaconedBlocker));
    } catch {
      // Persistence is a convenience; the toggle still applies this session.
    }
  }, [beaconedBlocker]);
  // Enforce the setting against the bundled uBlock Origin — at boot, so the
  // choice survives restarts no matter what happened to the extension's own
  // state, and on every toggle. Disabling deactivates it fully: no
  // background page, no request filtering.
  useEffect(() => {
    void extensions
      .setEnabled(CONTENT_BLOCKER_EXTENSION_ID, contentBlocker)
      .catch(() => {
        // Binaries without the bundled blocker (or the API) just browse
        // unfiltered; the setting re-applies on the next boot that has it.
      });
  }, [contentBlocker]);

  // The browser still owns a few paths that create a real NTP (the File
  // menu's New Tab, a keystroke landing before command registration). A
  // foreground chrome NTP always means "user asked for a new tab" — the
  // shell never foregrounds one itself — so replace it with the palette.
  useEffect(() => {
    const ntp = openTabs.find((tab) =>
      tab.active
      && (tab.url.startsWith('chrome://newtab')
        || tab.url.startsWith('chrome://new-tab-page')));
    if (ntp === undefined) return;
    void tabs.close(ntp.id).catch(() => {
      // Losing the race to another close is fine.
    });
    setOmnibox('create');
  }, [openTabs]);

  // A side flip translates the tab view, the overlay input regions, and the
  // window-controls measurer without resizing them — and a pure translation
  // fires none of the SDK's layout signals (resize/scroll/size/intersection/
  // animation), so the native viewport would stay at the old coordinates.
  // Their window-resize handlers re-measure unconditionally; poke that path.
  useEffect(() => {
    window.dispatchEvent(new Event('resize'));
  }, [sidebarSide]);

  const report = useCallback((reason: unknown): void => {
    setError(
      reason instanceof Error ? reason.message : 'Browser action failed.',
    );
  }, []);
  const product = useProduct(report);

  const perform: Perform = useCallback((action) => {
    setError(undefined);
    void action().catch(report);
  }, [report]);

  // Switching to a space with no tabs offers the palette instead of a
  // stranded empty sidebar.
  const openPalette = useCallback(() => setOmnibox('create'), []);
  const spaceTabs = useSpaceTabs(openTabs, spaces, perform, openPalette);

  // The presented tab. A framework-active tab that belongs to another
  // space is not shown — switching to a space with nothing to activate,
  // or losing a space's last tab, lands on the blank content wash
  // (Arc-style) instead of a foreign space's page.
  const active = spaceTabs.hideActive ? undefined : frameworkActive;
  const partner = active?.splitId
    ? openTabs.find(
        (tab) => tab.id !== active.id && tab.splitId === active.splitId,
      )
    : undefined;
  const paneIds = usePanes(active, partner);
  const split = paneIds[0] !== undefined && paneIds[1] !== undefined;

  // A tab needs page pixels below the shell before the cover can lift, or
  // the desktop shows through the page hole. The browser reports per-tab
  // paint state: painted === false means the surface below is still empty,
  // and painted flips true at the first visually non-empty paint — usually
  // well before status turns 'complete', which is what lets page content
  // show while the loading bar is still running. Binaries that never report
  // paint state (painted === undefined) fall back to "first load finished",
  // which also bridges the gap between tab creation and the first report.
  const everLoaded = useRef(new Set<string>());
  for (const tab of openTabs) {
    if (tab.status !== 'loading') everLoaded.current.add(tab.id);
  }
  const coverPageHole = active !== undefined
    && (active.painted === false
      || (active.painted === undefined
        && active.status === 'loading'
        && !everLoaded.current.has(active.id)));

  // The "sidebar" material blurs whatever is behind the window, so the
  // chrome's translucent paint reads as a tinted wash instead of showing
  // the desktop sharply. Unguarded on purpose: it is idempotent, and hot
  // reloads preserve ref state, so a guarded effect would never re-apply
  // it in a live session.
  useEffect(() => {
    void windows.list().then((list) => {
      const own = list.find((window) => window.focused) ?? list[0];
      return own ? windows.setVibrancy(own.id, 'sidebar') : undefined;
    }).catch(() => {
      // Pre-vibrancy binaries just keep the sharp transparency.
    });
  }, []);

  const openUrl = useCallback((url: string) => {
    perform(() => active
      ? tabs.update(active.id, { url })
      : tabs.create({ url, active: true }));
  }, [active, perform]);

  const navigate = useCallback((input: string, mode: OmniboxMode) => {
    const url = destinationForInput(input);
    if (!url) {
      setError('Enter an address or search query.');
      return;
    }
    if (mode === 'create') {
      perform(() => tabs.create({ url, active: true }));
      return;
    }
    openUrl(url);
  }, [openUrl, perform]);

  const setSidebarWidth = useCallback((width: number) => {
    setSidebarWidthState(width);
    try {
      localStorage.setItem(SIDEBAR_WIDTH_KEY, String(width));
    } catch {
      // Persistence is a convenience; resizing still works without it.
    }
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((current) => {
      const next = !current;
      try {
        localStorage.setItem(SIDEBAR_OPEN_KEY, String(next));
      } catch {
        // Keep the interaction usable when storage is unavailable.
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (sidebarOpen) setPeek(false);
  }, [sidebarOpen]);

  // The peek panel must survive its own popovers: menus portal outside the
  // panel, so a plain mouseleave would dismiss the sidebar exactly when the
  // pointer reaches for a menu item. Close only when the pointer is gone
  // AND no menu is open, after a short grace period for gaps in the path.
  const peekPointer = useRef(false);
  const peekMenus = useRef(0);
  const peekCloseTimer = useRef<number | undefined>(undefined);
  const schedulePeekClose = useCallback(() => {
    window.clearTimeout(peekCloseTimer.current);
    peekCloseTimer.current = window.setTimeout(() => {
      if (!peekPointer.current && peekMenus.current <= 0) setPeek(false);
    }, 260);
  }, []);
  const peekPointerEnter = useCallback(() => {
    peekPointer.current = true;
    window.clearTimeout(peekCloseTimer.current);
  }, []);
  const peekPointerLeave = useCallback(() => {
    peekPointer.current = false;
    schedulePeekClose();
  }, [schedulePeekClose]);
  const peekMenuChange = useCallback((open: boolean) => {
    peekMenus.current = Math.max(0, peekMenus.current + (open ? 1 : -1));
    if (!open) schedulePeekClose();
  }, [schedulePeekClose]);

  const activeRef = useRef(active);
  activeRef.current = active;

  // Site info describes one page: switching tabs (or losing the tab) ends
  // that conversation, and an opening palette takes the overlay for itself.
  const activeId = active?.id;
  useEffect(() => {
    setSiteInfo(false);
  }, [activeId]);
  useEffect(() => {
    if (omnibox !== undefined) setSiteInfo(false);
  }, [omnibox]);

  const closeActiveTab = useCallback(() => {
    const tab = activeRef.current;
    if (tab) perform(() => tabs.close(tab.id));
  }, [perform]);

  const reloadActiveTab = useCallback(() => {
    const tab = activeRef.current;
    if (tab) perform(() => tabs.update(tab.id, { url: tab.url }));
  }, [perform]);

  const openDevTools = useCallback(() => {
    const tab = activeRef.current;
    if (tab === undefined) return;
    // The op rides the tab-view element that presents the tab; with a
    // split there are two mounted, so match on the attached tab id.
    const view = [...document.querySelectorAll('tbf-tab-view')].find(
      (candidate) =>
        (candidate as unknown as TbfTabViewElement).tabId === tab.id,
    ) as unknown as TbfTabViewElement | undefined;
    if (typeof view?.openDevTools !== 'function') return;
    void view.openDevTools().catch(report);
  }, [report]);

  // Browser-level accelerators. DOM keydown only reaches the shell while it
  // has focus; the moment the user clicks into the page, the tab owns the
  // keyboard — without these, a hidden sidebar could never be reopened.
  // ("Ctrl" is the cross-platform token; it arrives as ⌘ on macOS.)
  const nativeShortcuts = useRef(new Set<string>());
  useEffect(() => {
    let disposed = false;
    const unsubscribers: (() => void)[] = [];
    const bindings: [string, string, () => void][] = [
      ['Ctrl+B', 'b', toggleSidebar],
      ['Ctrl+T', 't', () => setOmnibox('create')],
      ['Ctrl+K', 'k', () => setOmnibox('create')],
      ['Ctrl+L', 'l', () => setOmnibox('navigate')],
      ['Ctrl+W', 'w', closeActiveTab],
      ['Ctrl+R', 'r', reloadActiveTab],
      ['Ctrl+Alt+I', 'i', openDevTools],
    ];
    for (const [accelerator, key, run] of bindings) {
      void commands.register(accelerator, run).then((unsubscribe) => {
        if (disposed) {
          unsubscribe();
          return;
        }
        unsubscribers.push(unsubscribe);
        nativeShortcuts.current.add(key);
      }).catch(() => {
        // The DOM fallback below still covers shell-focused input.
      });
    }
    return () => {
      disposed = true;
      for (const unsubscribe of unsubscribers) unsubscribe();
      nativeShortcuts.current.clear();
    };
  }, [closeActiveTab, openDevTools, reloadActiveTab, toggleSidebar]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOmnibox(undefined);
        setSiteInfo(false);
        return;
      }
      const command = event.metaKey || event.ctrlKey;
      // A successfully registered native accelerator consumes the keystroke
      // before it reaches this document; this fallback only serves the keys
      // whose registration failed.
      if (!command || nativeShortcuts.current.has(event.key)) return;
      // ⌥ rewrites event.key on macOS, so the devtools chord matches on
      // the physical key instead.
      if (event.altKey) {
        if (event.code === 'KeyI' && !nativeShortcuts.current.has('i')) {
          event.preventDefault();
          openDevTools();
        }
        return;
      }
      if (event.key === 'l') {
        event.preventDefault();
        setOmnibox('navigate');
      } else if (event.key === 't' || event.key === 'k') {
        event.preventDefault();
        setOmnibox('create');
      } else if (event.key === 'w') {
        event.preventDefault();
        closeActiveTab();
      } else if (event.key === 'b') {
        event.preventDefault();
        toggleSidebar();
      } else if (event.key === 'r') {
        event.preventDefault();
        reloadActiveTab();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [closeActiveTab, openDevTools, reloadActiveTab, toggleSidebar]);

  // Two-finger horizontal swipes over the shell chrome hop between spaces,
  // Arc-style. Wheel events only reach this document over shell surfaces —
  // the page rect belongs to the page — and the spaces strip keeps its own
  // horizontal wheel scrolling while it overflows. Natural scrolling
  // reports a leftward finger swipe as positive deltaX (content follows
  // the fingers), so positive advances to the space on the right. One
  // physical swipe lands one hop: after a hop, momentum deltas only
  // refresh a calm timer, and accumulation restarts once the stream has
  // stayed quiet. A slow drag commits once enough drift accumulates; an
  // energetic flick commits on its first strong delta rather than waiting
  // out the trackpad's ramp-up, so the hop tracks the finger without lag.
  const spacesRef = useRef(spaces);
  spacesRef.current = spaces;
  useEffect(() => {
    const THRESHOLD = 40;
    const FLICK = 32;
    const FLOOR = 4;
    const CALM_MS = 150;
    let sum = 0;
    let lastAt = 0;
    let locked = false;
    let calmTimer: number | undefined;
    const scheduleUnlock = () => {
      window.clearTimeout(calmTimer);
      calmTimer = window.setTimeout(() => {
        locked = false;
        sum = 0;
      }, CALM_MS);
    };
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
      const strip = (event.target as Element | null)
        ?.closest?.('.scout-scroll-area');
      if (strip && strip.scrollWidth > strip.clientWidth) return;
      if (locked) {
        if (Math.abs(event.deltaX) >= FLOOR) scheduleUnlock();
        return;
      }
      const now = performance.now();
      if (now - lastAt > 300) sum = 0; // a stale drift is not a swipe
      lastAt = now;
      sum += event.deltaX;
      if (Math.abs(sum) < THRESHOLD && Math.abs(event.deltaX) < FLICK) return;
      const forward = sum > 0;
      sum = 0;
      locked = true;
      scheduleUnlock();
      const { spaces: list, active: current, setActive } = spacesRef.current;
      const index = list.findIndex((space) => space.id === current.id);
      const next = index + (forward ? 1 : -1);
      if (next >= 0 && next < list.length) setActive(list[next].id);
    };
    window.addEventListener('wheel', onWheel, { passive: true });
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.clearTimeout(calmTimer);
    };
  }, []);

  // The chrome-only cutout both washes below share: everything except the
  // page card's rounded hole — the tab composites below this document, so
  // nothing may paint over that rect.
  const holeMask: CSSProperties = {
    maskImage:
      'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\'%3E%3Crect width=\'100%25\' height=\'100%25\' rx=\'10\' ry=\'10\' fill=\'white\'/%3E%3C/svg%3E"), linear-gradient(#000 0 0)',
    maskSize: `calc(100% - ${pageEdge + 6}px) calc(100% - 12px), 100% 100%`,
    maskPosition: `${right ? 6 : pageEdge}px 6px, 0 0`,
    maskRepeat: 'no-repeat',
    maskComposite: 'exclude',
  };

  return (
    <TooltipProvider delayDuration={380}>
      {/* The page composites below this document, so the shell must keep
          the page rect at alpha 0: the chrome is painted around the hole
          (sidebar column + the viewport's frame), never as a window-wide
          backdrop. */}
      <main
        className={cn(
          'browser fixed inset-0 flex overflow-hidden rounded-[12px] text-sidebar-foreground',
          right && 'flex-row-reverse',
        )}
        aria-label="Scout browser"
        style={{
          '--sidebar-width': `${sidebarWidth}px`,
        } as CSSProperties}
      >
        {/* The gradient wash over the chrome — the shared luminosity ramp,
            plus the active space's two color stops when it has a gradient.
            Sits above the frame painter's flat tint (z-20) so gradient
            colors read at full strength, and below the sidebar content
            (z-30). The page rect is cut out of the mask — the tab
            composites below this document, so nothing may paint over it —
            and the hole's corners are rounded to the card radius (an SVG
            mask keeps rx in CSS pixels at any size), so the wash hugs the
            card edge with no notch seams. */}
        <div
          className="pointer-events-none absolute inset-0 z-[25]"
          aria-hidden="true"
          style={{
            background: 'var(--chrome-gradient)',
            ...holeMask,
          } as CSSProperties}
        />

        {/* Arc's grain: a tiled noise texture over the chrome, sharing the
            gradient wash's cutout so the page rect stays untouched. A later
            sibling at the same z paints above the wash. */}
        {noiseBg && (
          <div
            className="pointer-events-none absolute inset-0 z-[25] opacity-55 mix-blend-soft-light"
            aria-hidden="true"
            style={{
              backgroundImage: `url(${noiseTexture})`,
              backgroundRepeat: 'repeat',
              ...holeMask,
            } as CSSProperties}
          />
        )}

        {/* The card's elevation shadow, above the gradient wash so it stays
            visible; outer shadows never paint inside the border box, so the
            page rect stays clear. */}
        <div
          className="pointer-events-none absolute z-[26] rounded-[10px] shadow-[0_10px_36px_rgba(9,14,24,0.16),0_2px_10px_rgba(9,14,24,0.08)]"
          style={{
            left: right ? 6 : pageEdge,
            top: 6,
            right: right ? pageEdge : 6,
            bottom: 6,
          }}
          aria-hidden="true"
        />
        {sidebarOpen ? (
          <ShellOverlay
            // No background of its own: the viewport's frame painter is the
            // single translucent paint source for all chrome, and this
            // column stacks above it (z-30) for its content only.
            className="relative z-30 h-full shrink-0 [app-region:no-drag] [-webkit-app-region:no-drag]"
            style={{ width: sidebarWidth }}
          >
            <Sidebar
              active={active}
              openTabs={spaceTabs.visibleTabs}
              pinnedOrder={spaceTabs.pinnedOrder}
              setPinnedOrder={spaceTabs.setPinnedOrder}
              regularOrder={spaceTabs.regularOrder}
              setRegularOrder={spaceTabs.setRegularOrder}
              entryInfo={spaceTabs.entryInfo}
              openEntry={spaceTabs.openEntry}
              removeEntry={spaceTabs.removeEntry}
              setTabPinned={spaceTabs.setTabPinned}
              width={sidebarWidth}
              side={sidebarSide}
              spaces={spaces}
              perform={perform}
              openOmnibox={setOmnibox}
              home={product.home}
              setWidth={setSidebarWidth}
              collapse={toggleSidebar}
              openDevTools={openDevTools}
            />
          </ShellOverlay>
        ) : (
          <div className="h-full w-1.5 shrink-0 [app-region:drag] [-webkit-app-region:drag]" />
        )}

        <BrowserViewport
          active={active}
          paneIds={paneIds}
          split={split}
          side={sidebarSide}
          coverPageHole={coverPageHole}
        />

        {/* Window drag surfaces: the gutters framing the page card. */}
        <div
          className="absolute inset-x-0 top-0 z-20 h-1.5 [app-region:drag] [-webkit-app-region:drag]"
          aria-hidden="true"
        />
        <div
          className={cn(
            'absolute inset-y-0 z-20 w-1.5 [app-region:drag] [-webkit-app-region:drag]',
            right ? 'left-0' : 'right-0',
          )}
          aria-hidden="true"
        />
        <div
          className="absolute inset-x-0 bottom-0 z-20 h-1.5 [app-region:drag] [-webkit-app-region:drag]"
          aria-hidden="true"
        />

        {/* Unpinned sidebar: resting the pointer on the sidebar's edge
            floats it over the page; ⌘B pins it again. */}
        {!sidebarOpen && (
          <ShellOverlay
            className={cn(
              'absolute inset-y-0 z-40 w-2 [app-region:no-drag] [-webkit-app-region:no-drag]',
              right ? 'right-0' : 'left-0',
            )}
          >
            <div
              className="size-full"
              onMouseEnter={() => {
                peekPointerEnter();
                setPeek(true);
              }}
              onMouseLeave={peekPointerLeave}
            />
          </ShellOverlay>
        )}

        {!sidebarOpen && peek && (
          <ShellOverlay
            className={cn(
              'absolute bottom-1.5 top-1.5 z-40 [app-region:no-drag] [-webkit-app-region:no-drag]',
              right ? 'right-1.5' : 'left-1.5',
            )}
            style={{ width: sidebarWidth }}
          >
            <div
              className={cn(
                'size-full overflow-hidden rounded-[14px] bg-sidebar shadow-[0_0_0_0.5px_rgba(255,255,255,0.14),0_18px_50px_rgba(9,14,24,0.38),0_2px_10px_rgba(9,14,24,0.18)] animate-in fade-in-0 duration-150',
                right ? 'slide-in-from-right-2' : 'slide-in-from-left-2',
              )}
              onMouseEnter={peekPointerEnter}
              onMouseLeave={peekPointerLeave}
            >
              <Sidebar
                active={active}
                openTabs={spaceTabs.visibleTabs}
                pinnedOrder={spaceTabs.pinnedOrder}
                setPinnedOrder={spaceTabs.setPinnedOrder}
                regularOrder={spaceTabs.regularOrder}
                setRegularOrder={spaceTabs.setRegularOrder}
                entryInfo={spaceTabs.entryInfo}
                openEntry={spaceTabs.openEntry}
                removeEntry={spaceTabs.removeEntry}
                setTabPinned={spaceTabs.setTabPinned}
                width={sidebarWidth}
                side={sidebarSide}
                spaces={spaces}
                perform={perform}
                openOmnibox={setOmnibox}
                home={product.home}
                setWidth={setSidebarWidth}
                collapse={toggleSidebar}
                openDevTools={openDevTools}
                pinned={false}
                onMenuOpenChange={peekMenuChange}
              />
            </div>
          </ShellOverlay>
        )}

        <Omnibox
          mode={omnibox}
          sidebarOpen={sidebarOpen}
          side={sidebarSide}
          active={active}
          spaces={spaces.spaces}
          activeSpaceId={spaces.active.id}
          tabsBySpaceId={spaceTabs.tabsBySpaceId}
          scopeToSpace={paletteScope}
          searchEngine={searchEngine}
          close={() => setOmnibox(undefined)}
          navigate={navigate}
          activate={(tabId) => {
            // A deliberate jump: the space may follow the tab to its owner.
            spaceTabs.followTab(tabId);
            perform(() => tabs.activate(tabId));
          }}
          openSiteInfo={() => setSiteInfo(true)}
        />

        <SiteInfoPopover
          open={siteInfo}
          active={active}
          sidebarOpen={sidebarOpen}
          side={sidebarSide}
          close={() => setSiteInfo(false)}
          perform={perform}
          openDevTools={openDevTools}
        />

        <ErrorToast message={error} />
      </main>
    </TooltipProvider>
  );
}
