import { readFile, writeFile } from 'node:fs/promises';

const packageJsonUrl = new URL('../package.json', import.meta.url);
const outputUrl = new URL('../pages/settings/version.js', import.meta.url);
const packageJson = JSON.parse(await readFile(packageJsonUrl, 'utf8'));
const version = packageJson.version;

if (
  typeof version !== 'string' ||
  !/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-[0-9A-Za-z.-]+)?$/.test(
    version,
  )
) {
  throw new Error('package.json must contain a valid Scout release version.');
}

const contents =
  '// Generated from package.json by scripts/generate-version.mjs.\n' +
  `globalThis.SCOUT_VERSION = ${JSON.stringify(version)};\n`;

let existing = '';
try {
  existing = await readFile(outputUrl, 'utf8');
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

if (existing !== contents) {
  await writeFile(outputUrl, contents);
}
