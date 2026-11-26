# UI decision: egui, pure Rust

Status: decided, 2026-11-07. Phase 4 of [`RUST_MIGRATION.md`](../RUST_MIGRATION.md).

## Requirement

The rewrite must not keep a TypeScript or JavaScript UI. The desktop interface has to run as Rust,
start fast, stay small and stay testable without a display server. The legacy application in
`SOCDOF - TS` is reference only; it is never bundled, imported or executed by the Rust code.

## Options considered

| Option | UI language | Runtime | Startup / memory | Styling control | Headless tests | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| Leptos (CSR) | Rust → WASM | WebView (WebKitGTK/WebView2) | WebView dominates, ~60–100 MB | CSS, closest to the legacy look | DOM only through a browser | Rejected: keeps a browser engine and a WASM/JS toolchain in the UI path |
| Dioxus | Rust → WASM or native | WebView or desktop renderer | Two renderers, heavier | Good | Browser or native driver | Rejected: dual renderer, larger dependency and API churn |
| Slint | `.slint` markup + Rust | Native renderer | Good | Strong, but a second language | Limited without a window | Rejected: markup language and a smaller ecosystem for our table-heavy screens |
| **egui** | **Rust only** | **Native, immediate mode** | **Fastest start, lowest memory** | **Full control through the painter** | **Yes: `Context::run` without a window** | **Chosen** |

egui is the only option where every pixel is drawn by Rust code we compile ourselves. There is no
webview, no WASM bundle, no npm install and no browser engine on the UI path, which removes the
whole class of TypeScript/JavaScript dependencies the user wants gone.

## Consequences

- The UI crate is `crates/ui`; it uses egui 0.27, the newest release compatible with the workspace
  MSRV of 1.75. Raising the MSRV is a separate decision.
- Design tokens, the accent presets and the companion-color algorithm are ported from the legacy
  `src/index.css` and `src/lib/accent.ts`, so colors match the old screens.
- Components are drawn from the tokens instead of egui defaults; the kit is deliberately small and
  grows only when a module screen needs a control.
- The gallery in `gallery.rs` renders every control state in all four languages and both
  appearances, and is asserted headlessly in `cargo test`. The `socdof-ui-gallery` binary runs the
  same screen in an eframe window behind the `window` feature, so the default build and the tests
  stay free of desktop libraries.
- Keyboard support lives in `focus.rs` and is part of the kit, not of the screens: Tab/Shift+Tab
  move in reading order, Enter/Space activate, arrows and Home/End navigate dropdowns, menus and the
  calendar, and Escape closes overlays and returns the focus to the trigger. The focus ring is drawn
  from the accent tokens.
- The primitives are pinned by deterministic golden snapshots of their paint commands, so a visual
  change fails a test even without a display. The Phase 5 desktop shell and its overlays are pinned
  the same way, 144 goldens in total, including the eight-tab settings screen.
- The desktop shell is drawn the same way: windows are egui areas painted from the tokens instead
  of egui's own window widget, so chrome, taskbar, icon grid and the shell overlays keep one visual
  language and stay keyboard reachable. The start menu, command palette, tray flyout and onboarding
  are focus-trapping overlays; the wallpaper is a decoded PNG texture, not a tint.
- Tables with thousands of rows are virtualized by the screen that owns the data (egui paints what
  is visible); the kit provides the header, sorting state and row primitives.
- Text rendering uses the bundled egui fonts for now. A later step bundles the same UI font the
  legacy app used, so printed previews and screen typography stay consistent.

## Removing the TypeScript frontend

`crates/app/ui` is the Vite/TypeScript frontend of the Tauri shell. It exists only because the
Rust UI is not finished yet. The removal order is fixed:

1. The Rust UI reaches screen parity for the shell (navigation, status, contacts, products).
2. `crates/app/src-tauri` switches its window to the Rust UI and `frontendDist` stops pointing at
   the Vite build.
3. `crates/app/ui`, `package.json`, `package-lock.json` and the npm steps of the desktop CI job are
   deleted in one change; the desktop job then only runs `cargo`.
4. `SOCDOF - TS` stays untouched as the historical reference and is only removed when the migration
   is closed.

Until step 3 the npm steps stay green; removing the frontend earlier would break the working
installer for no gain.
