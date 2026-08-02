#!/usr/bin/env node
// Fetches the pinned uBlock Origin release build and vendors it at
// extensions/ublock, where tbf.config.ts declares it as Scout's bundled
// content blocker. The 16MB upstream tree is deliberately not committed;
// this script runs on `npm install` (postinstall) and via `npm run
// fetch:ublock`, and is a no-op when the right version is already in place.

import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const VERSION = '1.72.2';
const ZIP_URL = `https://github.com/gorhill/uBlock/releases/download/${VERSION}/uBlock0_${VERSION}.chromium.zip`;
const ZIP_SHA256 =
  'd104cac4e1f48d76b1c3ff88aede2eaa8269814ae06cc9c850d27afb5274e533';

// The public key that fixes the bundled extension's id — the id Scout's
// shell hardcodes for the settings toggle. Ids derive from the public key
// alone; there is no private half to protect.
const COMPONENT_KEY =
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuHMcG4t+Btt2rbkeBdAAsb6w8qe0' +
  'mddQqEFVgN4IP8yUjLHpD2NdslfUHI3OcBncOj4ftxNRywn7fncJ6m6DtAD6Ag4jAKygtd+I' +
  'B7NzZMwyN4KR6wYcbDLwJ2+Q2wuqpQ9XateuIrSyG5xdDJ3ruiJKyR7XEyj2tiaf4fDHXctq' +
  'VYE05ZORP7LgNutRIs2WvxM92Ab/FtfG6FQhNWtHaebTp0XnTIp1WieyxtiLtH159ZO/KKjZ' +
  'ZcJEx0HdkXwcX0BJdEJdjaB4dFxBE0/4P2weXpvOnLtHUIGCrCN2iwcZB5JEerPwyzHFuXAV' +
  'EjH6mCLgPKJeTR7odokYPNsxQQIDAQAB';
const EXPECTED_ID = 'gjhofpnohmhinlhhhmdhfcdbajahcblk';
const MODIFICATIONS_FILE = 'SCOUT-MODIFICATIONS.txt';
const SCOUT_MODIFICATIONS = [
  `uBlock Origin ${VERSION} — Scout modification notice`,
  '',
  'Modification date: 2026-08-03',
  '',
  'Scout adds the public Chromium extension manifest "key" field so the',
  `bundled extension has the stable identifier ${EXPECTED_ID}.`,
  'The key is public identification material and has no private half.',
  '',
  `Upstream release: ${ZIP_URL}`,
  `Corresponding source: https://github.com/gorhill/uBlock/tree/${VERSION}`,
  'License: GNU General Public License, version 3 (see LICENSE.txt).',
  '',
].join('\n');

const projectRoot = path.dirname(
  path.dirname(fileURLToPath(import.meta.url)),
);
const target = path.join(projectRoot, 'extensions', 'ublock');

function deriveExtensionId(keyBase64) {
  const digest = createHash('sha256')
    .update(Buffer.from(keyBase64, 'base64'))
    .digest('hex');
  return [...digest.slice(0, 32)]
    .map((nibble) => String.fromCharCode(97 + parseInt(nibble, 16)))
    .join('');
}

async function alreadyInstalled() {
  try {
    const manifest = JSON.parse(
      await readFile(path.join(target, 'manifest.json'), 'utf8'),
    );
    const modifications = await readFile(
      path.join(target, MODIFICATIONS_FILE),
      'utf8',
    );
    return (
      manifest.version === VERSION &&
      manifest.key === COMPONENT_KEY &&
      modifications === SCOUT_MODIFICATIONS
    );
  } catch {
    return false;
  }
}

async function main() {
  if (deriveExtensionId(COMPONENT_KEY) !== EXPECTED_ID) {
    throw new Error(
      'COMPONENT_KEY no longer derives the extension id Scout expects',
    );
  }
  if (await alreadyInstalled()) {
    console.log(`uBlock Origin ${VERSION} already vendored; nothing to do.`);
    return;
  }

  console.log(`Fetching uBlock Origin ${VERSION}…`);
  const response = await fetch(ZIP_URL);
  if (!response.ok) {
    throw new Error(`download failed: ${response.status} ${ZIP_URL}`);
  }
  const zip = Buffer.from(await response.arrayBuffer());
  const digest = createHash('sha256').update(zip).digest('hex');
  if (digest !== ZIP_SHA256) {
    throw new Error(
      `release zip digest mismatch (got ${digest}); refusing to vendor it`,
    );
  }

  const scratch = await mkdtemp(path.join(tmpdir(), 'scout-ublock-'));
  try {
    const zipPath = path.join(scratch, 'ublock.zip');
    await writeFile(zipPath, zip);
    // The release zip unpacks to uBlock0.chromium/.
    await promisify(execFile)('unzip', ['-q', zipPath, '-d', scratch]);
    const unpacked = path.join(scratch, 'uBlock0.chromium');

    const manifestPath = path.join(unpacked, 'manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    manifest.key = COMPONENT_KEY;
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    await writeFile(
      path.join(unpacked, MODIFICATIONS_FILE),
      SCOUT_MODIFICATIONS,
    );

    await rm(target, { recursive: true, force: true });
    await cp(unpacked, target, { recursive: true });
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
  console.log(`Vendored uBlock Origin ${VERSION} at ${target}`);
}

main().catch((error) => {
  console.error(`fetch-ublock: ${error.message}`);
  console.error(
    'Scout bundles uBlock Origin as its content blocker; without it, ' +
      '`tbf dev` and `tbf build` fail at asset staging. Re-run with ' +
      '`npm run fetch:ublock`.',
  );
  process.exit(1);
});
