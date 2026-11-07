# Architecture

How the Rust rewrite is organised, where the code lives and how a new module is added.

## Crates

| Crate | Responsibility | Must not |
|---|---|---|
| `socdof-core` | Domain entities, money, SQLite store, password hashing | Depend on any UI or windowing crate |
| `socdof-app` | Desktop application, Tauri shell (Phase 3) | Contain business rules |
| `socdof-ui` | Components, theme, screens (Phase 4) | Talk to SQLite directly |
| `socdof-cli` | Headless commands for tooling and data checks | Duplicate core logic |

Dependency direction is one-way: `app`/`ui`/`cli` → `core`. `core` never depends on the others.

## Inside `socdof-core`

```
src/
├── lib.rs              public surface + now_millis()
├── error.rs            CoreError, CoreResult
├── money.rs            Money (integer cents)
├── security.rs         Argon2id hash + verify
├── domain/             entities, no persistence code
│   ├── contact.rs
│   ├── invoice.rs
│   ├── product.rs
│   ├── settings.rs
│   ├── stock.rs
│   └── user.rs
└── store/              SQLite persistence, one file per aggregate
    ├── mod.rs          Store, schema, migrations
    ├── contacts.rs
    ├── invoices.rs
    ├── products.rs     products + stock movements
    ├── settings.rs     JSON key/value + company profile
    └── users.rs        accounts + credential checks
```

Rules:

- `domain` holds data and validation only. No SQL, no file system.
- `store` owns SQL. One module per aggregate, functions take `&Connection` (or the `Store` wrapper).
- Multi-entity writes run inside one transaction (`unchecked_transaction`).
- Money is always `Money` (integer cents). Never `f64`.
- Timestamps are `i64` milliseconds since the Unix epoch.
- Errors are `CoreError`; validation failures use `CoreError::Validation("snake_case_code")` so the UI
  can translate them.

## Schema and migrations

`store/mod.rs` keeps the schema as numbered constants (`SCHEMA_V1`, `SCHEMA_V2`, ...) and applies
them in order based on `PRAGMA user_version`. To change the schema:

1. Add `SCHEMA_V3` with only the delta (`ALTER TABLE`, `CREATE TABLE`).
2. Raise `SCHEMA_VERSION` to 3.
3. Add `if version < 3 { ... }` to `Store::migrate`.
4. Add a test that opens a fresh database and asserts the new version and behaviour.

Never edit an already shipped schema block; existing databases only run the newer steps.

## Adding a module (example: invoices already exists, orders do not)

1. `domain/order.rs`: entity, enums with `as_str`/`from_storage`, `validate`.
2. `store/orders.rs`: `insert`, `update`, `find`, `list`, transactional writes.
3. Extend `SCHEMA_V*` with the tables and indices.
4. Add thin methods on `Store`.
5. Tests: domain validation, store round-trip, rollback on failure.
6. Tick the module in `RUST_MIGRATION.md` and add a log row.

## Internationalisation

The four languages stay in one place: `crates/ui/locales/{de,en,fr,es}.json`, generated once from
`SOCDOF - TS/src/lib/i18n.ts` (Phase 7). Rust code only references keys; no literal UI text. Missing
keys fail the build in CI.

## Testing

```bash
cargo test --workspace
```

- Domain tests live next to the type (`#[cfg(test)] mod tests`).
- Store tests use `Store::open_in_memory()` — no files, no cleanup.
- Time-dependent behaviour takes `now` as a parameter where practical.

## Comparison with the legacy app

| Legacy (`SOCDOF - TS`) | Rust |
|---|---|
| `src/lib/db.ts` (Dexie/IndexedDB) | `crates/core/src/store` (SQLite) |
| `src/lib/auth.ts` | `domain/user.rs`, `store/users.rs`, `security.rs` |
| `src/components/*Module.tsx` | `crates/ui` screens (Phase 4–6) |
| `src/lib/i18n.ts` | `crates/ui/locales/*.json` (Phase 7) |
| `electron/main.cjs` | `crates/app` (Tauri, Phase 3) |
