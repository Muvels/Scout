import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
} from 'react';
import type { StoredSpaces } from '../../shared/ipc.js';
import { initialSpaces, patchShellState } from '../lib/shellStore.js';
import {
  DEFAULT_SPACE,
  themeVariables,
  type Space,
} from '../lib/spaces.js';

export type SpacesApi = {
  spaces: Space[];
  active: Space;
  setActive: (id: string) => void;
  create: (name: string, color: string, gradientTo?: string) => void;
  update: (space: Space) => void;
  remove: (id: string) => void;
};

export function useSpaces(): SpacesApi {
  // The shell store has finished loading before this hook can mount (the
  // entry gates on it), so the initial snapshot is the persisted state.
  const [state, setState] = useState<StoredSpaces>(
    () =>
      initialSpaces() ?? { spaces: [DEFAULT_SPACE], activeId: DEFAULT_SPACE.id },
  );
  const active = state.spaces.find((space) => space.id === state.activeId)
    ?? state.spaces[0];

  useEffect(() => {
    patchShellState({ spaces: state });
  }, [state]);

  // The variables live on the document root so portaled UI (menus,
  // tooltips) inherits the space palette too, not just the shell tree.
  useLayoutEffect(() => {
    const root = document.documentElement;
    const variables = themeVariables(active.color, active.gradientTo);
    for (const [name, value] of Object.entries(variables)) {
      root.style.setProperty(name, value);
    }
  }, [active.color, active.gradientTo]);

  const setActive = useCallback((id: string) => {
    setState((current) => (
      current.spaces.some((space) => space.id === id)
        ? { ...current, activeId: id }
        : current
    ));
  }, []);

  const create = useCallback((
    name: string,
    color: string,
    gradientTo?: string,
  ) => {
    const space: Space = {
      id: crypto.randomUUID(),
      name: name.trim() || 'Space',
      color,
      ...(gradientTo === undefined ? {} : { gradientTo }),
    };
    setState((current) => ({
      spaces: [...current.spaces, space],
      activeId: space.id,
    }));
  }, []);

  const update = useCallback((space: Space) => {
    setState((current) => ({
      ...current,
      spaces: current.spaces.map((candidate) =>
        candidate.id === space.id
          ? { ...space, name: space.name.trim() || 'Space' }
          : candidate,
      ),
    }));
  }, []);

  const remove = useCallback((id: string) => {
    setState((current) => {
      if (current.spaces.length <= 1) return current;
      const spaces = current.spaces.filter((space) => space.id !== id);
      return {
        spaces,
        activeId: current.activeId === id ? spaces[0].id : current.activeId,
      };
    });
  }, []);

  return { spaces: state.spaces, active, setActive, create, update, remove };
}
