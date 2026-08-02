import { useRef } from 'react';
import type { Tab } from 'tbf/shell';

export function usePanes(
  active: Tab | undefined,
  partner: Tab | undefined,
): (string | undefined)[] {
  const held = useRef<(string | undefined)[]>([undefined, undefined]);
  const wanted = active
    ? (partner ? [active.id, partner.id] : [active.id])
    : [];
  const next = held.current.map(
    (id) => (id && wanted.includes(id) ? id : undefined),
  );
  for (const id of wanted) {
    if (!next.includes(id)) next[next.indexOf(undefined)] = id;
  }
  held.current = next;
  return next;
}
