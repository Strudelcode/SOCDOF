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
- Native Accounting UI Business Report tab backed by the core aggregate, refreshed whenever the app is reopened.
- Business Report amounts use the company profile currency; its CSV export includes company name, selected period, date, revenue, purchases, operating result and VAT liability.
- Unit and store-to-UI regression coverage for cross-module aggregation, VAT, receivables, POS tender totals, date ranges, draft exclusion and company currency.

## Remaining parity checks

- [ ] Match the legacy period selector's Today and custom date range options (native currently exposes All/Month/Quarter/Year).
- [ ] Compare the legacy CSV export's headings, locale/date formatting, delimiter, quoting and exact filename.
- [ ] Compare invoice/POS/purchase rounding against real imported legacy datasets, including VAT overrides and mixed rates.
- [ ] Verify open-item behavior for all legacy invoice states and any partial-payment representation.
- [ ] Side-by-side UI review in DE/EN/FR/ES and both themes.
- [ ] Add a native equivalent of the monthly tax-advisor cash ledger/Excel export; it is a separate legacy workflow and is not claimed complete here.

The Accounting module is not parity-signed-off until the remaining checks and full cross-platform CI pass.
