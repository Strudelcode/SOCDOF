# Changelog

All notable changes to SOCDOF are documented here. The release workflow reads
the section matching the pushed tag; a release fails if this file has no
matching, non-empty section.

## [0.1.0] - 2026-11-07

### Added

- Contacts and products are now first-class modules in the Rust desktop app:
  create, edit, delete and search them from the new master-data navigation.
  The forms cover the legacy fields (contact type, company/person, address,
  tax id, notes; SKU, category, unit, prices, tax rate, stock levels, barcode,
  emoji and reorder exclusion commit) in German, English, French and Spanish.
- Legacy backup compatibility: the Rust app imports and exports the legacy
  `.socdof.json` document, keeps unknown tables and unknown row fields, and
  passes a round-trip test against a real backup created by the legacy
  `exportDatabaseToJson` function. The exported file was also read back with
  the legacy `importDatabaseFromJson` function without losing tables.
- The GUI smoke now creates, updates and searches a contact and a product,
  verifies both screens rendered the data, and reports the counts, name and
  SKU to CI. Command-layer tests cover contact/product CRUD, search, deletion
  and legacy import/export.
- Native Rust core with SQLite schema v3, integer-cent money handling, contacts,
  products, stock movements, invoices, users, company settings, backups,
  instance locking and DIN 5008 invoice PDFs.
- Tauri 2 desktop foundation with real contacts/products/database/backup
  screens, German, English, French and Spanish texts, light/dark system theme
  support and a command layer that delegates to the shared Rust core.
- Signed Tauri updater integration for release builds. Linux AppImage, Windows
  NSIS and macOS app bundles can check the GitHub release endpoint and install
  signed updates; the app then restarts through the process plugin.
- CI packaging for Linux (AppImage, `.deb`), Windows (portable ZIP, NSIS, MSI)
  and macOS (universal DMG), plus a real WebView/command smoke test under Xvfb.
- Changelog-driven release notes, GitHub Releases with checksums, a generated
  `latest.json` updater manifest and a Discord release announcement using the
  existing bot/thread secrets.

### Preview scope

This release is still a migration milestone, not yet a 1:1 replacement for the
legacy Electron application. Contacts and products now have complete desktop
CRUD/search flows, and legacy JSON backups round-trip; invoices, purchases,
stock moves, POS, accounting, calendar and the remaining modules are tracked in
[`RUST_MIGRATION.md`](RUST_MIGRATION.md). The legacy application remains
unchanged in `SOCDOF - TS`.
