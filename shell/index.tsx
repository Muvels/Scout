import React, { useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Browser } from './components/Browser.js';
import { loadShellStore } from './lib/shellStore.js';
import './styles.css';

// The persisted shell state must be in memory before Browser mounts: its
// hooks snapshot their initial state exactly once, and mounting ahead of
// the load would run the tab reconciler against empty spaces — claiming,
// or even closing, tabs that belong elsewhere.
function Shell() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void loadShellStore().then(() => setReady(true));
  }, []);
  return ready ? <Browser /> : null;
}

const container = document.getElementById('root')!;
const roots = globalThis as typeof globalThis & { __tbfShellRoot?: Root };
roots.__tbfShellRoot ??= createRoot(container);
roots.__tbfShellRoot.render(
  <React.StrictMode><Shell /></React.StrictMode>,
);
