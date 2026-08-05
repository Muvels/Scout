import { Command as CommandPrimitive } from 'cmdk';
import { Search } from 'lucide-react';
import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ElementRef,
  type ReactNode,
} from 'react';
import { cn } from '../../lib/utils.js';

export const Command = forwardRef<
  ElementRef<typeof CommandPrimitive>,
  ComponentPropsWithoutRef<typeof CommandPrimitive>
>(function Command({ className, ...props }, ref) {
  return (
    <CommandPrimitive
      ref={ref}
      className={cn(
        'flex size-full flex-col overflow-hidden rounded-[inherit] text-popover-foreground',
        className,
      )}
      {...props}
    />
  );
});

export const CommandInput = forwardRef<
  ElementRef<typeof CommandPrimitive.Input>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.Input> & {
    icon?: ReactNode;
    trailing?: ReactNode;
    wrapperClassName?: string;
  }
>(function CommandInput({
  className,
  icon,
  trailing,
  wrapperClassName,
  ...props
}, ref) {
  return (
    <div
      className={cn(
        'relative flex h-[52px] shrink-0 items-center gap-2.5 px-4',
        wrapperClassName,
      )}
      cmdk-input-wrapper=""
    >
      {icon ?? (
        <Search
          className="size-4 shrink-0 text-foreground/60"
          strokeWidth={2.25}
        />
      )}
      <CommandPrimitive.Input
        ref={ref}
        className={cn(
          'h-full min-w-0 flex-1 bg-transparent text-[15px] tracking-[-0.01em] text-foreground outline-none placeholder:text-foreground/38 disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      />
      {trailing}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-3 bottom-0 h-px bg-black/8"
      />
    </div>
  );
});

export const CommandList = forwardRef<
  ElementRef<typeof CommandPrimitive.List>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(function CommandList({ className, ...props }, ref) {
  return (
    <CommandPrimitive.List
      ref={ref}
      className={cn(
        'max-h-[380px] overflow-x-hidden overflow-y-auto p-2 pt-0',
        className,
      )}
      {...props}
    />
  );
});

export const CommandEmpty = forwardRef<
  ElementRef<typeof CommandPrimitive.Empty>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>(function CommandEmpty({ className, ...props }, ref) {
  return (
    <CommandPrimitive.Empty
      ref={ref}
      className={cn(
        'py-9 text-center text-sm text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
});

export const CommandGroup = forwardRef<
  ElementRef<typeof CommandPrimitive.Group>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(function CommandGroup({ className, ...props }, ref) {
  return (
    <CommandPrimitive.Group
      ref={ref}
      className={cn(
        'overflow-hidden text-foreground [&_[cmdk-group-heading]]:flex [&_[cmdk-group-heading]]:items-center [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-slate-500',
        className,
      )}
      {...props}
    />
  );
});

export const CommandSeparator = forwardRef<
  ElementRef<typeof CommandPrimitive.Separator>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>
>(function CommandSeparator({ className, ...props }, ref) {
  return (
    <CommandPrimitive.Separator
      ref={ref}
      className={cn('mx-2 my-1 h-px bg-black/6', className)}
      {...props}
    />
  );
});

export const CommandItem = forwardRef<
  ElementRef<typeof CommandPrimitive.Item>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(function CommandItem({ className, ...props }, ref) {
  return (
    <CommandPrimitive.Item
      ref={ref}
      className={cn(
        'group relative flex min-h-10 cursor-default select-none items-center gap-3 rounded-[7px] px-2.5 py-1.5 text-[13px] outline-none transition-colors data-[disabled=true]:pointer-events-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground data-[disabled=true]:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0',
        className,
      )}
      {...props}
    />
  );
});
