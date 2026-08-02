# Scout

Scout is intended as a maintained replacement for Arc. A way of browsing that
people rely on should not disappear when a company changes direction. Scout is
building an independent, source-available alternative—one that people can
inspect, adapt, share noncommercially, and keep alive.

Scout is a browser with a vertical sidebar. Tabs, the address field, pinned
sites, and Spaces sit beside the page instead of in bars above it. This gives
websites back the vertical space that conventional browser tab strips and
toolbars claimed in the first place.

https://github.com/user-attachments/assets/82559526-1cc4-494d-90c0-22a0016c032b

## How Scout was created

Scout is the successor to
[Meridian](https://github.com/Muvels/Meridian), an Arc-like browser we built
with Electron and React. Meridian started as an experiment to find out how far
Electron could be taken as the foundation for a full browser. It also exposed
the limitation of that approach: Electron includes Chromium, but it gives
applications Chromium's lower-level content layer rather than the complete
browser layer used by Chrome. Continuing with Electron would have meant
rebuilding much of the machinery around the web page, including coherent tab,
profile, session, download, history, bookmark, extension, permission, and
settings systems.

That is why we started The Browser Framework (TBF). TBF combines a fork of
ungoogled-chromium with a separate stock Node.js runtime. It keeps Chromium's
browser layer and replaces its native interface, allowing an application to
provide the entire browser shell with HTML, CSS, and JavaScript or TypeScript.
Its project structure deliberately resembles Electron: application logic
lives in `main/`, the browser interface lives in `shell/`, shared IPC contracts
live in `shared/`, and `tbf.config.ts` defines the application.

The shell communicates directly with Chromium through typed browser APIs and
TBF's native bridges. The Node.js main process communicates with Chromium over
a separate supervised bridge, while application-specific messages between
`main/` and `shell/` use declared, typed IPC channels. This separation keeps
ordinary websites sandboxed and prevents them from receiving shell or Node.js
privileges.

TBF exposes Chromium's existing browser capabilities to TypeScript instead of
asking each application developer to rebuild them. Its current surface
includes tabs, windows, bookmarks, downloads, profiles, sessions, preferences,
themes, the omnibox, extensions, and related browser services. The longer-term
goal is to make the browser capabilities behind Chromium's `chrome/` layer
available through stable APIs, so developers can concentrate on their shell
instead of maintaining a Chromium fork, writing browser UI in C++, and carrying
their own patch set.

Scout is the official browser built on TBF. It is both the application we want
to use and the project that proves the framework against a real browser rather
than a demo. We maintain both projects because we want control over the source
of our own browser and because Arc's browsing model should be able to keep
evolving after Arc entered maintenance mode. Scout is our Chromium-based
continuation of that idea; it is not affiliated with The Browser Company.

Scout and TBF are under active development. TBF will be published as
open-source software alongside Scout's first official release. Scout is not
yet ready for a public binary release.

## Repository boundary

Scout is maintained separately, but TBF is not published yet. The dependency
entries in `package.json` intentionally point to a private sibling checkout at
`../the-browser-framework`. This lets Scout be versioned and inspected
independently, while only the owner with the framework source and binary can
genuinely build or run it for now.
`TBF_REVISION` records the known-good framework revision.

## Bundled content blocker

Scout ships uBlock Origin as its ad & tracker blocker; the on/off switch
lives in `scout://settings` under Privacy. The upstream extension tree is
not committed: `npm install` fetches the pinned release into
`extensions/ublock/` via `scripts/fetch-ublock.mjs` (re-run manually with
`npm run fetch:ublock`).

Scout deliberately bundles the Manifest V2 build of uBlock Origin. We want to
keep using the full blocker even though
[Chrome ended support for Manifest V2 extensions](https://developer.chrome.com/docs/extensions/develop/migrate/mv2-deprecation-timeline).
TBF preserves the Chromium support needed to install and run it as an
app-owned bundled extension.

## Running it (Not possible until offical release)

Scout needs this local layout, a built framework binary, and the staged Node
runtime pair:

```text
Developer/
├── scout/
└── the-browser-framework/
```

From the TBF repository root:

```sh
scripts/stage-node-runtime --platform macos-arm64 --framework-root build/src/out/dev
export TBF_BINARY_PATH="$PWD/build/src/out/dev/Chromium.app/Contents/MacOS/Chromium"
cd ../scout
npm install
npm run dev
```

`npm run dev` starts Vite, bundles `main/` with esbuild, writes the staged
config, and launches the framework. Editing anything under `shell/` hot-reloads;
editing `main/` restarts the runtime process while the window stays open.

To check it end to end without watching it yourself, from the TBF repository
root:

```sh
scripts/dogfood-probe --project ../scout --output /tmp/scout-evidence \
  --command "node $PWD/cli/dist/index.js dev"
```

That drives Scout's own UI over CDP — it asserts the shell rendered, clicks
Scout's "create tab" button, and requires `<tbf-tab-view>` to report an attached
tab before writing screenshots.

## Layout

| Path | Role |
|---|---|
| `main/index.ts` | Node main process: creates the window, answers `getProduct` |
| `main/store.ts` | Atomic `shell-state.json` persistence (spaces, tabs, pins) |
| `main/suggestions.ts` | Search-suggestion proxy for the command box |
| `shared/ipc.ts` | The typed contract both sides import |
| `shell/index.tsx` | Minimal React bootstrap; loads the shell store before mount |
| `shell/components/Browser.tsx` | Browser workspace orchestration, tab actions, settings-beacon handling |
| `shell/components/BrowserViewport.tsx` | Native `<TabView composite="below-shell">` content area |
| `shell/components/Sidebar.tsx` | Resizable browser chrome, pinned sites, spaces and native traffic lights |
| `shell/components/SidebarTab.tsx` | Open-tab row, tooltip and context actions |
| `shell/components/SpacesBar.tsx` · `SpaceSlide.tsx` | Space switcher and the slide transition |
| `shell/components/Omnibox.tsx` | Sidebar-anchored omnibox and centered command box |
| `shell/components/SiteInfoPopover.tsx` | The (i) popover: security chip, per-site actions |
| `shell/components/ui/` | CSP-safe shadcn UI primitives |
| `shell/hooks/` | Spaces, per-space tabs, tab order, panes, suggestions, product transport |
| `shell/lib/` | Shell store, spaces model, native hover card/menu wrappers, navigation helpers |
| `pages/settings/` | `scout://settings` — app-internal page; talks to the shell via the URL-fragment beacon |
| `scripts/fetch-ublock.mjs` | Vendors the pinned uBlock Origin release (postinstall) |
| `shell/styles.css` | Tailwind CSS v4 theme tokens, transparent reset and static scrollbar CSS |
| `shell/vite.config.ts` | Enables Tailwind's Vite plugin and the shell-safe HMR host |
| `tbf.config.ts` | App identity, permissions, shell CSP, bundled extensions, packaging targets |

`main/`, `shell/` and `shared/` are deliberately independent; only
`shared/ipc.ts` crosses the boundary, and it crosses it as a schema.

## Licensing

Scout-authored source is source-available under the recipient's choice of the
[PolyForm Noncommercial License 1.0.0](LICENSES/PolyForm-Noncommercial-1.0.0.md)
or the
[PolyForm Internal Use License 1.0.0](LICENSES/PolyForm-Internal-Use-1.0.0.md).
It is not open-source software under the OSI definition.

- Noncommercial users may inspect, modify, and redistribute Scout under the
  Noncommercial license.
- Companies may use and privately modify Scout for internal business operations
  under the Internal Use license, but may not distribute it under that license.
- Commercial redistribution is not licensed. Commercial licenses are not
  offered until a future legal entity is established.
- Cost-recovery donations or sponsorship are intended to remain noncommercial
  only when they reimburse direct project expenses and provide no salary,
  profit, paid access, advertising revenue, or business benefit to a sponsor.

Official signed builds and project branding are handled separately in
[`OFFICIAL_BUILDS.md`](OFFICIAL_BUILDS.md) and
[`TRADEMARKS.md`](TRADEMARKS.md). Scout's license never applies to TBF,
Chromium, ungoogled-chromium, uBlock Origin, or npm dependencies; their terms
and the binary-release compliance gate are documented in
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

Outside code contributions are not currently accepted. See
[`CONTRIBUTING.md`](CONTRIBUTING.md). Source-repository publication was approved
on 2026-08-03; official binaries remain subject to the checks in
[`PUBLICATION.md`](PUBLICATION.md).

## Notes for whoever changes this

- **TBF dependencies are private sibling `file:` specifiers**
  (`file:../the-browser-framework/cli` and
  `file:../the-browser-framework/sdk/packages/*`). They intentionally keep
  public installs from pretending the unpublished framework is available.
  Update `TBF_REVISION` whenever Scout adopts a new known-good framework
  revision.
- **Keep Scout's former history private.** Public `main` begins with the
  intended Scout license. TBF's preserved history still contains the former
  Scout subtree and must be handled separately before TBF is published.
- **`appId` is `framework.thebrowser.scout`**, chosen to match the
  `thebrowser.framework` domain the repository already assumes. It is a
  placeholder until the owner confirms the real identity — it feeds crash-report
  identity and packaging, so settle it before signing anything.
- **Do not commit `.tbf-dev/`.** It holds a full browser profile — history,
  cookies, local storage. `.gitignore` covers it.
- **Keep runtime CSS Trusted-Types safe.** The shadcn `ScrollArea` wrapper uses
  a native scroller because Radix ScrollArea injects a `<style>` element with
  `dangerouslySetInnerHTML`, which the shell CSP correctly blocks.
