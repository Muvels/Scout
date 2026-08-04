import * as PopoverPrimitive from '@radix-ui/react-popover';
import { ShellOverlay } from 'tbf/shell/react';
import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ElementRef,
} from 'react';
import { cn } from '../../lib/utils.js';

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;

export const PopoverContent = forwardRef<
  ElementRef<typeof PopoverPrimitive.Content>,
  ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(function PopoverContent(
  { className, align = 'center', sideOffset = 8, children, ...props },
  ref,
) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-[100] w-60 rounded-[14px] border border-black/8 bg-popover p-3 text-popover-foreground shadow-[0_18px_50px_rgba(14,22,36,0.26),0_2px_10px_rgba(14,22,36,0.1)] backdrop-blur-xl outline-none animate-in fade-in-0 zoom-in-95',
          className,
        )}
        {...props}
      >
        {/* Portaled content overhangs the page rect; the overlay claims its
            input back from the tab below the shell. */}
        <ShellOverlay className="block w-full min-w-0 max-w-full">
          {children}
        </ShellOverlay>
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  );
});
