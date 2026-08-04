// Preferences persist in this page's own origin storage (scout://settings).
// The shell runs on a different origin and cannot read it; settings the
// shell must act on are announced through the URL-fragment beacon below.
const searchEngine = document.getElementById('search-engine');
const confirmClosePinned = document.getElementById('confirm-close-pinned');
const sidebarPosition = document.getElementById('sidebar-position');
const paletteScope = document.getElementById('palette-scope');
const noiseBackground = document.getElementById('noise-background');
const contentBlocker = document.getElementById('content-blocker');
const appVersion = document.getElementById('app-version');
const status = document.getElementById('status');

const stored = (key, fallback) => localStorage.getItem(key) ?? fallback;

if (typeof globalThis.SCOUT_VERSION === 'string') {
  appVersion.textContent = `Version ${globalThis.SCOUT_VERSION}`;
}

searchEngine.value = stored('scout.search-engine', 'google');
confirmClosePinned.checked =
  stored('scout.confirm-close-pinned', 'true') === 'true';
sidebarPosition.value = stored('scout.sidebar-side', 'left');
paletteScope.checked = stored('scout.palette-scope', 'false') === 'true';
noiseBackground.checked = stored('scout.noise-bg', 'false') === 'true';
contentBlocker.checked = stored('scout.content-blocker', 'on') === 'on';

// The one channel this page shares with the shell is its own URL: the
// shell watches tab urls (chrome.tabs.onUpdated), so a value flashed
// through the fragment reaches it. Both hops use replaceState — assigning
// location.hash would stack a same-document history entry per save and
// make Back appear dead — and the hash is cleared right after: long
// enough for the url update to fire, short enough that the address never
// lingers dirty.
let beaconCount = 0;
const beacon = (key, value) => {
  beaconCount += 1;
  const clean = location.href.split('#')[0];
  history.replaceState(null, '', `${clean}#${key}=${value}&beacon=${beaconCount}`);
  window.setTimeout(() => {
    history.replaceState(null, '', clean);
  }, 250);
};

const note = () => {
  status.textContent = 'Saved.';
  window.setTimeout(() => {
    status.textContent = '';
  }, 1200);
};

searchEngine.addEventListener('change', () => {
  localStorage.setItem('scout.search-engine', searchEngine.value);
  beacon('search-engine', searchEngine.value);
  note();
});

confirmClosePinned.addEventListener('change', () => {
  localStorage.setItem(
    'scout.confirm-close-pinned',
    String(confirmClosePinned.checked),
  );
  note();
});

sidebarPosition.addEventListener('change', () => {
  localStorage.setItem('scout.sidebar-side', sidebarPosition.value);
  beacon('sidebar-side', sidebarPosition.value);
  note();
});

paletteScope.addEventListener('change', () => {
  localStorage.setItem('scout.palette-scope', String(paletteScope.checked));
  beacon('palette-scope', paletteScope.checked ? 'on' : 'off');
  note();
});

noiseBackground.addEventListener('change', () => {
  localStorage.setItem('scout.noise-bg', String(noiseBackground.checked));
  beacon('noise-bg', noiseBackground.checked ? 'on' : 'off');
  note();
});

contentBlocker.addEventListener('change', () => {
  localStorage.setItem(
    'scout.content-blocker',
    contentBlocker.checked ? 'on' : 'off',
  );
  beacon('content-blocker', contentBlocker.checked ? 'on' : 'off');
  note();
});

// Re-announce stored choices on load so a shell whose own storage was
// reset falls back in line with what this page displays. Only explicit
// choices are announced — a fresh page must not stomp the shell's state
// with defaults — and the announcements are staggered past each other's
// 250ms clear so the later beacon never erases the earlier one mid-flash.
const announcements = [];
if (localStorage.getItem('scout.search-engine') !== null) {
  announcements.push(['search-engine', searchEngine.value]);
}
if (localStorage.getItem('scout.sidebar-side') !== null) {
  announcements.push(['sidebar-side', sidebarPosition.value]);
}
if (localStorage.getItem('scout.palette-scope') !== null) {
  announcements.push(['palette-scope', paletteScope.checked ? 'on' : 'off']);
}
if (localStorage.getItem('scout.noise-bg') !== null) {
  announcements.push(['noise-bg', noiseBackground.checked ? 'on' : 'off']);
}
if (localStorage.getItem('scout.content-blocker') !== null) {
  announcements.push([
    'content-blocker',
    contentBlocker.checked ? 'on' : 'off',
  ]);
}
announcements.forEach(([key, value], index) => {
  window.setTimeout(() => beacon(key, value), index * 300);
});
