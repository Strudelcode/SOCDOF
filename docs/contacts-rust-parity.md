# Native Contacts import/export parity

This checklist tracks the native Rust port against:

- `SOCDOF - TS/src/components/contacts/ContactsModule.tsx`
- `SOCDOF - TS/src/lib/contactImportExport.ts`

## Implemented

- Multi-row creation with row validation and one SQLite transaction.
- CSV import with comma, semicolon and tab delimiter detection, quoted values, escaped quotes and embedded newlines.
- Header matching for common German, English, French, Spanish, Outlook, Google Contacts and Apple Contacts labels.
- vCard import with folded lines and escaped text values.
- Import preview with row removal and one category applied to all selected rows.
- CSV export with UTF-8 BOM, semicolon delimiter, quoted fields and CRLF records.
- vCard 3.0 export.
- Native file pickers and DE/EN/FR/ES labels.

## Required acceptance checks

- [ ] Compare every source header alias, including multiple e-mail and phone columns and mobile/business/home priority.
- [ ] Verify imported `ContactPerson` rows where the source format contains multiple people.
- [ ] Verify duplicate/empty rows and malformed quoted CSV input.
- [ ] Verify vCard 2.1/3.0/4.0 variants, multiple EMAIL/TEL properties, escaped separators and quoted-printable values.
- [ ] Port the legacy cleanup of dummy `@import.local` and `@kontakt.local` addresses without modifying valid contacts.
- [ ] Provide the legacy export scope choice: all contacts or current filtered view.
- [ ] Compare exact filenames, MIME types and output bytes against the TypeScript reference.
- [ ] Verify cancellation, unreadable files, invalid e-mail values and large imports on Windows, Linux and macOS.

A feature is not marked parity-complete until the acceptance checks and the full Rust workspace CI pass.