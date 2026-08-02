import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  ArrowLeft,
  ArrowRight,
  Download,
  Ellipsis,
  PanelLeftClose,
  PanelLeftOpen,
  Pin,
  Plus,
  Puzzle,
  RefreshCw,
  Search,
  Settings as SettingsIcon,
  Wrench,
} from 'lucide-react';
import {
  useCallback,
  type CSSProperties,
  type PointerEvent,
} from 'react';
import type { Tab } from 'tbf/shell';
import { tabs } from 'tbf/shell';
import { TrafficLights } from 'tbf/shell/react';
import type { EntryInfo } from '../../shared/ipc.js';
import { useTabOrder, type TabRow } from '../hooks/useTabOrder.js';
import {
  showNativeMenu,
  useNativeMenuSupport,
} from '../lib/nativeMenu.js';
import type { SpacesApi } from '../hooks/useSpaces.js';
import { tabHost, tabTitle } from '../lib/browser.js';
import { cn } from '../lib/utils.js';
import type { OmniboxMode, Perform, SidebarSide } from '../types.js';
import {
  PinFavicon,
  SidebarEntry,
  SidebarTab,
  TabFavicon,
} from './SidebarTab.js';
import { SpaceSlide } from './SpaceSlide.js';
import { SpacesBar } from './SpacesBar.js';
import { Button } from './ui/button.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from './ui/dropdown-menu.js';
import { ScrollArea } from './ui/scroll-area.js';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from './ui/tooltip.js';

type SidebarProps = {
  active: Tab | undefined;
  openTabs: Tab[];
  /** The active space's section orders; drag & drop writes them back. */
  pinnedOrder: string[];
  setPinnedOrder: (ids: string[]) => void;
  regularOrder: string[];
  setRegularOrder: (ids: string[]) => void;
  /** Cached identities for the orders' dormant "ent:" entries. */
  entryInfo: Record<string, EntryInfo>;
  /** Loads a dormant entry (a click on its row). */
  openEntry: (key: string) => void;
  /** Removes a dormant entry. */
  removeEntry: (key: string) => void;
  /** The shell's pin toggle (context menu and cross-divider drags). */
  setTabPinned: (tabId: string, pinned: boolean) => void;
  width: number;
  side?: SidebarSide;
  spaces: SpacesApi;
  home: string;
  perform: Perform;
  openOmnibox: (mode: OmniboxMode) => void;
  setWidth: (width: number) => void;
  /** Toggles between pinned and hidden; in the hover peek this pins. */
  collapse: () => void;
  /** Opens DevTools for the active tab. */
  openDevTools: () => void;
  pinned?: boolean;
  /** Lets the hover peek keep itself open while a menu is showing. */
  onMenuOpenChange?: (open: boolean) => void;
};

function TabSection({
  id,
  rows,
  active,
  perform,
  onMenuOpenChange,
  openEntry,
  removeEntry,
  setTabPinned,
  label,
  className,
  dropHint,
  dragActive,
}: {
  id: 'pinned' | 'regular';
  rows: TabRow[];
  active?: Tab;
  perform: Perform;
  onMenuOpenChange?: (open: boolean) => void;
  openEntry: (key: string) => void;
  removeEntry: (key: string) => void;
  setTabPinned: (tabId: string, pinned: boolean) => void;
  label: string;
  className?: string;
  dropHint?: boolean;
  dragActive?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <SortableContext
      items={rows.map((row) => row.id)}
      strategy={verticalListSortingStrategy}
    >
      <div
        ref={setNodeRef}
        className={cn('space-y-1', className)}
        role="tablist"
        aria-label={label}
      >
        {rows.map((row) =>
          row.kind === 'live' ? (
            <SidebarTab
              key={row.id}
              tab={row.tab}
              pinned={id === 'pinned'}
              togglePin={setTabPinned}
              active={active}
              perform={perform}
              onMenuOpenChange={onMenuOpenChange}
              dragActive={dragActive}
            />
          ) : (
            <SidebarEntry
              key={row.id}
              entry={row}
              pinned={id === 'pinned'}
              open={openEntry}
              remove={removeEntry}
              onMenuOpenChange={onMenuOpenChange}
              dragActive={dragActive}
            />
          ),
        )}
        {dropHint && rows.length === 0 && (
          <div
            className={cn(
              'grid h-9 place-items-center rounded-[10px] border border-dashed border-sidebar-foreground/25 text-[11px] font-semibold text-sidebar-foreground/50 transition-colors',
              isOver && 'border-sidebar-foreground/50 bg-surface text-sidebar-foreground/80',
            )}
          >
            <span className="flex items-center gap-1.5">
              <Pin className="size-3" />
              Pin
            </span>
          </div>
        )}
      </div>
    </SortableContext>
  );
}

function ToolButton({
  label,
  children,
  ...props
}: {
  label: string;
  children: React.ReactNode;
} & React.ComponentProps<typeof Button>) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={label}
          {...props}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function Sidebar({
  active,
  openTabs,
  pinnedOrder,
  setPinnedOrder,
  regularOrder,
  setRegularOrder,
  entryInfo,
  openEntry,
  removeEntry,
  setTabPinned,
  width,
  side = 'left',
  spaces,
  home,
  perform,
  openOmnibox,
  setWidth,
  collapse,
  openDevTools,
  pinned = true,
  onMenuOpenChange,
}: SidebarProps) {
  const {
    pinned: pinnedRows,
    regular: regularRows,
    dragging,
    onDragStart,
    onDragOver,
    onDragEnd,
    onDragCancel,
  } = useTabOrder(
    openTabs,
    pinnedOrder,
    regularOrder,
    setPinnedOrder,
    setRegularOrder,
    entryInfo,
    setTabPinned,
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );
  const nativeMenus = useNativeMenuSupport();

  const beginResize = useCallback((event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = width;

    const move = (moveEvent: globalThis.PointerEvent) => {
      // On the right side the handle sits on the sidebar's left edge, so
      // dragging toward the window centre grows the width.
      const delta = (moveEvent.clientX - startX) * (side === 'right' ? -1 : 1);
      setWidth(Math.min(320, Math.max(176, startWidth + delta)));
    };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop, { once: true });
  }, [setWidth, side, width]);

  // "Clear" empties the regular section — live tabs close, dormant
  // entries are removed — and never touches pins or the presented tab.
  const closeOtherTabs = () => {
    for (const row of regularRows) {
      if (row.kind === 'live') {
        if (row.id !== active?.id) perform(() => tabs.close(row.id));
      } else {
        removeEntry(row.id);
      }
    }
  };

  return (
    <aside
      className="relative flex h-full flex-col overflow-hidden text-sidebar-foreground"
      style={{ width } as CSSProperties}
      aria-label="Scout sidebar"
    >
      <header className="shrink-0 px-2.5 pt-3 [app-region:drag] [-webkit-app-region:drag]">
        <div className="flex h-7 items-center [app-region:no-drag] [-webkit-app-region:no-drag]">
          {/* The window controls live in the sidebar header and follow it
              to whichever side it sits on — the native buttons are placed
              from this element's measured rect. */}
          <div className="mr-auto grid h-6 w-[54px] shrink-0 place-items-center">
            <TrafficLights
              className="block h-[12px] w-[52px]"
              fallback={
                <span className="flex gap-2" aria-hidden="true">
                  <i className="size-3 rounded-full bg-[#ff5f57] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.15)]" />
                  <i className="size-3 rounded-full bg-[#febc2e] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.15)]" />
                  <i className="size-3 rounded-full bg-[#28c840] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.15)]" />
                </span>
              }
            />
          </div>
          <ToolButton
            label="Back"
            // canGoBack is undefined on browsers that don't report history
            // state — keep the button live there and let the rejection
            // no-op, like a browser back button at the start of history.
            disabled={active === undefined || active.canGoBack === false}
            onClick={() => {
              if (active) void tabs.goBack(active.id).catch(() => {});
            }}
          >
            <ArrowLeft />
          </ToolButton>
          <ToolButton
            label="Forward"
            disabled={active === undefined || active.canGoForward === false}
            onClick={() => {
              if (active) void tabs.goForward(active.id).catch(() => {});
            }}
          >
            <ArrowRight />
          </ToolButton>
          {!pinned && (
            <ToolButton label="Pin sidebar (⌘B)" onClick={collapse}>
              <Pin />
            </ToolButton>
          )}
          {nativeMenus !== false ? (
            <ToolButton
              label="More browser options"
              onClick={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                onMenuOpenChange?.(true);
                void showNativeMenu(rect.left, rect.bottom + 4, [
                  {
                    id: 'open-location',
                    title: 'Open Location',
                    icon: 'magnifyingglass',
                    accelerator: 'Ctrl+L',
                  },
                  {
                    id: 'new-tab',
                    title: 'New Tab',
                    icon: 'plus.square',
                    accelerator: 'Ctrl+T',
                  },
                  {
                    id: 'reload',
                    title: 'Reload This Tab',
                    icon: 'arrow.clockwise',
                    accelerator: 'Ctrl+R',
                    enabled: active !== undefined,
                  },
                  {
                    id: 'devtools',
                    title: 'Developer Tools',
                    icon: 'wrench.and.screwdriver',
                    accelerator: 'Ctrl+Alt+I',
                    enabled: active !== undefined,
                  },
                  { type: 'separator' },
                  {
                    id: 'settings',
                    title: 'Settings…',
                    icon: 'gearshape',
                  },
                  {
                    id: 'extensions',
                    title: 'Extensions…',
                    icon: 'puzzlepiece.extension',
                  },
                  { type: 'separator' },
                  pinned
                    ? {
                        id: 'toggle-sidebar',
                        title: 'Hide Sidebar',
                        icon: 'sidebar.left',
                        accelerator: 'Ctrl+B',
                      }
                    : {
                        id: 'toggle-sidebar',
                        title: 'Pin Sidebar',
                        icon: 'pin',
                        accelerator: 'Ctrl+B',
                      },
                ]).then((action) => {
                  onMenuOpenChange?.(false);
                  if (action === 'open-location') openOmnibox('navigate');
                  else if (action === 'new-tab') openOmnibox('create');
                  else if (action === 'reload' && active) {
                    perform(() => tabs.update(active.id, { url: active.url }));
                  } else if (action === 'devtools') {
                    openDevTools();
                  } else if (action === 'settings') {
                    perform(() =>
                      tabs.create({ url: 'scout://settings', active: true }));
                  } else if (action === 'extensions') {
                    perform(() =>
                      tabs.create({ url: 'chrome://extensions', active: true }));
                  } else if (action === 'toggle-sidebar') collapse();
                });
              }}
            >
              <Ellipsis />
            </ToolButton>
          ) : (
            <DropdownMenu onOpenChange={onMenuOpenChange}>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="More browser options"
                >
                  <Ellipsis />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => openOmnibox('navigate')}>
                  <Search />
                  Open location
                  <DropdownMenuShortcut>⌘L</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => openOmnibox('create')}>
                  <Plus />
                  New tab
                  <DropdownMenuShortcut>⌘T</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={active === undefined}
                  onSelect={() => {
                    if (active) {
                      perform(() =>
                        tabs.update(active.id, { url: active.url }));
                    }
                  }}
                >
                  <RefreshCw />
                  Reload this tab
                  <DropdownMenuShortcut>⌘R</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={active === undefined}
                  onSelect={openDevTools}
                >
                  <Wrench />
                  Developer tools
                  <DropdownMenuShortcut>⌥⌘I</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() =>
                    perform(() =>
                      tabs.create({ url: 'scout://settings', active: true }))
                  }
                >
                  <SettingsIcon />
                  Settings…
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() =>
                    perform(() =>
                      tabs.create({ url: 'chrome://extensions', active: true }))
                  }
                >
                  <Puzzle />
                  Extensions…
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={collapse}>
                  {pinned ? <PanelLeftClose /> : <PanelLeftOpen />}
                  {pinned ? 'Hide sidebar' : 'Pin sidebar'}
                  <DropdownMenuShortcut>⌘B</DropdownMenuShortcut>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <button
          type="button"
          className={cn(
            'mt-2 flex h-10 w-full cursor-default items-center rounded-[10px] bg-surface px-3 text-left outline-none backdrop-blur-md transition-colors hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-sidebar-foreground/40 [app-region:no-drag] [-webkit-app-region:no-drag]',
            !active && 'gap-2 text-sidebar-foreground/55',
          )}
          aria-label={active ? `Current address: ${tabHost(active)}` : 'Search or enter URL'}
          onClick={() => openOmnibox('navigate')}
        >
          {active ? (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold leading-[15px] text-sidebar-foreground/90">
                {tabHost(active)}
              </span>
              <span className="block truncate text-[11px] leading-[14px] text-sidebar-foreground/55">
                {tabTitle(active)}
              </span>
            </span>
          ) : (
            <>
              <Search className="size-[14px] shrink-0 opacity-70" />
              <span className="text-[13px] font-medium">Search...</span>
            </>
          )}
        </button>

      </header>

      {/* Only the tab lists ride the space-switch slide; the header and
          the footer's spaces strip hold still, like Arc. */}
      <SpaceSlide
        slideKey={spaces.active.id}
        index={spaces.spaces.findIndex((space) => space.id === spaces.active.id)}
        className="min-h-0 flex-1"
      >
        <ScrollArea className="h-full px-2.5 pt-3">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragEnd={onDragEnd}
            onDragCancel={onDragCancel}
          >
            <TabSection
              id="pinned"
              rows={pinnedRows}
              active={active}
              perform={perform}
              onMenuOpenChange={onMenuOpenChange}
              openEntry={openEntry}
              removeEntry={removeEntry}
              setTabPinned={setTabPinned}
              label="Pinned tabs"
              dropHint={dragging !== undefined}
              dragActive={dragging !== undefined}
            />

            <div className="group/clear mt-1 flex h-4 items-center">
              <span className="h-px min-w-0 flex-1 justify-center items-center bg-sidebar-foreground/15" />
              {/* Zero width until the divider row is hovered, so the line
                  spans the full sidebar at rest. */}
              <button
                type="button"
                className="max-w-0 cursor-default overflow-hidden whitespace-nowrap text-[8px] font-medium text-sidebar-foreground/40 opacity-0 outline-none transition-all hover:text-sidebar-foreground/75 focus-visible:max-w-12 focus-visible:pl-2 focus-visible:opacity-100 group-hover/clear:max-w-12 group-hover/clear:pl-2 group-hover/clear:opacity-100"
                onClick={closeOtherTabs}
              >
                <span className="text-[12px] font-bold">Clear</span>
              </button>
            </div>

            <button
              type="button"
              className="flex h-9 w-full cursor-default items-center gap-2.5 rounded-[10px] px-2.5 text-left text-[13px] font-medium text-sidebar-foreground/55 outline-none transition-colors hover:bg-surface hover:text-sidebar-foreground/85 focus-visible:ring-2 focus-visible:ring-sidebar-foreground/40"
              onClick={() => openOmnibox('create')}
            >
              <Plus className="size-3" strokeWidth={4} />
              <span className="text-[13px] font-medium">New Tab</span>
            </button>

            <TabSection
              id="regular"
              rows={regularRows}
              active={active}
              perform={perform}
              onMenuOpenChange={onMenuOpenChange}
              openEntry={openEntry}
              removeEntry={removeEntry}
              setTabPinned={setTabPinned}
              label="Open tabs"
              className="tab-strip mt-1 pb-3"
              dragActive={dragging !== undefined}
            />

            <DragOverlay
              dropAnimation={{
                duration: 160,
                easing: 'cubic-bezier(0.2, 0, 0, 1)',
              }}
            >
              {dragging !== undefined && (
                <div className="flex h-9 items-center gap-2.5 rounded-[10px] bg-tab-active px-2.5 text-[13px] font-medium text-sidebar-foreground shadow-[0_10px_30px_rgba(9,14,24,0.35),0_2px_8px_rgba(9,14,24,0.2)] backdrop-blur-md">
                  {dragging.kind === 'live' ? (
                    <TabFavicon tab={dragging.tab} />
                  ) : (
                    <PinFavicon
                      url={dragging.url}
                      title={tabTitle({
                        url: dragging.url,
                        title: dragging.title ?? '',
                      })}
                    />
                  )}
                  <span className="min-w-0 flex-1 truncate">
                    {tabTitle(
                      dragging.kind === 'live'
                        ? dragging.tab
                        : { url: dragging.url, title: dragging.title ?? '' },
                    )}
                  </span>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        </ScrollArea>
      </SpaceSlide>

      <footer className="flex h-11 shrink-0 items-center gap-1 px-3 pb-1 [app-region:drag] [-webkit-app-region:drag]">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="grid size-7 shrink-0 cursor-default place-items-center rounded-[7px] text-sidebar-foreground/70 outline-none transition-colors hover:bg-surface hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-foreground/40 [app-region:no-drag] [-webkit-app-region:no-drag]"
              aria-label="Downloads"
              onClick={() => {
                const existing = openTabs.find((tab) =>
                  tab.url.startsWith('chrome://downloads'));
                perform(() =>
                  existing
                    ? tabs.activate(existing.id)
                    : tabs.create({ url: 'chrome://downloads', active: true }));
              }}
            >
              <Download className="size-4" strokeWidth={2} />
            </button>
          </TooltipTrigger>
          <TooltipContent>Downloads</TooltipContent>
        </Tooltip>
        <SpacesBar
          spaces={spaces}
          home={home}
          perform={perform}
          onMenuOpenChange={onMenuOpenChange}
        />
      </footer>

      <div
        className={cn(
          'absolute inset-y-0 z-30 w-1 cursor-col-resize transition-colors hover:bg-sidebar-foreground/25 [app-region:no-drag] [-webkit-app-region:no-drag]',
          side === 'right' ? 'left-0' : 'right-0',
        )}
        onPointerDown={beginResize}
        role="separator"
        aria-label="Resize sidebar"
        aria-orientation="vertical"
        aria-valuemin={176}
        aria-valuemax={320}
        aria-valuenow={width}
      />
    </aside>
  );
}
