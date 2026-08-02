import {
  ArrowRight,
  Globe,
  Info,
  Search,
} from 'lucide-react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Tab } from 'tbf/shell';
import { ShellOverlay } from 'tbf/shell/react';
import type { SearchEngine } from '../../shared/ipc.js';
import { useSearchSuggestions } from '../hooks/useSearchSuggestions.js';
import {
  faviconFallback,
  isNavigableInput,
  tabTitle,
} from '../lib/browser.js';
import { spaceSwatch, type Space } from '../lib/spaces.js';
import { cn } from '../lib/utils.js';
import type { OmniboxMode, SidebarSide } from '../types.js';
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './ui/command.js';

type OmniboxProps = {
  mode: OmniboxMode | undefined;
  sidebarOpen: boolean;
  side: SidebarSide;
  active: Tab | undefined;
  spaces: Space[];
  activeSpaceId: string;
  tabsBySpaceId: Record<string, Tab[]>;
  /** The scout://settings scope: list only the active space's tabs. */
  scopeToSpace: boolean;
  searchEngine: SearchEngine;
  close: () => void;
  navigate: (input: string, mode: OmniboxMode) => void;
  activate: (tabId: string) => void;
  openSiteInfo: () => void;
};

function RowFavicon({ tab }: { tab: Tab }) {
  if (tab.favIconUrl) {
    return (
      <img
        src={tab.favIconUrl}
        alt=""
        className="size-[17px] shrink-0 rounded-[4px] object-contain"
      />
    );
  }

  return (
    <span className="grid size-[17px] shrink-0 place-items-center rounded-[4px] bg-black/8 text-[9px] font-bold text-black/55 group-data-[selected=true]:bg-white/25 group-data-[selected=true]:text-white">
      {faviconFallback(tabTitle(tab))}
    </span>
  );
}

function SwitchHint() {
  return (
    <span className="ml-auto flex shrink-0 items-center gap-2.5 text-[12px] font-medium text-black/40 group-data-[selected=true]:text-accent-foreground/85">
      Switch to Tab
      <span className="grid size-7 place-items-center rounded-[8px] bg-black/6 text-black/55 transition-colors group-data-[selected=true]:bg-white group-data-[selected=true]:text-slate-600">
        <ArrowRight className="size-[15px]" strokeWidth={2.1} />
      </span>
    </span>
  );
}

function SpaceHeading({ space }: { space: Space }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="size-[9px] rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,0.15)]"
        style={{ background: spaceSwatch(space) }}
      />
      {space.name}
    </span>
  );
}

export function Omnibox({
  mode,
  sidebarOpen,
  side,
  active,
  spaces,
  activeSpaceId,
  tabsBySpaceId,
  scopeToSpace,
  searchEngine,
  close,
  navigate,
  activate,
  openSiteInfo,
}: OmniboxProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  // ⌘L anchors to the sidebar address pill it expands on; ⌘T (and any
  // omnibox without a sidebar to anchor to) is the centered palette.
  const anchored = mode === 'navigate' && sidebarOpen;

  useEffect(() => {
    if (!mode) return;
    setQuery(mode === 'navigate' ? active?.url ?? '' : '');
    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => cancelAnimationFrame(frame);
  }, [active?.url, mode]);

  const typed = query.trim();
  // The prefilled address in navigate mode is a starting point, not a
  // query: only actual edits engage filtering, the direct action, and
  // suggestions.
  const engaged =
    mode !== undefined
    && typed.length > 0
    && (mode === 'create' || typed !== active?.url);
  const needle = engaged ? typed.toLowerCase() : '';

  // The active space leads; the rest keep the sidebar's order. Spaces not
  // visited this session hold saved URLs rather than live tabs, so they
  // simply have nothing to list yet. Filtering is done here, not by cmdk:
  // suggestion and tab rows keep a stable, deliberate order instead of
  // being re-sorted by fuzzy match scores.
  const spaceGroups = useMemo(() => {
    const ordered = [
      ...spaces.filter((space) => space.id === activeSpaceId),
      ...(scopeToSpace
        ? []
        : spaces.filter((space) => space.id !== activeSpaceId)),
    ];
    return ordered
      .map((space) => ({
        space,
        tabs: (tabsBySpaceId[space.id] ?? []).filter(
          (tab) =>
            needle === ''
            || tabTitle(tab).toLowerCase().includes(needle)
            || tab.url.toLowerCase().includes(needle),
        ),
      }))
      .filter((group) => group.tabs.length > 0);
  }, [spaces, activeSpaceId, tabsBySpaceId, scopeToSpace, needle]);
  const tabCount = spaceGroups.reduce((sum, group) => sum + group.tabs.length, 0);
  const showHeadings = !scopeToSpace && spaceGroups.length > 1;

  const suggestions = useSearchSuggestions(engaged ? typed : '', searchEngine);
  // The what-you-typed echoes duplicate the direct action row above them.
  const phraseRows = useMemo(
    () =>
      suggestions.phrases
        .filter((phrase) => phrase.trim().toLowerCase() !== needle)
        .slice(0, 5),
    [suggestions.phrases, needle],
  );
  const matchRows = useMemo(
    () =>
      suggestions.matches
        .filter(
          (match) =>
            (match.type === 'history'
              || match.type === 'bookmark'
              || match.type === 'url')
            && match.displayText.trim().toLowerCase() !== needle,
        )
        .slice(0, 3),
    [suggestions.matches, needle],
  );

  if (!mode) return null;

  const submitQuery = () => {
    const input = query.trim();
    if (!input) return;
    close();
    navigate(input, mode);
  };
  const showDirectAction = engaged;
  const listedCount =
    (showDirectAction ? 1 : 0) + phraseRows.length + matchRows.length + tabCount;
  // With no tabs and nothing typed there is nothing to list: stay a bare
  // input instead of an empty results pane.
  const showList = tabCount > 0 || typed.length > 0;

  return (
    <ShellOverlay
      className="fixed inset-0 z-[80] [app-region:no-drag] [-webkit-app-region:no-drag]"
    >
      <div
        className={cn(
          'absolute inset-0',
          anchored ? 'bg-black/5' : 'bg-black/15',
        )}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      />
      <div
        className={cn(
          'absolute overflow-hidden rounded-[14px] border border-black/8 bg-popover text-popover-foreground shadow-[0_24px_70px_rgba(15,20,30,0.28),0_2px_10px_rgba(15,20,30,0.1)] backdrop-blur-2xl',
          anchored
            ? cn(
                'top-[42px] w-[min(400px,calc(100vw-24px))]',
                side === 'right' ? 'right-3' : 'left-3',
              )
            : 'left-1/2 top-[40%] w-[min(660px,calc(100vw-80px))] -translate-x-1/2 -translate-y-1/2',
        )}
      >
        <Command
          loop
          // Filtering and ordering are handled above; cmdk only supplies
          // the keyboard-navigable list.
          shouldFilter={false}
          onKeyDown={(event) => {
            if (event.key === 'Escape') close();
          }}
        >
          <CommandInput
            ref={inputRef}
            value={query}
            onValueChange={setQuery}
            placeholder="Search or Enter URL..."
            inputMode="url"
            autoCapitalize="none"
            spellCheck={false}
            icon={
              mode === 'navigate' && query === active?.url ? (
                <Globe
                  className="size-4 shrink-0 text-foreground/60"
                  strokeWidth={2}
                />
              ) : undefined
            }
            trailing={
              mode === 'navigate' && active ? (
                <button
                  type="button"
                  aria-label="Site information"
                  className="grid size-6 shrink-0 cursor-default place-items-center rounded-[6px] text-foreground/40 transition-colors hover:bg-black/6 hover:text-foreground/70"
                  // The input keeps focus through the press; only a completed
                  // click hands the overlay to the site-info popover.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    close();
                    openSiteInfo();
                  }}
                >
                  <Info className="size-[17px]" strokeWidth={1.8} />
                </button>
              ) : (
                <span
                  className="grid size-6 shrink-0 place-items-center text-foreground/40"
                  aria-hidden="true"
                >
                  <Info className="size-[17px]" strokeWidth={1.8} />
                </span>
              )
            }
          />

          {showList && (
          <CommandList className={cn(!anchored && 'max-h-[420px]')}>
            {listedCount === 0 && (
              <div className="py-9 text-center text-sm text-muted-foreground">
                No tabs or sites found.
              </div>
            )}

            {(showDirectAction
              || phraseRows.length > 0
              || matchRows.length > 0) && (
              <CommandGroup>
                {showDirectAction && (
                  <CommandItem
                    value={`open search navigate ${query}`}
                    className={cn(!anchored && 'min-h-12 px-3')}
                    onSelect={submitQuery}
                  >
                    {isNavigableInput(query)
                      ? <Globe className="size-[17px] text-black/55 group-data-[selected=true]:text-accent-foreground" strokeWidth={2} />
                      : <Search className="size-[17px] text-black/55 group-data-[selected=true]:text-accent-foreground" strokeWidth={2.25} />}
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {isNavigableInput(query)
                        ? `Open ${query.trim()}`
                        : `Search for “${query.trim()}”`}
                    </span>
                    <span className="ml-auto flex shrink-0 items-center gap-2.5 text-[12px] font-medium text-black/40 group-data-[selected=true]:text-accent-foreground/85">
                      {mode === 'create' ? 'New Tab' : 'Go'}
                      <span className="grid size-7 place-items-center rounded-[8px] bg-black/6 text-black/55 transition-colors group-data-[selected=true]:bg-white group-data-[selected=true]:text-slate-600">
                        <ArrowRight className="size-[15px]" strokeWidth={2.1} />
                      </span>
                    </span>
                  </CommandItem>
                )}

                {phraseRows.map((phrase) => (
                  <CommandItem
                    key={`phrase-${phrase}`}
                    value={`phrase ${phrase}`}
                    className={cn(!anchored && 'min-h-12 px-3')}
                    onSelect={() => {
                      close();
                      navigate(phrase, mode);
                    }}
                  >
                    <Search className="size-[17px] text-black/55 group-data-[selected=true]:text-accent-foreground" strokeWidth={2.25} />
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {phrase}
                    </span>
                  </CommandItem>
                ))}

                {matchRows.map((match) => (
                  <CommandItem
                    key={`match-${match.id}-${match.destinationUrl}`}
                    value={`match ${match.id} ${match.destinationUrl}`}
                    className={cn(!anchored && 'min-h-12 px-3')}
                    onSelect={() => {
                      close();
                      navigate(match.destinationUrl, mode);
                    }}
                  >
                    {match.iconUrl ? (
                      <img
                        src={match.iconUrl}
                        alt=""
                        className="size-[17px] shrink-0 rounded-[4px] object-contain"
                      />
                    ) : (
                      <Globe className="size-[17px] text-black/55 group-data-[selected=true]:text-accent-foreground" strokeWidth={2} />
                    )}
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {match.displayText}
                    </span>
                    {match.description
                      && match.description !== match.displayText && (
                      <span className="ml-auto max-w-[40%] shrink-0 truncate text-[12px] font-medium text-black/40 group-data-[selected=true]:text-accent-foreground/85">
                        {match.description}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {spaceGroups.map((group) => (
              <CommandGroup
                key={group.space.id}
                heading={
                  showHeadings ? <SpaceHeading space={group.space} /> : undefined
                }
              >
                {group.tabs.map((tab) => {
                  const title = tabTitle(tab);
                  return (
                    <CommandItem
                      key={tab.id}
                      value={`tab ${tab.id}`}
                      className={cn(!anchored && 'min-h-12 px-3')}
                      onSelect={() => {
                        close();
                        activate(tab.id);
                      }}
                    >
                      <RowFavicon tab={tab} />
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {title}
                      </span>
                      {!anchored && <SwitchHint />}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}

          </CommandList>
          )}
        </Command>
      </div>
    </ShellOverlay>
  );
}
