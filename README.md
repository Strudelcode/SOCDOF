# SOCDOF — Rust Rewrite

Native Rust rebuild of SOCDOF. The shipped TypeScript/React/Electron application lives unchanged in
[`SOCDOF - TS`](SOCDOF%20-%20TS) and keeps its own build and release tooling there.

The full migration plan, budgets and the parity checklist are in
[`RUST_MIGRATION.md`](RUST_MIGRATION.md). Tick items off there as work lands.

## Layout

```
.
├── Cargo.toml            # workspace
├── RUST_MIGRATION.md     # plan + checklist + progress log
├── crates
│   ├── core              # domain model, money, SQLite persistence
│   ├── app               # desktop application (Tauri shell, Phase 3)
│   ├── ui                # UI components (framework decision in Phase 4)
│   └── cli               # headless access to the core, used for tests and tooling
└── SOCDOF - TS           # legacy TypeScript application (untouched)
```

## Build

```bash
cargo fmt --all
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
cargo run -p socdof-cli -- ./socdof.db
```

Requirements: stable Rust (pinned in `rust-toolchain.toml`) and a C toolchain for the bundled SQLite.
