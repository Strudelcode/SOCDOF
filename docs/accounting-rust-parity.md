# Native Accounting dashboard parity

Reference: `SOCDOF - TS/src/components/sales/AccountingModule.tsx`.

## Implemented in Rust

- Cross-module net/tax/gross totals from issued invoices, completed POS receipts and non-draft purchases.
- BWA operating result (invoice + POS net revenue minus purchase net value).
- Output VAT, input VAT and net VAT liability.
- 7% and 19% taxable bases and VAT buckets, with aggregated-cent rounding.
- Open receivables for sent and overdue invoices, including due date, gross amount and overdue flag.
- POS Z-report receipt count and cash/card/NFC/other tender totals.
- Date filtering against each source document's own date field, with All/Today/Month/Quarter/Year and inclusive custom start/end dates mapped to half-open timestamp ranges. Today currently follows the native UTC date helpers; local-timezone parity still needs a side-by-side check.
- Native Accounting UI Business Report tab backed by the core aggregate, refreshed whenever the app is reopened.
- Business Report amounts use the company profile currency; its CSV export includes company name, selected period, date, revenue, purchases, operating result and VAT liability, saved through a native file dialog.
- Native monthly tax-advisor ledger core: 12 monthly sheets, separate cash/bank income and expenses, sequential month-to-month carry-over, monthly CSV export and Excel-compatible 12-sheet SpreadsheetML workbook.
- Ledger sources: recorded invoice payments (actual payment date/method), completed POS receipts, non-draft purchases, manually entered journal bookings and business fleet mileage allowances. Unpaid invoices remain receivables and are not incorrectly treated as cash received.
- Current-year initial cash/bank balances are read from the persistent setting `tax_advisor_ledger_initial_carryover_<year>`; missing settings safely default to zero.
- Native Accounting toolbar now offers the tax-advisor workbook through a save dialog; all four languages have the new label.
- Unit and store-to-UI regression coverage for cross-module aggregation, VAT, receivables, POS tender totals, date ranges, draft exclusion, company currency and cash/bank ledger totals.

## Remaining parity checks

- [x] Match the legacy period selector's Today and custom date range options, including invalid/impossible date rejection.
- [ ] Compare the legacy CSV export's headings, locale/date formatting, delimiter, quoting and exact filename.
- [ ] Compare invoice/POS/purchase rounding against real imported legacy datasets, including VAT overrides and mixed rates.
- [ ] Verify open-item behavior for all legacy invoice states and any partial-payment representation.
- [ ] Verify local-timezone boundaries against the legacy browser implementation, then review the UI side by side in DE/EN/FR/ES and both themes.
- [x] Add the native 12-sheet monthly tax-advisor Excel export and sequential cash/bank carry-over.
- [ ] Add UI controls to edit the opening cash/bank balances and persistent manual ledger rows; current export uses existing Accounting journal entries and a stored opening balance (zero by default).
- [ ] Compare exact Excel XML layout, formula behavior, filenames, monthly CSV bytes and locale/date formatting against the TypeScript reference.
- [ ] Add equivalent therapy practice billing/trip integration where source data maps without double-counting invoices.

The Accounting module is not parity-signed-off until the remaining checks and full cross-platform CI pass.
