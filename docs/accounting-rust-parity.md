# Native Accounting dashboard parity

Reference: `SOCDOF - TS/src/components/sales/AccountingModule.tsx`.

## Implemented in Rust

- Cross-module net/tax/gross totals from issued invoices, completed POS receipts and non-draft purchases.
- BWA operating result (invoice + POS net revenue minus purchase net value).
- Output VAT, input VAT and net VAT liability.
- 7% and 19% taxable bases and VAT buckets, with aggregated-cent rounding.
- Open receivables for sent and overdue invoices, including due date, gross amount and overdue flag.
- POS Z-report receipt count and cash/card/NFC/other tender totals.
- Date filtering against each source document's own date field.
- Native Accounting UI report tab backed by the core aggregate.
- Unit coverage for cross-module aggregation, VAT, receivables, POS tender totals, date ranges and draft invoice exclusion.

## Remaining parity checks

- [ ] Match the legacy period selector's Today and custom date range options (native currently exposes All/Month/Quarter/Year).
- [ ] Verify currency symbols from the company profile instead of the current native Accounting screen's euro formatter.
- [ ] Compare the legacy CSV export's headings, locale/date formatting, delimiter, quoting and exact filename.
- [ ] Compare invoice/POS/purchase rounding against real imported legacy datasets, including VAT overrides and mixed rates.
- [ ] Verify open-item behavior for all legacy invoice states and any partial-payment representation.
- [ ] Side-by-side UI review in DE/EN/FR/ES and both themes.
- [ ] Add a native equivalent of the monthly tax-advisor cash ledger/Excel export; it is a separate legacy workflow and is not claimed complete here.

The Accounting module is not parity-signed-off until the remaining checks and full cross-platform CI pass.
