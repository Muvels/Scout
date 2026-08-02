import {
  forwardRef,
  type HTMLAttributes,
} from 'react';
import { cn } from '../../lib/utils.js';

/*
 * Scout's shell enforces Trusted Types. Radix ScrollArea injects a runtime
 * <style> tag through dangerouslySetInnerHTML, so this shadcn primitive is
 * adapted to use the native scroller and the shell's static stylesheet.
 */
export const ScrollArea = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function ScrollArea({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          'scout-scroll-area overflow-x-hidden overflow-y-auto',
          className,
        )}
        {...props}
      />
    );
  },
);
