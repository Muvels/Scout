import {
  Check,
  Ellipsis,
  Globe,
  Link,
  Lock,
  ShieldAlert,
  TriangleAlert,
  Wrench,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  tabs,
  type Tab,
  type TabSecurityLevel,
  type TabSiteDataTypes,
} from 'tbf/shell';
import { ShellOverlay } from 'tbf/shell/react';
import { faviconFallback, tabHost, tabTitle } from '../lib/browser.js';
import { showNativeMenu, useNativeMenuSupport } from '../lib/nativeMenu.js';
import { cn } from '../lib/utils.js';
import type { Perform, SidebarSide } from '../types.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu.js';

type SiteInfoPopoverProps = {
  open: boolean;
  active: Tab | undefined;
  sidebarOpen: boolean;
  side: SidebarSide;
  close: () => void;
  perform: Perform;
  openDevTools: () => void;
};

// What the shell can say without the browser's judgment: scheme only. The
// SDK already degrades to this on old binaries; this local copy covers the
// moment before its answer lands and backends that reject outright.
function schemeLevel(url: string): TabSecurityLevel {
  if (url.startsWith('https://')) return 'secure';
  if (url.startsWith('http://')) return 'warning';
  return 'neutral';
}

const SECURITY_CHIP: Record<
  TabSecurityLevel,
  { icon: typeof Lock; label: string; tone: string }
> = {
  secure: { icon: Lock, label: 'Secure', tone: 'text-foreground/65' },
  warning: {
    icon: TriangleAlert,
    label: 'Not Secure',
    tone: 'text-amber-700',
  },
  dangerous: { icon: ShieldAlert, label: 'Not Secure', tone: 'text-red-600' },
  neutral: { icon: Globe, label: 'Internal Page', tone: 'text-foreground/55' },
};

function PanelFavicon({ tab }: { tab: Tab }) {
  if (tab.favIconUrl) {
    return (
      <img
        src={tab.favIconUrl}
        alt=""
        className="size-[20px] shrink-0 rounded-[5px] object-contain"
      />
    );
  }
  return (
    <span className="grid size-[20px] shrink-0 place-items-center rounded-[5px] bg-black/8 text-[10px] font-bold text-black/55">
      {faviconFallback(tabTitle(tab))}
    </span>
  );
}

function Panel({
  tab,
  anchored,
  side,
  close,
  perform,
  openDevTools,
}: {
  tab: Tab;
  anchored: boolean;
  side: SidebarSide;
  close: () => void;
  perform: Perform;
  openDevTools: () => void;
}) {
  const nativeMenus = useNativeMenuSupport();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [copied, setCopied] = useState(false);
  const [level, setLevel] = useState<TabSecurityLevel>();

  // The browser's judgment of the visible page, re-asked when the page
  // changes under the open popover. Backends without the surface reject;
  // the scheme judgment stands in.
  useEffect(() => {
    let stale = false;
    setLevel(undefined);
    void tabs.getSecurityState(tab.id).then(
      (state) => {
        if (!stale) setLevel(state.level);
      },
      () => {
        if (!stale) setLevel(schemeLevel(tab.url));
      },
    );
    return () => {
      stale = true;
    };
  }, [tab.id, tab.url]);

  const chip = SECURITY_CHIP[level ?? schemeLevel(tab.url)];
  const ChipIcon = chip.icon;
  const canClear =
    tab.url.startsWith('https://') || tab.url.startsWith('http://');

  const copyLink = () => {
    void navigator.clipboard.writeText(tab.url).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    });
  };

  // Cleared state must be observable: reload the page once its site data
  // is gone, matching what the user came here to accomplish.
  const clearSiteData = (types: TabSiteDataTypes) => {
    close();
    perform(async () => {
      await tabs.clearSiteData(tab.id, types);
      await tabs.update(tab.id, { url: tab.url });
    });
  };

  const openSiteSettings = () => {
    close();
    perform(() =>
      tabs.create({ url: 'chrome://settings/content', active: true }));
  };

  const showOverflowMenu = () => {
    const rect = menuButtonRef.current?.getBoundingClientRect();
    if (!rect) return;
    void showNativeMenu(rect.left, rect.bottom + 4, [
      { id: 'clear-cache', title: 'Clear Cache', enabled: canClear },
      { id: 'clear-cookies', title: 'Clear Cookies', enabled: canClear },
      { type: 'separator' },
      { id: 'site-settings', title: 'All Site Settings…' },
    ]).then((action) => {
      if (action === 'clear-cache') clearSiteData({ cache: true });
      else if (action === 'clear-cookies') clearSiteData({ cookies: true });
      else if (action === 'site-settings') openSiteSettings();
    });
  };

  const actionButton =
    'flex h-9 flex-1 cursor-default items-center justify-center gap-2 rounded-[9px] bg-black/6 text-[12.5px] font-medium text-black/70 transition-colors hover:bg-black/10';

  return (
    <div
      className={cn(
        'absolute overflow-hidden rounded-[14px] border border-black/8 bg-popover text-popover-foreground shadow-[0_24px_70px_rgba(15,20,30,0.28),0_2px_10px_rgba(15,20,30,0.1)] backdrop-blur-2xl',
        anchored
          ? cn(
              'top-[42px] w-[min(360px,calc(100vw-24px))]',
              side === 'right' ? 'right-3' : 'left-3',
            )
          : 'left-1/2 top-[40%] w-[min(420px,calc(100vw-80px))] -translate-x-1/2 -translate-y-1/2',
      )}
    >
      <div className="flex items-center gap-2.5 px-4 pb-2.5 pt-3.5">
        <PanelFavicon tab={tab} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold leading-[17px]">
            {tabHost(tab)}
          </span>
          <span className="block truncate text-[11px] leading-[15px] text-muted-foreground">
            {tab.url}
          </span>
        </span>
      </div>

      <div className="flex gap-2 px-4 pb-3">
        <button type="button" className={actionButton} onClick={copyLink}>
          {copied ? (
            <Check className="size-[15px]" strokeWidth={2.2} />
          ) : (
            <Link className="size-[15px]" strokeWidth={2} />
          )}
          {copied ? 'Copied' : 'Copy Link'}
        </button>
        <button
          type="button"
          className={actionButton}
          onClick={() => {
            close();
            openDevTools();
          }}
        >
          <Wrench className="size-[15px]" strokeWidth={2} />
          DevTools
        </button>
      </div>

      <div className="flex items-center justify-between border-t border-black/6 py-2 pl-2.5 pr-2">
        {tab.url.startsWith('https://') ? (
          <button
            type="button"
            aria-label="Show certificate"
            className={cn(
              'flex h-7 cursor-default items-center gap-1.5 rounded-[8px] px-1.5 text-[12px] font-medium transition-colors hover:bg-black/6',
              chip.tone,
            )}
            onClick={() => {
              // The viewer is the browser's own; a binary without it just
              // leaves the chip informational.
              void tabs.showCertificate(tab.id).catch(() => {});
            }}
          >
            <ChipIcon className="size-[13px]" strokeWidth={2.2} />
            {chip.label}
          </button>
        ) : (
          <span
            className={cn(
              'flex items-center gap-1.5 px-1.5 text-[12px] font-medium',
              chip.tone,
            )}
          >
            <ChipIcon className="size-[13px]" strokeWidth={2.2} />
            {chip.label}
          </span>
        )}

        {nativeMenus === false ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="More site options"
                className="grid size-7 cursor-default place-items-center rounded-[8px] text-black/55 transition-colors hover:bg-black/8"
              >
                <Ellipsis className="size-[16px]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                disabled={!canClear}
                onSelect={() => clearSiteData({ cache: true })}
              >
                Clear Cache
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!canClear}
                onSelect={() => clearSiteData({ cookies: true })}
              >
                Clear Cookies
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={openSiteSettings}>
                All Site Settings…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <button
            ref={menuButtonRef}
            type="button"
            aria-label="More site options"
            className="grid size-7 cursor-default place-items-center rounded-[8px] text-black/55 transition-colors hover:bg-black/8"
            onClick={showOverflowMenu}
          >
            <Ellipsis className="size-[16px]" />
          </button>
        )}
      </div>
    </div>
  );
}

export function SiteInfoPopover({
  open,
  active,
  sidebarOpen,
  side,
  close,
  perform,
  openDevTools,
}: SiteInfoPopoverProps) {
  if (!open || !active) return null;

  return (
    <ShellOverlay className="fixed inset-0 z-[80] [app-region:no-drag] [-webkit-app-region:no-drag]">
      <div
        className="absolute inset-0"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      />
      <Panel
        tab={active}
        // ⌘L's anchored placement is the popover's: it replaces the palette
        // in place, so the eye never has to travel.
        anchored={sidebarOpen}
        side={side}
        close={close}
        perform={perform}
        openDevTools={openDevTools}
      />
    </ShellOverlay>
  );
}
