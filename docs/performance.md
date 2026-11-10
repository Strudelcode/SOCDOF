# Performance and size budgets (Phase 9)

Budgets: `scripts/budgets.json`. Check: `node scripts/check-budgets.mjs` (exit 1 on a violation;
`--scope=bundles|cold_start|artifacts|runtime`, `--limit=<key>=<value>` to prove a check fails).
The frame budget is a test of its own: `cargo test --release -p socdof-ui --test performance --
--ignored --nocapture`, limit overridable with `SOCDOF_FRAME_BUDGET_MS`. Every number below was
measured on an artifact this checkout built.

## Method

| Budget | Measurement |
|---|---|
| UI bundle | sum of the files in `crates/app/dist` after `npm run build`, raw and `gzip -9` |
| Web bundle | sum of `crates/web/dist` after `trunk build --release` (separate target, see §14) |
| Cold start | `target/release/socdof-app --database <fresh file>`, spawn to exit with `SOCDOF shell ready`, median of five runs |
| Frame budget | `crates/ui/tests/performance.rs`: in-memory `Store` with 50k contacts and 100k invoices, `egui::Context::run` on the real `contacts()` / `invoices()` screens at 1280×900, 3 warm-up frames then 20 measured frames, median and P95 per screen |
| Memory report | `VmRSS`/`VmHWM` of that same benchmark process after both screens rendered, plus the app RSS sampled in CI |
| Installer / installed | largest Tauri bundle artifact, and its unpacked tree (`dpkg-deb -x` or `--appimage-extract`), in the CI `desktop` job |
| Idle RAM / CPU | `VmRSS` and `utime+stime` of the running desktop process from `/proc/<pid>` over five quiet seconds, in the CI `gui-smoke` job under Xvfb |

## Measured 2026-11-10 (commit `da602f1`)

Environment: Linux 6.1.102 x86_64 container, 8 vCPU, `rustc 1.99.1 (58cf8f9c3 2026-10-13)`,
Node v26.13.0; release profile; dates in UTC.

| Metric | Measured | Budget |
|---|---|---|
| Contacts screen, 50k rows | median 0.10 ms, P95 0.15 ms | ≤ 16.6 ms/frame |
| Invoices screen, 100k rows | median 0.20 ms, P95 0.21 ms | ≤ 16.6 ms/frame |
| Seeding the benchmark dataset | 18.5 s (50k contacts, 100k invoices, one transaction each) | — |
| Loading both lists from SQLite | 0.3 s / 1.6 s | — |
| UI bundle raw | 52,305 B | ≤ 1,572,864 B |
| UI bundle gzip | 15,535 B | ≤ 409,600 B |
| Web bundle raw | 6,415,465 B | ≤ 7,340,032 B (regression guard) |
| Web bundle gzip | 2,991,359 B | ≤ 3,670,016 B (regression guard) |
| Cold start median (5 runs) | 248 ms | < 800 ms |
| Installer / installed / idle RAM / idle CPU | not built here | measured by CI, see below |

The browser bundle is the egui UI plus SQLite as WebAssembly, not the desktop UI bundle the Phase 9
table names; §14 already records its size. Its limits are regression guards, not the 1.5 MB target.

Cold start rose from 144 ms to 248 ms with this pass: schema v9 adds one FTS index rebuild when a
database is opened for the first time (see below). The budget has room for it.

## Memory report (measured)

The benchmark process reports its own resident size after both screens rendered at least once:

```text
ui dataset memory: rss 196.9 MiB, peak 196.9 MiB
```

That number covers the 50k contacts, the 100k invoices with one position each, the seeded in-memory
SQLite database, the loaded `Vec<Contact>`/`Vec<Invoice>` and the egui frame. It is the upper bound
of what the list screens hold for the budgeted dataset, not the footprint of an idle window — the
idle figure depends on WebKitGTK and is therefore sampled from the real app in `gui-smoke`
(`VmRSS` against the 120 MB limit, five-second quiet window, exit 1 on a violation).

## What made the frame budget pass

- Both lists draw through `egui::ScrollArea::show_rows` with a fixed `TABLE_ROW_HEIGHT`, so only the
  visible rows are laid out (`crates/ui/src/contacts.rs`, `crates/ui/src/invoices.rs`,
  `table_columns`/`table_cell` in `crates/ui/src/components.rs`). `table_cell` allocates an explicit
  rect; with a content-sized cell every row would find its own column positions.
- The invoice list resolves customer names through `InvoicesState::contact_labels`, filled once in
  `refresh`, instead of a store lookup per row and frame.
- Seeding exposed a quadratic write path: the invoice FTS triggers deleted their row with
  `WHERE invoice_id = …` on an `UNINDEXED` column, i.e. a full index scan per position. Measured in
  10k batches: 11.4 s, 33.7 s, 54.2 s, 75.3 s (release). Schema v9 (`SCHEMA_V9` in
  `crates/core/src/store/mod.rs`) adds `invoices_fts_rows(invoice_id, fts_rowid)` and rewrites the six
  invoice triggers to delete by rowid; the same batches now take 1.4–1.7 s each and 100k invoices
  seed in 18.5 s. Search behaviour is unchanged, the migration rebuilds the index and the map once.

## Verification of the checks themselves

- Frame budget, default limit: `test result: ok`, both screens reported with median and P95.
- Frame budget, lowered limit `SOCDOF_FRAME_BUDGET_MS=0.01`: exit 101 with `contacts 50k median
  0.10 ms exceeds 0.01 ms`, then reset to the default 16.6 ms.
- Bundle budget, `--limit=raw_bytes=1000`: exit 1, unchanged default run exits 0.
- Installer budget: `--scope=artifacts` reports `not built here` locally and measures the bundle in
  CI; `--scope=runtime --pid <pid>` samples a real process (used in `gui-smoke`).

## Not buildable in this container — wired into CI instead

The Tauri desktop cannot be built here: there is no GTK/WebKit development stack, no `sudo` to
install it, and no `Xvfb`/display (`crates/app/src-tauri/target` does not exist, `sudo -n true`
fails). So the four artifact budgets are measured where those exist, and both places fail the job:

- `.github/workflows/rust.yml`, job `desktop`, step **Check installer size budgets** →
  `node scripts/check-budgets.mjs --scope=artifacts` on the built `.deb`/`.AppImage` (bundle size) and
  its extracted tree (installed size); limits 15,728,640 B and 41,943,040 B.
- `.github/workflows/rust.yml`, job `desktop`, step **Frame budget (50k contacts, 100k invoices)** →
  the benchmark above in release mode.
- `.github/workflows/rust.yml`, job `gui-smoke`, step **Idle RAM/CPU budget** → starts the built app
  under `Xvfb :99`, finds the real `socdof-desktop` pid with `scripts/idle-app-pid.py`, waits 15 s and
  runs `node scripts/check-budgets.mjs --scope=runtime --pid <pid>`; limits 122,880 KiB and 0.5 %.

## History

- 2026-11-09 (`ebe231b`) — harness and limits, UI/Web bundle and cold start measured; installer,
  idle RAM/CPU and the 50k/100k frame budget named as open.
- 2026-11-10 (`da602f1`) — virtualised lists, contact-label index, FTS rowid map (schema v9), frame
  benchmark with real median/P95, memory report, installer and runtime budgets wired into CI.
