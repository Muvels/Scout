import {
  app,
  onShellIpcConnection,
  windows,
  type WindowHandle,
} from 'tbf/main';
import { ipc } from '../shared/ipc.js';
import { readShellState, writeShellState } from './store.js';
import { fetchSearchSuggestions } from './suggestions.js';

onShellIpcConnection(({ transport }) => {
  const bound = ipc.bind(transport);
  bound.handle('getProduct', () => ({
    name: 'Scout',
    home: 'https://example.com/',
  }));
  bound.handle('getShellState', () => readShellState());
  bound.handle('setShellState', async (state) => {
    await writeShellState(state);
    return undefined;
  });
  bound.handle('getSearchSuggestions', ({ query, engine }) =>
    fetchSearchSuggestions(engine, query),
  );
});

let windowCreatedByThisGeneration: WindowHandle | undefined;

// `tbf dev` deliberately keeps shell windows alive while it restarts the main
// runtime. The ready handler below consequently creates a short-lived second
// window in a restarted generation. Retire only that new window and return
// focus to the surviving workspace; otherwise transparent windows stack and
// the older window looks exactly like an opaque backdrop.
app.on('main-restarted', async () => {
  const replacement = windowCreatedByThisGeneration;
  if (!replacement) return;

  const survivor = (await windows.list()).find(
    (candidate) => candidate.id !== replacement.id,
  );
  if (!survivor) return;

  windowCreatedByThisGeneration = undefined;
  await replacement.close();
  await survivor.focus();
});

app.on('ready', async () => {
  windowCreatedByThisGeneration = await windows.create({
    shell: 'index.html',
    // Frameless: the shell owns the whole window surface, and the native
    // traffic lights sit wherever the shell's <TrafficLights/> is mounted.
    frame: 'hidden',
    width: 1600,
    height: 900,
    // The shell paints a full-bleed rounded rectangle; the window stays
    // transparent so the corners actually cut out, and macOS derives the
    // window shadow from the painted silhouette. True transparency, not
    // vibrancy: a material would paint a blurred backdrop under the corners.
    transparent: true,
  });
});
