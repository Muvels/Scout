import { useSyncExternalStore } from 'react';
import { contextMenus, type ShellMenuItem } from 'tbf/shell';

/**
 * Whether the running framework binary supports native shell menus
 * (contextMenus.show). Unknown until the first attempt; components keep the
 * web-rendered fallback mounted only once the native path has failed, so an
 * older binary degrades gracefully and a newer one feels OS-native.
 */
let supported: boolean | undefined;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of [...listeners]) listener();
}

export function useNativeMenuSupport(): boolean | undefined {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => supported,
  );
}

export async function showNativeMenu(
  x: number,
  y: number,
  items: readonly ShellMenuItem[],
): Promise<string | null> {
  try {
    const chosen = await contextMenus.show({ x, y, items });
    if (supported !== true) {
      supported = true;
      emit();
    }
    return chosen;
  } catch {
    if (supported !== false) {
      supported = false;
      emit();
    }
    return null;
  }
}
