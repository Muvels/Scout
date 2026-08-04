import {
  Asterisk,
  Bandage,
  BedDouble,
  Bell,
  BookOpen,
  Bookmark,
  Briefcase,
  CalendarDays,
  Circle,
  CircleCheck,
  CircleDot,
  Cloud,
  Code2,
  Database,
  Dumbbell,
  File,
  Flag,
  Folder,
  Gift,
  Globe2,
  Grid2X2,
  Heart,
  Home,
  Inbox,
  Layers,
  Leaf,
  Lightbulb,
  Mail,
  Map as MapIcon,
  MessageCircle,
  Moon,
  Music2,
  Palette,
  PawPrint,
  Pizza,
  Plane,
  Plus,
  ScrollText,
  ShoppingBasket,
  Skull,
  Square,
  SquareTerminal,
  Star,
  Sun,
  ThumbsUp,
  TrainFront,
  Trash2,
  Triangle,
  Utensils,
  Users,
  Video,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import {
  spaceSwatch,
  type SpaceIcon,
} from '../lib/spaces.js';
import { cn } from '../lib/utils.js';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './ui/popover.js';

type SymbolOption = {
  value: string;
  label: string;
  icon: LucideIcon;
};

const SYMBOLS: SymbolOption[] = [
  { value: 'star', label: 'Star', icon: Star },
  { value: 'bookmark', label: 'Bookmark', icon: Bookmark },
  { value: 'heart', label: 'Heart', icon: Heart },
  { value: 'flag', label: 'Flag', icon: Flag },
  { value: 'zap', label: 'Lightning', icon: Zap },
  { value: 'triangle', label: 'Triangle', icon: Triangle },
  { value: 'asterisk', label: 'Asterisk', icon: Asterisk },
  { value: 'bell', label: 'Bell', icon: Bell },
  { value: 'lightbulb', label: 'Lightbulb', icon: Lightbulb },
  { value: 'moon', label: 'Moon', icon: Moon },
  { value: 'grid', label: 'Grid', icon: Grid2X2 },
  { value: 'circle-dot', label: 'Circle dot', icon: CircleDot },
  { value: 'layers', label: 'Layers', icon: Layers },
  { value: 'database', label: 'Database', icon: Database },
  { value: 'briefcase', label: 'Briefcase', icon: Briefcase },
  { value: 'folder', label: 'Folder', icon: Folder },
  { value: 'inbox', label: 'Inbox', icon: Inbox },
  { value: 'calendar', label: 'Calendar', icon: CalendarDays },
  { value: 'mail', label: 'Mail', icon: Mail },
  { value: 'check', label: 'Check', icon: CircleCheck },
  { value: 'file', label: 'File', icon: File },
  { value: 'book', label: 'Book', icon: BookOpen },
  { value: 'message', label: 'Message', icon: MessageCircle },
  { value: 'users', label: 'People', icon: Users },
  { value: 'terminal', label: 'Terminal', icon: SquareTerminal },
  { value: 'wrench', label: 'Tools', icon: Wrench },
  { value: 'square', label: 'Square', icon: Square },
  { value: 'circle', label: 'Circle', icon: Circle },
  { value: 'cloud', label: 'Cloud', icon: Cloud },
  { value: 'paw', label: 'Paw', icon: PawPrint },
  { value: 'basket', label: 'Basket', icon: ShoppingBasket },
  { value: 'gift', label: 'Gift', icon: Gift },
  { value: 'bed', label: 'Bed', icon: BedDouble },
  { value: 'utensils', label: 'Food', icon: Utensils },
  { value: 'dumbbell', label: 'Fitness', icon: Dumbbell },
  { value: 'plane', label: 'Travel', icon: Plane },
  { value: 'music', label: 'Music', icon: Music2 },
  { value: 'palette', label: 'Creative', icon: Palette },
  { value: 'video', label: 'Video', icon: Video },
  { value: 'bandage', label: 'Health', icon: Bandage },
  { value: 'code', label: 'Code', icon: Code2 },
  { value: 'globe', label: 'Globe', icon: Globe2 },
  { value: 'map', label: 'Map', icon: MapIcon },
  { value: 'pizza', label: 'Pizza', icon: Pizza },
  { value: 'skull', label: 'Skull', icon: Skull },
  { value: 'scroll', label: 'Writing', icon: ScrollText },
  { value: 'thumbs-up', label: 'Thumbs up', icon: ThumbsUp },
  { value: 'train', label: 'Train', icon: TrainFront },
  { value: 'home', label: 'Home', icon: Home },
  { value: 'leaf', label: 'Leaf', icon: Leaf },
  { value: 'sun', label: 'Sun', icon: Sun },
];

const EMOJIS = [
  ['⭐', 'Star'], ['💖', 'Sparkling heart'], ['🚀', 'Rocket'], ['🌎', 'Earth'],
  ['🏠', 'Home'], ['💼', 'Briefcase'], ['💡', 'Idea'], ['🎯', 'Target'],
  ['📚', 'Books'], ['💻', 'Computer'], ['🎨', 'Palette'], ['🎵', 'Music'],
  ['🎬', 'Movie'], ['🎓', 'Study'], ['✈️', 'Travel'], ['📍', 'Pin'],
  ['🌊', 'Ocean'], ['🌲', 'Nature'], ['🌸', 'Flower'], ['☀️', 'Sun'],
  ['🌙', 'Moon'], ['⚡', 'Lightning'], ['🔥', 'Fire'], ['✨', 'Sparkles'],
  ['🐶', 'Dog'], ['🐱', 'Cat'], ['🦊', 'Fox'], ['🐻', 'Bear'],
  ['🍕', 'Pizza'], ['☕', 'Coffee'], ['🍰', 'Cake'], ['🍎', 'Apple'],
  ['🏋️', 'Fitness'], ['🎮', 'Gaming'], ['📷', 'Camera'], ['🧰', 'Tools'],
  ['💬', 'Chat'], ['💰', 'Money'], ['🛒', 'Shopping'], ['🎁', 'Gift'],
  ['❤️', 'Heart'], ['😎', 'Cool'], ['🥳', 'Party'], ['🧠', 'Brain'],
  ['💥', 'Burst'], ['💯', 'Hundred'], ['✅', 'Done'], ['🚧', 'Work in progress'],
] as const;

const SYMBOL_BY_VALUE = new Map(
  SYMBOLS.map((option) => [option.value, option.icon]),
);

export function SpaceIconGlyph({
  icon,
  className,
}: {
  icon: SpaceIcon;
  className?: string;
}) {
  if (icon.kind === 'emoji') {
    return (
      <span className={cn('leading-none', className)} aria-hidden="true">
        {icon.value}
      </span>
    );
  }
  const Glyph = SYMBOL_BY_VALUE.get(icon.value) ?? Star;
  return <Glyph className={className} strokeWidth={2.15} aria-hidden="true" />;
}

export function SpaceIconPicker({
  icon,
  color,
  gradientTo,
  onChange,
}: {
  icon?: SpaceIcon;
  color: string;
  gradientTo?: string;
  onChange: (icon?: SpaceIcon) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<SpaceIcon['kind']>(icon?.kind ?? 'symbol');

  const choose = (next?: SpaceIcon) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-probe="space-icon-picker"
          className="grid size-9 shrink-0 cursor-default place-items-center rounded-lg text-white shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12),0_1px_2px_rgba(0,0,0,0.12)] outline-none transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-accent"
          style={{ background: spaceSwatch({ color, gradientTo }) }}
          aria-label={icon ? 'Change space icon' : 'Choose a space icon'}
        >
          {icon ? (
            <SpaceIconGlyph icon={icon} className="size-[18px] text-[18px] drop-shadow-sm" />
          ) : (
            <Plus className="size-4 drop-shadow-sm" strokeWidth={2.5} />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        sideOffset={10}
        collisionPadding={12}
        className="w-[296px] p-3"
      >
        <div className="flex items-center gap-2">
          <div
            className="grid h-8 flex-1 grid-cols-2 rounded-lg bg-black/6 p-0.5"
            role="tablist"
            aria-label="Space icon type"
          >
            {(['emoji', 'symbol'] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                role="tab"
                aria-selected={tab === kind}
                className={cn(
                  'cursor-default rounded-[6px] text-[12px] font-semibold capitalize outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent',
                  tab === kind
                    ? 'bg-white text-foreground shadow-sm'
                    : 'text-foreground/55 hover:text-foreground/80',
                )}
                onClick={() => setTab(kind)}
              >
                {kind === 'symbol' ? 'Icon' : 'Emoji'}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="grid size-8 shrink-0 cursor-default place-items-center rounded-lg text-foreground/55 outline-none transition-colors hover:bg-black/6 hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-25"
            aria-label="Remove space icon"
            disabled={icon === undefined}
            onClick={() => choose(undefined)}
          >
            <Trash2 className="size-4" />
          </button>
        </div>

        <div
          className="scout-scroll-area mt-3 grid max-h-60 grid-cols-8 gap-0.5 overflow-y-auto"
          role="tabpanel"
          aria-label={tab === 'emoji' ? 'Emoji choices' : 'Icon choices'}
        >
          {tab === 'emoji'
            ? EMOJIS.map(([value, label]) => {
              const selected = icon?.kind === 'emoji' && icon.value === value;
              return (
                <button
                  key={value}
                  type="button"
                  className={cn(
                    'grid size-8 cursor-default place-items-center rounded-lg text-[18px] outline-none transition-colors hover:bg-black/6 focus-visible:ring-2 focus-visible:ring-accent',
                    selected && 'bg-accent/25 ring-1 ring-accent/50',
                  )}
                  aria-label={label}
                  aria-pressed={selected}
                  onClick={() => choose({ kind: 'emoji', value })}
                >
                  <span aria-hidden="true">{value}</span>
                </button>
              );
            })
            : SYMBOLS.map(({ value, label, icon: Glyph }) => {
              const selected = icon?.kind === 'symbol' && icon.value === value;
              return (
                <button
                  key={value}
                  type="button"
                  className={cn(
                    'grid size-8 cursor-default place-items-center rounded-lg text-foreground/55 outline-none transition-colors hover:bg-black/6 hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent',
                    selected && 'bg-accent/25 text-foreground ring-1 ring-accent/50',
                  )}
                  aria-label={label}
                  aria-pressed={selected}
                  onClick={() => choose({ kind: 'symbol', value })}
                >
                  <Glyph className="size-[17px]" strokeWidth={2.1} />
                </button>
              );
            })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
