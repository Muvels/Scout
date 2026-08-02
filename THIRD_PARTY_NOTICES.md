# Third-Party Notices

This document identifies the principal third-party components used by Scout and
records the release obligations that must remain separate from Scout's own
license. It is not a substitute for the complete license and attribution files
shipped by those components.

Scout's PolyForm licenses apply only to Scout-authored material. Nothing in
`LICENSE`, `OFFICIAL_BUILDS.md`, or `TRADEMARKS.md` relicenses or restricts the
rights granted by a third-party license.

## The Browser Framework

Scout uses The Browser Framework (TBF) through private sibling `file:`
dependencies and a TBF-built browser runtime. TBF-authored code at Scout's
currently pinned framework revision is licensed under the Apache License 2.0.
TBF also incorporates upstream and third-party material under other licenses.

A Scout release that bundles TBF must retain TBF's `LICENSE` and `NOTICE` and
all notices TBF carries for the precise runtime revision. `TBF_REVISION` records
Scout's known-good revision; it is not itself a substitute for those notices.

## Chromium

Chromium source is primarily licensed under the BSD 3-Clause License and
contains many third-party components under their own terms. Binary
redistributions must reproduce Chromium's copyright notice, license conditions,
and disclaimer in accompanying documentation or other provided material.

- License: <https://chromium.googlesource.com/chromium/src/+/main/LICENSE>
- Bundled component credits remain available from the runtime at
  `chrome://credits`.

Do not remove the runtime's license files or generated credits when packaging
Scout.

## ungoogled-chromium

ungoogled-chromium is licensed under the BSD 3-Clause License. Its copyright
notice, conditions, and disclaimer must be retained with source and binary
redistributions.

- Project: <https://github.com/ungoogled-software/ungoogled-chromium>
- License: <https://github.com/ungoogled-software/ungoogled-chromium/blob/master/LICENSE>

## uBlock Origin

Scout fetches and bundles uBlock Origin 1.72.2 as an independent Chromium
extension. uBlock Origin is licensed under the GNU General Public License,
version 3. Scout's install script adds a public `key` field to the extension
manifest so the extension has Scout's expected stable identifier.

- Project: <https://github.com/gorhill/uBlock>
- Pinned release: <https://github.com/gorhill/uBlock/releases/tag/1.72.2>
- Corresponding source: <https://github.com/gorhill/uBlock/tree/1.72.2>
- License: <https://github.com/gorhill/uBlock/blob/1.72.2/LICENSE.txt>

Every Scout release that conveys the extension must:

1. retain uBlock Origin's `LICENSE.txt` and copyright notices;
2. retain the generated `SCOUT-MODIFICATIONS.txt` notice;
3. provide the complete corresponding source for the exact bundled version,
   together with Scout's manifest modification, by a GPLv3-compliant method;
4. make that source available for as long as the release is distributed; and
5. impose no Scout-specific restriction on recipients' GPL rights in uBlock
   Origin itself.

Restrictions for Scout-authored code, official Scout signatures, and Scout
project marks do not apply to uBlock Origin. Its inclusion as a separate
extension does not change the license stated for Scout-authored source.

## JavaScript and UI dependencies

Scout's current direct runtime dependencies include:

| Components | License |
|---|---|
| `@dnd-kit/*`, `@radix-ui/*`, `clsx`, `cmdk`, `react`, `react-dom`, `tailwind-merge`, `tw-animate-css`, `zod` | MIT |
| `class-variance-authority` | Apache-2.0 |
| `lucide-react` | ISC |
| shadcn/ui-derived component source in `shell/components/ui/` | MIT; see `LICENSES/shadcn-ui-MIT.md` |

Those packages have transitive dependencies under their own terms. Before any
binary release, generate a complete production-dependency inventory from the
locked dependency graph and ship the applicable license texts, copyright
notices, and attributions with the application. Development-only tools do not
need to be included unless their code or assets are copied into a release.

## Release compliance gate

Before publishing a Scout binary, verify all of the following against the exact
staged artifact rather than this source tree alone:

- TBF, Chromium, ungoogled-chromium, and all Chromium third-party notices are
  present and accessible;
- `chrome://credits` works in the packaged runtime;
- uBlock Origin's license, modification notice, and corresponding source are
  available as described above;
- production JavaScript dependency notices are included; and
- no Scout EULA, installer term, or distribution policy overrides a
  third-party component's rights.
