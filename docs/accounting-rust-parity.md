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
- Separate native VAT return, open receivables and POS Z-report tabs now mirror the four distinct legacy report areas; the combined Business Report remains available as an overview. All tab labels are translated in DE/EN/FR/ES.
- The native BWA tab now includes invoice/POS net revenue, purchase net expenses, operating result and VAT liability, alongside the existing journal-account summary.
- Business Report amounts use the company profile currency; its CSV export includes company name, selected period, date, revenue, purchases, operating result and VAT liability, saved through a native file dialog.
- Native monthly tax-advisor ledger core: 12 monthly sheets, separate cash/bank income and expenses, sequential month-to-month carry-over, monthly CSV export and Excel-compatible 12-sheet SpreadsheetML workbook. The workbook includes localized DE/EN/FR/ES labels and Excel formulas for income/expense totals, cash/bank balances, transaction running balance and cross-sheet monthly carry-over.
- Ledger sources: practice billable items, posted/sent/overdue/paid invoices, recorded payment date/method when present, completed POS receipts, non-draft purchases and manually entered journal bookings. Linked invoices are skipped when their billable positions are already represented, preventing duplicate income. Sent/overdue invoices follow the legacy TypeScript rule and are included as posted revenue; a recorded payment overrides the issue date and cash/bank channel.
- The year selector covers the current year, the previous five years and the next year. Per-year opening cash/bank balances are read from and saved to the persistent setting `tax_advisor_ledger_initial_carryover_<year>`; missing settings safely default to zero.
- Native Accounting toolbar now offers the 12-sheet workbook and a selected-month CSV through native save dialogs; all four languages have the new labels.
- Opening cash and bank balances can be edited in the Accounting screen and persist in the existing settings table per year.
- Unit and store-to-UI regression coverage for cross-module aggregation, VAT, receivables, POS tender totals, date ranges, draft exclusion, company currency and cash/bank ledger totals.

## Remaining parity checks

- [x] Match the legacy period selector's Today and custom date range options, including invalid/impossible date rejection.
- [ ] Compare the legacy CSV export's headings, locale/date formatting, delimiter, quoting and exact filename.
- [ ] Compare invoice/POS/purchase rounding against real imported legacy datasets, including VAT overrides and mixed rates.
- [x] Match the legacy tax-ledger rule for sent/overdue/paid invoices and skip draft/cancelled invoices; paid invoices use recorded payment date and tender when present.
- [ ] Verify open-item behavior for all legacy invoice states and any partial-payment representation.
- [ ] Verify local-timezone boundaries against the legacy browser implementation, then review the UI side by side in DE/EN/FR/ES and both themes.
- [x] Add the native 12-sheet monthly tax-advisor Excel export and sequential cash/bank carry-over.
- [x] Add UI controls to edit and persist the opening cash/bank balances; existing Accounting journal entries are included as manual ledger transactions.
- [ ] Add dedicated manual tax-ledger rows if required beyond the existing journal form.
- [ ] Compare exact Excel XML layout, formula ranges/behavior, filenames, monthly CSV bytes and locale/date formatting against the TypeScript reference.
- [x] Include practice billing items and suppress linked invoice duplicates.
- [x] Include persisted therapy practice trips as bank expenses in the monthly tax-advisor ledger, using each trip's own rate and the legacy route description; regression coverage checks date, channel, amount and description. The native egui mileage editor and exact TypeScript rate precision/preset behavior remain open.

The Accounting module is not parity-signed-off until the remaining checks and full cross-platform CI pass.
