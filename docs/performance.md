# Performance and size budgets (Phase 9)

Budgets: `scripts/budgets.json`. Check: `node scripts/check-budgets.mjs` (exit 1 on a violation;
`--scope=bundles|cold_start`, `--limit=<key>=<value>` to prove the check fails). Method and measured
values below; every number comes from an artifact this checkout built.

## Method

| Budget | Measurement |
|---|---|
| UI bundle | sum of the files in `crates/app/dist` after `npm run build`, raw and `gzip -9` |
| Web bundle | sum of `crates/web/dist` after `trunk build --release` (separate target, see §14) |
| Cold start | `target/release/socdof-app --database <fresh file>`, spawn to exit with `SOCDOF shell ready`, median of five runs |
| Installer / installed | Tauri bundle and its unpacked tree (CI `desktop` job; not buildable without GTK/WebKit) |
| Idle RAM / CPU | `VmRSS` and `utime+stime` of the running app from `/proc/<pid>` over five quiet seconds (CI `gui-smoke` job under Xvfb) |
| Large dataset | contacts and invoices screens with 50k/100k rows, frame time of the real egui layout (open) |

## Measured 2026-11-09 (commit `b0976fe` + this pass, Linux x86_64 container, Rust 1.99.1)

| Metric | Measured | Budget |
|---|---|---|
| UI bundle raw | 52,305 B | ≤ 1,572,864 B |
| UI bundle gzip | 15,535 B | ≤ 409,600 B |
| Web bundle raw | 6,415,465 B | ≤ 7,340,032 B (regression guard) |
| Web bundle gzip | 2,991,359 B | ≤ 3,670,016 B (regression guard) |
| Cold start median (5 runs) | 144 ms | < 800 ms |
| Installer / installed / idle RAM / idle CPU | not built here | CI desktop + gui-smoke |
| Large dataset (50k contacts, 100k invoices) | open | ≤ 16.6 ms/frame |

The browser bundle is the egui UI plus SQLite as WebAssembly, not the desktop UI bundle the Phase 9
table names; §14 already records its size. Its limits are regression guards, not the 1.5 MB target.

## Open

- Contacts and invoices lists still lay out every row (`egui::Grid` inside a `ScrollArea`), so the
  50k/100k frame budget is not met. The fix is viewport virtualisation (`ScrollArea::show_rows` plus
  a contact-label index for the invoice list) with a benchmark in `crates/ui/tests/performance.rs`.
- Installer, installed size and idle RAM/CPU need the Tauri build; the check script reports them as
  not measured here and CI runs them where GTK, WebKit and Xvfb exist.
