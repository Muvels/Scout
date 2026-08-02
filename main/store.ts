import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { shellStateSchema, type ShellState } from '../shared/ipc.js';

// TBF_APP_DATA is the app-scoped data root the framework hands the main
// runtime at spawn — the directory the `fs: ['appData']` permission in
// tbf.config.ts grants access to. The cwd fallback only serves harnesses
// that run main outside the framework; writes there may simply fail and
// are swallowed like any other persistence error.
const root = process.env.TBF_APP_DATA ?? process.cwd();
const file = path.join(root, 'shell-state.json');

let queue: Promise<void> = Promise.resolve();

export async function readShellState(): Promise<ShellState | null> {
  try {
    const raw = await readFile(file, 'utf8');
    const parsed = shellStateSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null; // absent or unreadable — the shell seeds or migrates
  }
}

export function writeShellState(state: ShellState): Promise<void> {
  // Writes are serialized, and each lands via temp file + rename so a
  // crash mid-write can never leave a truncated store behind.
  queue = queue
    .then(async () => {
      await mkdir(root, { recursive: true });
      const temp = `${file}.tmp`;
      await writeFile(temp, JSON.stringify(state), 'utf8');
      await rename(temp, file);
    })
    .catch(() => {
      // A failed write keeps the previous file; the next save retries.
    });
  return queue;
}
