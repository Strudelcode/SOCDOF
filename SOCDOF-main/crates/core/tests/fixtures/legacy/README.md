# Legacy backup fixture

`SOCDOF_Legacy_Backup_2026-11-07.socdof.json` is a real backup produced by the shipping legacy
application, not a hand-written fixture.

It was generated with the legacy function `exportDatabaseToJson` from
`SOCDOF - TS/src/lib/db.ts`, running against Dexie with `fake-indexeddb`. The source records are the
legacy demo/seed data plus the legacy export metadata, so the document has the same structure a user
backup has:

- `app`, `version`, `exported_at`, `backup_owner`, `backup_target_folder`, `data_summary`
- 3 contacts, 2 products, 1 stock move, 1 invoice, 1 purchase order, 1 POS order, 1 chatter message
- 2 settings
- legacy-only fields such as `contact_persons`, `default_hourly_rate`, `web_link` and `source_domain`

## Round-trip proof

`cargo test -p socdof-core` imports this file, exports it again and compares the contact/product
arrays and every unknown table byte-for-byte at the JSON value level. `cargo test -p socdof-app`
imports the same file through the desktop command path and re-imports the exported document.

The Rust export was additionally passed to the real legacy importer `importDatabaseFromJson`. It
returned `true` and restored 3 contacts, 2 products, 1 invoice, 1 stock move, 1 purchase order, 1 POS
order, 1 chatter message and 2 settings. Reproduce it with:

```bash
cargo run -q -p socdof-cli -- legacy-import /tmp/verify.db \
  crates/core/tests/fixtures/legacy/SOCDOF_Legacy_Backup_2026-11-07.socdof.json
cargo run -q -p socdof-cli -- legacy-export /tmp/verify.db /tmp/rust-roundtrip.socdof.json
```

Then call `importDatabaseFromJson` from `SOCDOF - TS/src/lib/db.ts` with the generated file in an
environment that provides IndexedDB (for example `fake-indexeddb`).
