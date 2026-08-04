import {
  Pencil,
  Plus,
  SquarePlus,
  SquareStack,
  Trash2,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { tabs } from 'tbf/shell';
import {
  showNativeMenu,
  useNativeMenuSupport,
} from '../lib/nativeMenu.js';
import { SPACE_COLORS, spaceSwatch, type Space } from '../lib/spaces.js';
import { cn } from '../lib/utils.js';
import type { SpacesApi } from '../hooks/useSpaces.js';
import type { Perform } from '../types.js';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from './ui/context-menu.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu.js';
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from './ui/popover.js';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from './ui/tooltip.js';
import { SpaceIconGlyph, SpaceIconPicker } from './SpaceIconPicker.js';

type EditorState =
  | { mode: 'create' }
  | { mode: 'edit'; space: Space };

type SpacesBarProps = {
  spaces: SpacesApi;
  home: string;
  perform: Perform;
  onMenuOpenChange?: (open: boolean) => void;
};

function SwatchRow({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (color: string) => void;
  label: string;
}) {
  const custom = !SPACE_COLORS.includes(value as never);
  return (
    <div
      className="flex min-w-0 max-w-full flex-wrap items-center gap-2"
      aria-label={label}
    >
      {SPACE_COLORS.map((swatch) => (
        <button
          key={swatch}
          type="button"
          className={cn(
            'size-6 cursor-default rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1)] outline-none transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-accent',
            value === swatch
              && 'ring-2 ring-accent ring-offset-2 ring-offset-popover',
          )}
          style={{ backgroundColor: swatch }}
          aria-label={`Use color ${swatch}`}
          onClick={() => onChange(swatch)}
        />
      ))}
      <label
        className={cn(
          'relative size-6 cursor-default rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1)] transition-transform hover:scale-110',
          custom && 'ring-2 ring-accent ring-offset-2 ring-offset-popover',
        )}
        style={{
          background: custom
            ? value
            : 'conic-gradient(#ef7d9e, #f0c845, #4cbf85, #63b6d9, #8e5a9e, #ef7d9e)',
        }}
        aria-label="Pick a custom color"
      >
        <input
          type="color"
          value={value}
          className="absolute inset-0 size-full cursor-default opacity-0"
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
    </div>
  );
}

function SpaceEditor({
  state,
  spaces,
  close,
}: {
  state: EditorState;
  spaces: SpacesApi;
  close: () => void;
}) {
  const editing = state.mode === 'edit' ? state.space : undefined;
  const [name, setName] = useState(editing?.name ?? '');
  const [color, setColor] = useState(editing?.color ?? SPACE_COLORS[1]);
  const [gradientTo, setGradientTo] = useState(editing?.gradientTo);
  const [icon, setIcon] = useState(editing?.icon);

  const toggleGradient = () => {
    if (gradientTo !== undefined) {
      setGradientTo(undefined);
      return;
    }
    // A pleasant default partner: a few swatches along the ring, so the
    // fresh gradient reads immediately instead of starting monochrome.
    const index = SPACE_COLORS.indexOf(color as never);
    setGradientTo(SPACE_COLORS[((index < 0 ? 0 : index) + 3) % SPACE_COLORS.length]);
  };

  const save = () => {
    if (editing) {
      spaces.update({ ...editing, name, color, gradientTo, icon });
    } else {
      spaces.create(name, color, gradientTo, icon);
    }
    close();
  };

  return (
    <div className="grid w-full min-w-0 max-w-full gap-3 overflow-hidden">
      <div className="flex min-w-0 max-w-full items-center gap-2">
        <SpaceIconPicker
          icon={icon}
          color={color}
          gradientTo={gradientTo}
          onChange={setIcon}
        />
        <input
          autoFocus
          value={name}
          placeholder="Space name..."
          spellCheck={false}
          className="h-9 w-0 min-w-0 max-w-full flex-1 rounded-lg bg-black/6 px-3 text-[13px] font-medium text-foreground outline-none placeholder:text-foreground/38 focus:ring-2 focus:ring-accent"
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') save();
          }}
        />
      </div>

      <SwatchRow value={color} onChange={setColor} label="Space color" />

      <div className="flex min-w-0 max-w-full items-center justify-between">
        <span className="flex items-center gap-2 text-[12px] font-medium text-foreground/60">
          Gradient
          {gradientTo !== undefined && (
            <span
              className="h-3.5 w-10 rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1)]"
              style={{ background: spaceSwatch({ color, gradientTo }) }}
              aria-hidden="true"
            />
          )}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={gradientTo !== undefined}
          aria-label="Blend into a second color"
          className={cn(
            'h-5 w-9 cursor-default rounded-full p-0.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent',
            gradientTo !== undefined ? 'bg-accent' : 'bg-black/15',
          )}
          onClick={toggleGradient}
        >
          <span
            className={cn(
              'block size-4 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.25)] transition-transform',
              gradientTo !== undefined && 'translate-x-4',
            )}
          />
        </button>
      </div>

      {gradientTo !== undefined && (
        <SwatchRow
          value={gradientTo}
          onChange={setGradientTo}
          label="Gradient end color"
        />
      )}

      <div className="flex min-w-0 max-w-full items-center gap-2">
        {editing && (
          <button
            type="button"
            className="grid size-8 cursor-default place-items-center rounded-lg text-red-500/80 outline-none transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:ring-2 focus-visible:ring-red-300 disabled:opacity-35"
            aria-label="Delete space"
            disabled={spaces.spaces.length <= 1}
            onClick={() => {
              spaces.remove(editing.id);
              close();
            }}
          >
            <Trash2 className="size-4" />
          </button>
        )}
        <button
          type="button"
          className="ml-auto h-8 cursor-default rounded-lg bg-accent px-3.5 text-[13px] font-semibold text-accent-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent/60"
          onClick={save}
        >
          {editing ? 'Save' : 'Create Space'}
        </button>
      </div>
    </div>
  );
}

export function SpacesBar({
  spaces,
  home,
  perform,
  onMenuOpenChange,
}: SpacesBarProps) {
  const [editor, setEditor] = useState<EditorState>();
  const nativeMenus = useNativeMenuSupport();

  // The editor popover counts as an open menu so the hover peek stays put.
  useEffect(() => {
    if (!editor) return;
    onMenuOpenChange?.(true);
    return () => onMenuOpenChange?.(false);
  }, [editor, onMenuOpenChange]);

  return (
    <Popover
      open={editor !== undefined}
      onOpenChange={(open: boolean) => {
        if (!open) setEditor(undefined);
      }}
    >
      <PopoverAnchor asChild>
        <div className="flex min-w-0 flex-1 items-center gap-0.5 [app-region:no-drag] [-webkit-app-region:no-drag]">
          <div
            className="scout-scroll-area flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto overflow-y-hidden [justify-content:safe_center]"
            onWheel={(event) => {
              // A mouse wheel only reports vertical deltas; steer the dominant
              // axis into the strip so it scrolls without a trackpad.
              const strip = event.currentTarget;
              if (strip.scrollWidth <= strip.clientWidth) return;
              if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
                strip.scrollLeft += event.deltaY;
              }
            }}
          >
          {spaces.spaces.map((space) => {
            const active = space.id === spaces.active.id;
            const dot = (
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    'grid size-7 shrink-0 cursor-default place-items-center rounded-[7px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-sidebar-foreground/40',
                    active
                      ? 'bg-surface-hover'
                      : 'opacity-60 hover:bg-surface hover:opacity-100',
                  )}
                  aria-label={`${space.name} space`}
                  aria-pressed={active}
                  onClick={() => spaces.setActive(space.id)}
                  onContextMenu={(event) => {
                    if (nativeMenus === false) return;
                    event.preventDefault();
                    event.stopPropagation();
                    onMenuOpenChange?.(true);
                    void showNativeMenu(event.clientX, event.clientY, [
                      { id: 'edit', title: 'Edit Space', icon: 'pencil' },
                      { type: 'separator' },
                      {
                        id: 'delete',
                        title: 'Delete Space',
                        icon: 'trash',
                        enabled: spaces.spaces.length > 1,
                      },
                    ]).then((action) => {
                      onMenuOpenChange?.(false);
                      if (action === 'edit') {
                        setEditor({ mode: 'edit', space });
                      } else if (action === 'delete') {
                        spaces.remove(space.id);
                      }
                    });
                  }}
                >
                  {space.icon ? (
                    <span
                      className="grid size-[17px] place-items-center"
                      style={{
                        color: 'color-mix(in srgb, var(--sidebar-foreground) 72%, '
                          + `${space.color})`,
                      }}
                    >
                      <SpaceIconGlyph
                        icon={space.icon}
                        className="size-3 text-[12px]"
                      />
                    </span>
                  ) : (
                    <span
                      className="size-[11px] rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,0.15)]"
                      style={{ background: spaceSwatch(space) }}
                    />
                  )}
                </button>
              </TooltipTrigger>
            );
            const withTooltip = (trigger: ReactNode) => (
              <Tooltip>
                {trigger}
                <TooltipContent>{space.name}</TooltipContent>
              </Tooltip>
            );
            if (nativeMenus !== false) {
              return (
                <span key={space.id} className="contents">
                  {withTooltip(dot)}
                </span>
              );
            }
            return (
              <ContextMenu key={space.id} onOpenChange={onMenuOpenChange}>
                {withTooltip(
                  <ContextMenuTrigger asChild>{dot}</ContextMenuTrigger>,
                )}
                <ContextMenuContent>
                  <ContextMenuItem
                    onSelect={() => setEditor({ mode: 'edit', space })}
                  >
                    <Pencil />
                    Edit space
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem
                    className="text-red-600 focus:bg-red-50 focus:text-red-700"
                    disabled={spaces.spaces.length <= 1}
                    onSelect={() => spaces.remove(space.id)}
                  >
                    <Trash2 />
                    Delete space
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            );
          })}
          </div>

          {/* The single footer plus, Zen-style: one button, a small create
              menu — the OS menu when the binary supports it. The data attribute
              tells the dogfood probe that automation cannot click into it. */}
          {nativeMenus !== false ? (
            <button
              type="button"
              data-probe-native-menu=""
              className="new-tab grid size-7 shrink-0 cursor-default place-items-center rounded-[7px] text-sidebar-foreground/70 outline-none transition-colors hover:bg-surface hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-foreground/40 [app-region:no-drag] [-webkit-app-region:no-drag]"
              aria-label="Create new..."
              onClick={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                onMenuOpenChange?.(true);
                void showNativeMenu(rect.left, rect.top - 4, [
                  { id: 'new-space', title: 'New Space', icon: 'square.stack' },
                  {
                    id: 'new-tab',
                    title: 'New Tab',
                    icon: 'plus.square',
                    accelerator: 'Ctrl+T',
                  },
                ]).then((action) => {
                  onMenuOpenChange?.(false);
                  if (action === 'new-space') {
                    setEditor({ mode: 'create' });
                  } else if (action === 'new-tab') {
                    perform(() => tabs.create({ url: home, active: true }));
                  }
                });
              }}
            >
              <Plus className="size-4" strokeWidth={2} />
            </button>
          ) : (
            <DropdownMenu onOpenChange={onMenuOpenChange}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="new-tab grid size-7 shrink-0 cursor-default place-items-center rounded-[7px] text-sidebar-foreground/70 outline-none transition-colors hover:bg-surface hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-foreground/40 [app-region:no-drag] [-webkit-app-region:no-drag]"
                  aria-label="Create new..."
                >
                  <Plus className="size-4" strokeWidth={2} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="end">
                <DropdownMenuItem onSelect={() => setEditor({ mode: 'create' })}>
                  <SquareStack />
                  New Space
                </DropdownMenuItem>
                <DropdownMenuItem
                  data-probe="create-tab"
                  onSelect={() => perform(() => tabs.create({ url: home, active: true }))}
                >
                  <SquarePlus />
                  New Tab
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </PopoverAnchor>

      <PopoverContent
        side="top"
        align="end"
        sideOffset={10}
        collisionPadding={12}
        className="max-w-[calc(100vw-24px)] overflow-hidden"
      >
        {editor && (
          <SpaceEditor
            key={editor.mode === 'edit' ? editor.space.id : 'create'}
            state={editor}
            spaces={spaces}
            close={() => setEditor(undefined)}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}
