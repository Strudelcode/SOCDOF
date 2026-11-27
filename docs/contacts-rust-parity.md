# Native Contacts import/export parity

This checklist tracks the native Rust port against:

- `SOCDOF - TS/src/components/contacts/ContactsModule.tsx`
- `SOCDOF - TS/src/lib/contactImportExport.ts`

## Implemented

- Multi-row creation with row validation and one SQLite transaction.
- CSV import with comma, semicolon and tab delimiter detection, quoted values, escaped quotes and embedded newlines.
- Header matching for common German, English, French, Spanish, Outlook, Google Contacts and Apple Contacts labels, including tax-ID aliases and multiple business/home/other address columns with first-non-empty fallback.
- vCard 2.1/3.0/4.0 import with grouped property names, folded-line unfolding, quoted-printable decoding (including soft line breaks and ISO-8859-1/Windows-1252/UTF-8), URI telephone normalization, truncated-final-card recovery, malformed email rejection and escaped text values.
- Import preview with row removal and one category applied to all selected rows.
- CSV export with UTF-8 BOM, semicolon delimiter, quoted fields and CRLF records.
- vCard 3.0 export with UTF-8-safe 75-octet line folding.
- Date-stamped `kontakte_export_<UTC-date>.csv` / `.vcf` filenames match the TypeScript exports; native save dialogs expose the corresponding file extensions.
- Exact TypeScript-reference byte fixtures cover the standard CSV and vCard output, including BOM, CRLF, name splitting, address, and multiline notes. Native files do not carry browser MIME metadata; the OS infers file type from the selected extension.
- Native file pickers and DE/EN/FR/ES labels.

## Required acceptance checks

- [x] Multiple e-mail and phone columns are scanned in the legacy mobile/primary/business/home/general priority order; first/middle/last names are combined before falling back to a full-name column.
- [x] Multiple business/home/other address columns fall back to the first non-empty value; legacy "Buch" category text maps to Guest.
- [x] CSV export preserves embedded line breaks inside quoted fields; vCard cards with no valid e-mail do not store empty/dummy e-mail values.
- [x] Blank CSV rows are ignored, duplicate contacts are preserved, and an unmatched quoted tail is discarded without losing complete rows; a 5,000-contact parser regression covers larger imports.
- [x] Verify vCard 2.1/3.0/4.0 variants, grouped property names, URI telephone values, folded lines and escaped text.
- [x] Decode vCard 2.1 quoted-printable values and soft line breaks with UTF-8, ISO-8859-1 and Windows-1252 handling. Scan all EMAIL/TEL properties and choose the first valid non-empty value; regression coverage includes invalid-first/valid-second entries.
- [x] Legacy `@import.local` and `@kontakt.local` addresses are cleaned on first native Contacts load; valid e-mail addresses are preserved.
- [x] Export scope supports all contacts or the current filtered view, with a date-stamped filename.
- [x] Company-only vCards use the company as `FN` while keeping the personal `N` fields empty; empty optional values are omitted like the TypeScript export.
- [x] CSV import strips single-quoted header/cell wrappers like the TypeScript `cleanVal` helper.
- [ ] Compare exact output bytes for special-character vCard escaping/folding against the TypeScript reference; TypeScript's MIME values are browser-only and do not apply to native files.
- [ ] Verify cancellation, unreadable files, invalid e-mail values and large imports on Windows, Linux and macOS.

A feature is not marked parity-complete until the acceptance checks and the full Rust workspace CI pass.