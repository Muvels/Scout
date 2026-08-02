import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ArrowUpRight,
  Columns2,
  Copy,
  Gauge,
  Minus,
  Pin,
  PinOff,
  RefreshCw,
  X,
} from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react';
import type { Tab } from 'tbf/shell';
import { tabs } from 'tbf/shell';
import {
  faviconFallback,
  faviconForUrl,
  tabHost,
  tabTitle,
} from '../lib/browser.js';
import {
  hideNativeHoverCard,
  showNativeHoverCard,
  useNativeHoverCardSupport,
} from '../lib/nativeHoverCard.js';
import {
  showNativeMenu,
  useNativeMenuSupport,
} from '../lib/nativeMenu.js';
import { cn } from '../lib/utils.js';
import type { Perform } from '../types.js';
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from './ui/context-menu.js';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from './ui/tooltip.js';

type SidebarTabProps = {
  tab: Tab;
  /**
   * Whether the row sits in the pinned section. Section membership is
   * shell state — the framework's Tab.pinned flag is not consulted, as
   * the browser flips it on its own during unrelated transitions.
   */
  pinned: boolean;
  /** The shell's pin toggle (moves the tab across the divider). */
  togglePin: (tabId: string, pinned: boolean) => void;
  /** The tab the viewport currently shows — the split partner candidate. */
  active?: Tab;
  perform: Perform;
  onMenuOpenChange?: (open: boolean) => void;
  /** True while any tab drag is in flight — silences hover tooltips. */
  dragActive?: boolean;
};

export function TabFavicon({ tab }: { tab: Tab }) {
  const title = tabTitle(tab);
  if (tab.favIconUrl) {
    return (
      <img
        src={tab.favIconUrl}
        alt=""
        className="size-4 shrink-0 rounded-[4px] object-contain"
      />
    );
  }

  return (
    <span
      className="grid size-4 shrink-0 place-items-center rounded-[4px] bg-sidebar-foreground/25 text-[9px] font-bold text-sidebar-foreground/80"
      aria-hidden="true"
    >
      {faviconFallback(title)}
    </span>
  );
}

/**
 * A dormant pin's favicon: the profile icon store's entry for the pinned
 * URL, with the monogram as the fallback for a site the store has never
 * seen (a synced or hand-edited pin that was not visited on this
 * profile).
 */
export function PinFavicon({ url, title }: { url: string; title: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span
        className="grid size-4 shrink-0 place-items-center rounded-[4px] bg-sidebar-foreground/25 text-[9px] font-bold text-sidebar-foreground/80"
        aria-hidden="true"
      >
        {faviconFallback(title)}
      </span>
    );
  }
  return (
    <img
      src={faviconForUrl(url)}
      alt=""
      className="size-4 shrink-0 rounded-[4px] object-contain"
      onError={() => setFailed(true)}
    />
  );
}

export function SidebarTab({
  tab,
  pinned,
  togglePin,
  active,
  perform,
  onMenuOpenChange,
  dragActive = false,
}: SidebarTabProps) {
  const title = tabTitle(tab);
  const nativeMenus = useNativeMenuSupport();
  const inSplit = tab.splitId !== undefined;
  const canSplit =
    !inSplit &&
    active !== undefined &&
    active.id !== tab.id &&
    active.splitId === undefined;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tab.id });

  // The native hover card rides the same open timing Radix drives for the
  // web tooltip: `hovering` mirrors the Tooltip's open state, and this
  // effect turns it into native show/hide calls while the binary supports
  // them. The web card below stays mounted only once the native path has
  // failed.
  const nativeCards = useNativeHoverCardSupport();
  const [hovering, setHovering] = useState(false);
  const rowElement = useRef<HTMLDivElement | null>(null);
  const showCard = hovering && !dragActive && nativeCards !== false;
  useEffect(() => {
    if (!showCard) return;
    const rect = rowElement.current?.getBoundingClientRect();
    if (rect === undefined) return;
    showNativeHoverCard(tab.id, {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    });
    return () => hideNativeHoverCard(tab.id);
  }, [showCard, tab.id]);

  const runAction = (action: string | null) => {
    switch (action) {
      case 'reload':
        perform(() => tabs.update(tab.id, { url: tab.url }));
        break;
      case 'duplicate':
        perform(() => tabs.create({ url: tab.url, active: true }));
        break;
      case 'split':
        if (active !== undefined) {
          perform(() => tabs.createSplit([active.id, tab.id]));
        }
        break;
      case 'unsplit':
        perform(() => tabs.removeSplit(tab.id));
        break;
      case 'pin':
        togglePin(tab.id, !pinned);
        break;
      case 'close':
        perform(() => tabs.close(tab.id));
        break;
      default:
        break;
    }
  };

  const openNativeMenu = (event: MouseEvent) => {
    if (nativeMenus === false) return;
    event.preventDefault();
    event.stopPropagation();
    onMenuOpenChange?.(true);
    void showNativeMenu(event.clientX, event.clientY, [
      {
        id: 'reload',
        title: 'Reload',
        icon: 'arrow.clockwise',
        accelerator: 'Ctrl+R',
      },
      { id: 'duplicate', title: 'Duplicate', icon: 'plus.square.on.square' },
      ...(canSplit
        ? [{
            id: 'split',
            title: 'Open in Split View',
            icon: 'rectangle.split.2x1',
          }]
        : []),
      ...(inSplit
        ? [{
            id: 'unsplit',
            title: 'Remove from Split View',
            icon: 'rectangle.split.2x1.slash',
          }]
        : []),
      {
        id: 'pin',
        title: 'Pinned',
        type: 'checkbox',
        checked: pinned,
        icon: 'pin',
      },
      { type: 'separator' },
      {
        id: 'close',
        title: 'Close Tab',
        icon: 'xmark',
        accelerator: 'Ctrl+W',
      },
    ]).then((action) => {
      onMenuOpenChange?.(false);
      runAction(action);
    });
  };

  const row = (
    <TooltipTrigger asChild>
      <div
        ref={(node: HTMLDivElement | null) => {
          setNodeRef(node);
          rowElement.current = node;
        }}
        style={{
          transform: CSS.Translate.toString(transform),
          transition: transition ?? undefined,
        }}
        {...attributes}
        {...listeners}
        className={cn(
          'group/tab flex h-9 min-w-0 touch-none items-center rounded-[10px] px-2.5 text-[13px] font-medium text-sidebar-foreground/90 outline-none transition-[background-color,color,box-shadow] duration-150',
          tab.active
            ? 'bg-tab-active text-sidebar-foreground shadow-[0_1px_2px_rgba(9,14,24,0.08)] backdrop-blur-md'
            : 'hover:bg-surface',
          isDragging && 'opacity-0',
        )}
        role="tab"
        aria-selected={tab.active}
        onContextMenu={openNativeMenu}
      >
        <button
          type="button"
          className="flex h-full min-w-0 flex-1 cursor-default items-center gap-2.5 text-left outline-none"
          onClick={() => perform(() => tabs.activate(tab.id))}
        >
          <TabFavicon tab={tab} />
          <span className="min-w-0 flex-1 truncate">{title}</span>
        </button>
        <button
          type="button"
          className={cn(
            'grid h-5 shrink-0 cursor-default place-items-center overflow-hidden rounded-md text-sidebar-foreground/55 transition-[width,opacity] duration-150 hover:bg-sidebar-foreground/15 hover:text-sidebar-foreground focus-visible:outline-none',
            // Only the active row reserves room for the close button; an
            // inactive row gives that space to its title until hovered.
            tab.active
              ? 'w-5'
              : 'w-0 opacity-0 focus-visible:w-5 focus-visible:opacity-100 group-hover/tab:w-5 group-hover/tab:opacity-100',
          )}
          aria-label={`Close ${title}`}
          onClick={() => perform(() => tabs.close(tab.id))}
        >
          {/* Arc's distinction: a pinned tab shows a minus — close the
              instance, the pin stays (the entry reverts to dormant) —
              while only unpinning can actually remove it. */}
          {pinned ? (
            <Minus className="size-3" strokeWidth={2.5} />
          ) : (
            <X className="size-3" strokeWidth={2.5} />
          )}
        </button>
      </div>
    </TooltipTrigger>
  );

  const memory = tab.memoryUsage;

  // The Tooltip stays mounted as the hover-intent clock even when the
  // browser draws the card natively; its web content renders only after the
  // native path has failed (an older binary). Hoverable content MUST be
  // disabled in native mode: Radix delegates close-on-leave to the mounted
  // TooltipContent's grace-area tracking, and with no content rendered the
  // tooltip would never close — the native card would stick to the screen.
  const withTooltip = (trigger: ReactNode) => (
    <Tooltip
      open={dragActive ? false : undefined}
      onOpenChange={setHovering}
      disableHoverableContent={nativeCards !== false}
    >
      {trigger}
      {nativeCards === false && (
        <TooltipContent
          side="right"
          align="center"
          className="w-64 overflow-hidden p-0"
        >
          <div className="grid gap-0.5 px-3 py-2.5">
            <span className="truncate text-[13px] font-bold">{title}</span>
            <span className="truncate font-normal text-muted-foreground">
              {tabHost(tab)}
            </span>
          </div>
          {memory !== undefined && Number.isFinite(memory) && (
            <div className="flex items-center gap-2 border-t border-black/8 bg-black/4 px-3 py-2 font-normal text-muted-foreground">
              <Gauge className="size-3.5 shrink-0" />
              <span>Memory usage: {Math.round(memory / 1_048_576)} MB</span>
            </div>
          )}
        </TooltipContent>
      )}
    </Tooltip>
  );

  // The web-rendered menu stays mounted only while the framework binary
  // lacks native shell menus.
  if (nativeMenus !== false) {
    return withTooltip(row);
  }

  return (
    <ContextMenu onOpenChange={onMenuOpenChange}>
      {withTooltip(<ContextMenuTrigger asChild>{row}</ContextMenuTrigger>)}

      <ContextMenuContent>
        <ContextMenuItem onSelect={() => runAction('reload')}>
          <RefreshCw />
          Reload
          <ContextMenuShortcut>⌘R</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => runAction('duplicate')}>
          <Copy />
          Duplicate
        </ContextMenuItem>
        {canSplit && (
          <ContextMenuItem onSelect={() => runAction('split')}>
            <Columns2 />
            Open in Split View
          </ContextMenuItem>
        )}
        {inSplit && (
          <ContextMenuItem onSelect={() => runAction('unsplit')}>
            <Columns2 />
            Remove from Split View
          </ContextMenuItem>
        )}
        <ContextMenuCheckboxItem
          checked={pinned}
          onCheckedChange={() => runAction('pin')}
        >
          {pinned ? (
            <PinOff className="mr-2 inline size-4" />
          ) : (
            <Pin className="mr-2 inline size-4" />
          )}
          Pinned
        </ContextMenuCheckboxItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          className="text-red-600 focus:bg-red-50 focus:text-red-700"
          onSelect={() => runAction('close')}
        >
          <X />
          Close tab
          <ContextMenuShortcut>⌘W</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

type SidebarEntryProps = {
  /** The dormant entry's identity: its key, saved URL and title. */
  entry: { id: string; url: string; title?: string };
  /** Whether the row sits in the pinned section. */
  pinned: boolean;
  /** Loads the entry — the click action. */
  open: (key: string) => void;
  /** Removes the entry (there is no tab to close). */
  remove: (key: string) => void;
  onMenuOpenChange?: (open: boolean) => void;
  /** True while any tab drag is in flight — silences hover tooltips. */
  dragActive?: boolean;
};

/**
 * A dormant entry's row. Deliberately indistinguishable from a live
 * tab's — Arc draws no loaded/unloaded distinction in the sidebar — but
 * backed by nothing: clicking creates a tab at the saved URL, which then
 * takes over this slot. In the regular section removing the entry is
 * "closing" it; a pin can only be removed by unpinning.
 */
export function SidebarEntry({
  entry,
  pinned,
  open,
  remove,
  onMenuOpenChange,
  dragActive = false,
}: SidebarEntryProps) {
  const presented = { url: entry.url, title: entry.title ?? '' };
  const title = tabTitle(presented);
  const nativeMenus = useNativeMenuSupport();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: entry.id });

  const runAction = (action: string | null) => {
    if (action === 'open') open(entry.id);
    else if (action === 'remove') remove(entry.id);
  };

  const openNativeMenu = (event: MouseEvent) => {
    if (nativeMenus === false) return;
    event.preventDefault();
    event.stopPropagation();
    onMenuOpenChange?.(true);
    void showNativeMenu(event.clientX, event.clientY, [
      { id: 'open', title: 'Open', icon: 'arrow.up.right.square' },
      { type: 'separator' },
      pinned
        ? { id: 'remove', title: 'Remove Pin', icon: 'pin.slash' }
        : { id: 'remove', title: 'Close Tab', icon: 'xmark' },
    ]).then((action) => {
      onMenuOpenChange?.(false);
      runAction(action);
    });
  };

  const row = (
    <TooltipTrigger asChild>
      <div
        ref={setNodeRef}
        style={{
          transform: CSS.Translate.toString(transform),
          transition: transition ?? undefined,
        }}
        {...attributes}
        {...listeners}
        className={cn(
          'group/tab flex h-9 min-w-0 touch-none items-center rounded-[10px] px-2.5 text-[13px] font-medium text-sidebar-foreground/90 outline-none transition-[background-color,color,box-shadow] duration-150 hover:bg-surface',
          isDragging && 'opacity-0',
        )}
        role="tab"
        aria-selected={false}
        onContextMenu={openNativeMenu}
      >
        <button
          type="button"
          className="flex h-full min-w-0 flex-1 cursor-default items-center gap-2.5 text-left outline-none"
          onClick={() => open(entry.id)}
        >
          <PinFavicon url={entry.url} title={title} />
          <span className="min-w-0 flex-1 truncate">{title}</span>
        </button>
        {!pinned && (
          <button
            type="button"
            className="grid h-5 w-0 shrink-0 cursor-default place-items-center overflow-hidden rounded-md text-sidebar-foreground/55 opacity-0 transition-[width,opacity] duration-150 hover:bg-sidebar-foreground/15 hover:text-sidebar-foreground focus-visible:w-5 focus-visible:opacity-100 focus-visible:outline-none group-hover/tab:w-5 group-hover/tab:opacity-100"
            aria-label={`Close ${title}`}
            onClick={() => remove(entry.id)}
          >
            <X className="size-3" strokeWidth={2.5} />
          </button>
        )}
      </div>
    </TooltipTrigger>
  );

  const withTooltip = (trigger: ReactNode) => (
    <Tooltip open={dragActive ? false : undefined}>
      {trigger}
      <TooltipContent
        side="right"
        align="center"
        className="w-64 overflow-hidden p-0"
      >
        <div className="grid gap-0.5 px-3 py-2.5">
          <span className="truncate text-[13px] font-bold">{title}</span>
          <span className="truncate font-normal text-muted-foreground">
            {tabHost(presented)}
          </span>
        </div>
      </TooltipContent>
    </Tooltip>
  );

  // The web-rendered menu stays mounted only while the framework binary
  // lacks native shell menus.
  if (nativeMenus !== false) {
    return withTooltip(row);
  }

  return (
    <ContextMenu onOpenChange={onMenuOpenChange}>
      {withTooltip(<ContextMenuTrigger asChild>{row}</ContextMenuTrigger>)}

      <ContextMenuContent>
        <ContextMenuItem onSelect={() => runAction('open')}>
          <ArrowUpRight />
          Open
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          className="text-red-600 focus:bg-red-50 focus:text-red-700"
          onSelect={() => runAction('remove')}
        >
          {pinned ? <PinOff /> : <X />}
          {pinned ? 'Remove pin' : 'Close tab'}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
