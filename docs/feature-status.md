# Funktionsstatus der Rust-Edition (verbindlich für alle KIs)

Diese Datei ist die **einzige** gepflegte Statusliste der Funktionsparität zwischen
`SOCDOF - TS/` (Verhaltensreferenz) und `crates/` (Produkt). Jede KI, die in diesem Repository
arbeitet, trägt hier nach jedem Arbeitsblock ein, was sie geändert hat.

Kurzregeln (vollständig in [`AGENTS.md`](../AGENTS.md)):

1. Status **nur** auf `fertig` setzen, wenn Verhalten, Persistenz und Tests belegt sind.
2. Jede Zeile nennt die Rust-Dateien, den Prüfbefehl und die verbleibende Lücke.
3. Neuer Arbeitsblock ⇒ neue Zeile im Änderungsprotokoll am Ende dieser Datei **und** Abschnitt in
   `RUST_MIGRATION.md`.
4. Bildbelege gehören nach `docs/artifacts/gui-parity/` (`rust-NN-thema-{light,dark}.png`).

## Legende

| Status | Bedeutung |
|---|---|
| `fertig` | Funktional und gegen die TS-Vorlage abgenommen, Tests grün, Beleg vorhanden |
| `teilweise` | Kern funktioniert mit echten Daten, benannte Lücken fehlen noch |
| `offen` | In Rust nicht vorhanden |
| `abweichend` | Bewusst anders (Begründung in `docs/rust-parity-status.md`, Abschnitt 4) |

## Module

| Modul | Status | Rust-Code | Funktioniert | Fehlt noch |
|---|---|---|---|---|
| Shell, Taskbar, Fenster, virtuelle Desktops | `teilweise` | `crates/ui/src/{desktop,shell,gallery}.rs` | Taskbar, Startmenü, Command Palette, Fenstergeometrie, Desktops, Task-View, Ordner, Hintergrundmenü | Echter Backdrop-Blur, OS-Tray/Autostart in der nativen Shell, Studio-/Widget-Modul vollständig |
| Anmeldung, Ersteinrichtung, Rollen | `fertig` | `crates/ui/src/{auth,auth_screens,users}.rs`, `crates/core/src/{security_questions,auth_security}.rs` | Argon2id, Sperren, Recovery, Passwortwechsel-Zwang, Rollen, Sessions | Web-Host (`crates/web`) ohne volle Erstlauf-/Avatar-Synchronisation |
| Einstellungen | `teilweise` | `crates/ui/src/settings.rs`, `crates/core/src/settings_service.rs` | 14 Sektionen inkl. Storage-Inspector, Sprachpakete, Sound, Sicherung, Portable | Werksreset, Monitor-Layout schreiben, Briefkopf in allen Renderern, echtes Nachtlicht |
| App Store | `fertig` | `crates/core/src/app_store.rs`, `crates/ui/src/app_store.rs` | Katalog, Aktivierung, Rollenmatrix, Persistenz | — |
| Kontakte & CRM | `fertig` | `crates/ui/src/contacts.rs` | CRUD, Ansprechpartner, Länder, CSV/vCard-Import/Export, Mailentwurf | — |
| Rechnungen | `fertig` | `crates/ui/src/{invoices,invoice_actions,invoice_templates}.rs`, `crates/core/src/domain/fattura.rs` | CRUD, Status, Mahnwesen, Mail, Zahlung, PDF/DOCX, Vorlagen, **FatturaPA-Inspektor mit XML-Export und Schemaprüfung**, **Status-Filterchips mit Zählern (inkl. Hinweis bei leerem Filter)** und **Rechnung duplizieren** (neuer Entwurf, nächste freie Nummer, neue Frist) | — | `rust-42`, `rust-51` |
| Produkte & Lager | `teilweise` | `crates/ui/src/{products,stock_moves}.rs` | CRUD, Etiketten, Meldebestand-Assistent, doppisches Journal | Produkt-Link-Extraktor (ASIN/Shop-URL), Filter-Tabs (Kategorie/knapp/inaktiv), Produkt duplizieren |
| Einkauf | `teilweise` | `crates/ui/src/purchases.rs` | Bestellungen, Wareneingang, **Produktbezug je Position (buchender Bestand)** | Bestellung duplizieren, Bestell-KPIs, PDF/E-Mail-Druck |
| POS / Kasse | `fertig` | `crates/ui/src/pos.rs`, `crates/core/src/{domain/pos,store/pos_orders}.rs` | Produktkacheln mit Kategorie-Chips und Suche, Barcode-/SKU-Schnellerfassung mit Enter, Warenkorb (+/−/Entfernen, Rabatt in %), Kundenwahl, sechs Zahlarten mit Schnellbeträgen und Rückgeld, atomarer Checkout (Beleg + Lager + optionale Rechnung), Tagesabschluss mit Zahlarten-/Steuergruppen und echtem `.txt`-Export, Storno; Schema **v24** (`discount_bp`), Seed mit Kategorien/Barcodes, Vorschau-Szenen `pos-cart`/`pos-receipt`/`pos-zreport`, 42 i18n-Keys in de/en/fr/es | Kein Bondrucker, kein echtes Karten-/NFC-Terminal (Zahlarten werden nur erfasst); Z-Bericht ist Rust-Erweiterung ohne TS-Pendant (Export statt `window.print()`); Rechnung nur mit gewähltem Kunden (TS nutzt Fallback-Kontakt 1); kein Pixel-Vergleich des POS-Screens (Maßstab ist Funktionsparität) | `rust-50` |
| Buchhaltung & Steuerberater | `fertig` | `crates/ui/src/accounting.rs`, `crates/core/src/{journal,tax_advisor_ledger}.rs` | Journal, Kassenbuch, UStVA, BWA, CSV/Workbook | — |
| Kalender & Termine | `teilweise` | `crates/ui/src/appointments.rs`, `crates/core/src/domain/appointment.rs`, `crates/core/src/store/appointments.rs` | Monat/Arbeitswoche/Woche/Tag, Ganztags und mehrtägig, sechs Kategorien mit Filter, Rechnungstermine aus fälligen Rechnungen, Suche, Statusfilter, Duplizieren, `.ics`-Export (Ganztags als Datum, `CATEGORIES`), Konfliktprüfung | Google-Kalender-Sync (OAuth/Netz), Browser-Druck, mobile Bottom-Sheets |
| Therapiepraxis | `teilweise` | `crates/ui/src/therapie.rs`, `crates/core/src/domain/therapy.rs` | Klienten, Sitzungen, Einzelrechnung, Fahrtenbuch | Praxis-Dashboard, Termin-Tab, Sammelrechnung |
| Support & Mobile Companion | `teilweise` | `crates/ui/src/support.rs`, `crates/core/src/{mobile_sync,domain/support}.rs` | Tickets, Zeiten, Rechnung aus Ticket, Mobile-Import, Gateway | Ticket-PDF-Abnahme, Checklisten je Arbeitsschritt |
| Projekte, Flotte, Restaurant | `fertig` | `crates/ui/src/{projects,fleet,restaurant}.rs` | CRUD, Aufgaben, Fahrtenbuch, Tisch/Küche/Kasse | — |
| Textwerk & Editor | `fertig` | `crates/ui/src/{editor,textwerk}.rs` | Markup-Editor, Hunspell DE, DOCX/ODT/HTML | — |
| Dokumentation | `teilweise` | `crates/ui/src/documentation.rs` | Fünf Tabs (Übersicht, Handbuch, Tastatur, Sicherheit, Releases) | Handbuchtexte sind kurz; Suche/Release-Liste ausbauen |
| Berichte | `fertig` | `crates/ui/src/reports.rs`, `crates/core/src/store/reports.rs` | Zeiträume, KPIs, Statusverteilung, Tabelle, **CSV- und PDF-Export** | — |
| Benutzer & Rollen | `fertig` | `crates/ui/src/users.rs` | Konten, Rollen, Passwort-Reset, Pflichtwechsel | — |

## Fehlende Module (größte offene Blöcke)

| Modul | Status | TS-Vorlage | Umfang |
|---|---|---|---|
| **Schnellkasse (`ios_billing`)** | `teilweise` | `crates/core/src/domain/quick_billing.rs`, `crates/core/src/store/quick_billing.rs`, `crates/ui/src/quick_billing.rs` | Fünf Tabs (Kasse, Speisen, Belege, Statistik, Einstellungen); Speisen-CRUD mit Kategorie, Bruttopreis, MwSt., Bestand, Aktiv-Schalter und Beilagen-Gruppen (Aufpreis, Vorauswahl); Warenkorb mit Menge/Entfernen/Leeren und Netto-/MwSt.-/Brutto-Summen (Netto halb-auf gerundet); drei Zahlarten Bar (Rückgeld), Karte, Apple Pay/NFC; Belegnummern `BON-<Jahr>-####`/`STO-<Jahr>-####`; Storno als Gegenbuchung mit Bestandsrückbuchung; Bon-Journal mit Detail und Storno; Statistik aus SQLite; Schema **v21** (`quick_dishes`, `quick_receipts`) | Beweisfotos/Bild-Upload der Vorlage (kein Bild-Backend), Bondruck/E-Mail-Versand, echte TSE-Hardware (Signatur ist eine deterministische Prüfsumme) | `rust-45`, `rust-46`, `rust-47` |
| **Tabellenkalkulation (`table`)** | `fertig` | `crates/core/src/domain/spreadsheet.rs`, `crates/core/src/store/spreadsheet.rs`, `crates/ui/src/table.rs` | Vier Ribbon-Tabs (Datei, Start, Einfügen, Ansicht): Dokumentliste mit Neu/Öffnen/Speichern/Löschen, CSV-Export/-Import über echtes Dateisystem, Zellstile (Fett/Kursiv/Unterstrichen, fünf Schriftfamilien, Schrift- und Füllfarbe inkl. „keine“, drei Ausrichtungen, Zelle/Bereich leeren), Zeilen/Spalten einfügen/löschen mit mitwandernden Stilen, fünf Bereichsfunktionen (`SUMME`, `MITTELWERT`, `MAX`, `MIN`, `ANZAHL`), Formelbalken, Gitternetz-/Formelbalken-Schalter, Statuszeile, Tastaturnavigation (Pfeile, Enter, Tab, Shift+Tab). Domäne rechnet Formeln mit eigenem Parser (A1-Referenzen, Bereiche, Zyklusschutz, `#FEHLER`) statt JavaScript; Raster 8–26 × 20–200; Persistenz in SQLite Schema **v22** (`table_documents`, Vorlage hat keine Persistenz) | Vorlagen-Speicher der Vorlage (`TEMPLATE_STORAGE_KEY`) ist dort ungenutzt und deshalb nicht portiert; Bereichsfunktion über einem Block ab Zeile 1 wird mit Hinweis abgelehnt (Vorlage hat dafür kein Verhalten) | `rust-48` |
| Feedback (Discord) | `offen` | `SOCDOF - TS/src/components/apps/DiscordFeedbackApp.tsx` | Netzwerkfunktion; bewusst zurückgestellt, weil die native Edition offline-first bleibt |

## Prüfbefehle (ein Crate nach dem anderen)

```bash
source "$HOME/.cargo/env"
export CARGO_BUILD_JOBS=1 CARGO_PROFILE_TEST_DEBUG=0 CARGO_PROFILE_DEV_DEBUG=0
cargo fmt -p socdof-ui -p socdof-core -- --check
cargo clippy -p socdof-core --all-targets -- -D warnings
cargo clippy -p socdof-ui --all-targets -- -D warnings
cargo test -p socdof-core
cargo test -p socdof-ui
cargo test -p socdof-ui --test visual      # Goldens; UPDATE_SNAPSHOTS=1 schreibt sie neu
cargo run -q -p socdof-ui --bin socdof-ui-catalogue   # nach i18n-Änderungen
```

## Änderungsprotokoll dieser Datei

| Datum | Block | Ergebnis |
|---|---|---|
| 2026-11-27 | Einkauf: Produktbezug je Position | `PurchaseLineDraft.product`, Auswahl im Formular, Vorbelegung von Beschreibung/EK/MwSt; Wareneingang bucht den Bestand. Test `links_a_catalogue_product_to_a_position_and_books_its_stock` |
| 2026-11-27 | Rechnungen: FatturaPA/SdI-Inspektor | `InvoiceAction::Fattura`, Dokumenttyp TD01/TD04/TD24, Empfängercode/PEC/Bollo/CUP/CIG, Schemaprüfung und XML-Export; Szene `invoices-fattura`, Beleg `rust-42` |
| 2026-11-27 | Berichte: CSV- und PDF-Export | `Report::to_csv`/`Report::to_pdf` im Core, Exportknöpfe im Berichtsbildschirm; Beleg `rust-43` (Einkauf: `rust-44`) |
| 2026-11-27 | Schnellkasse `ios_billing` | Domäne + Store + UI: Gerichte/Beilagen, Warenkorb, drei Zahlarten, Bon-Journal mit Storno, Statistik, Schema v21, 12 Core- und 6 UI-Tests (`cargo test -p socdof-core --lib` 420, `-p socdof-ui --lib` 455), Telefon-Sweep inkl. 9 neuer Fälle; Belege `rust-45`…`rust-47` |
| 2026-11-27 | Kalender & Termine | Arbeitswoche, Ganztags/mehrtägig (`all_day`, Enddatum/-zeit), Kategorien (Rechnung, Kunde, Meeting, Frist, Privat, Allgemein) mit Filterchips und „Nur Rechnungen“, fällige Rechnungen als schreibgeschützte Termine, Duplizieren, Schnelldauern, ICS-Export mit Datumswerten und Kategorien; Schema v23, 3 neue Core- und 4 neue UI-Tests (`cargo test -p socdof-core --lib` 437, `-p socdof-ui --lib` 467), Telefon-Sweep 1.432 Fälle, Katalog 2.701 Keys; Belege `rust-49` |
| 2026-11-27 | POS/Kasse | Kassenansicht mit Produktkacheln (Kategorie, Suche, Bestand), Barcode-/SKU-Schnellerfassung mit Enter, Warenkorb (+/−/Entfernen, Rabatt in %), Kundenwahl, sechs Zahlarten mit Schnellbeträgen und Rückgeld, atomarer Checkout (Beleg + Lager + bezahlte Rechnung), letzter Beleg, Z-Bericht mit Zahlarten-/Steuergruppen und `.txt`-Export; Schema v24 (`discount_bp`), `Store::pos_checkout`; Core 440, UI 471, Telefon-Sweep 1.448 Fälle, Katalog 2.748 Keys; Belege `rust-50` |
| 2026-11-28 | Rechnungen: Filterchips und Duplizieren | Sechs Status-Chips mit Zählern über der Liste (`InvoicesState::filter_status`, `status_count`, `visible_invoices`), leerer Filter mit eigenem Hinweis; `InvoicesState::duplicate` legt einen Entwurf mit nächster freier Nummer, heutigem Datum, 14 Tagen Frist und unveränderten Positionen an, `duplicate_selected` hängt an der Detailansicht; 9 neue i18n-Keys in de/en/fr/es (Katalog 2.757), Sweep-Fall `invoices filter`; `cargo test -p socdof-ui --lib` 473, Telefon-Sweep 1.456 Fälle; Beleg `rust-51` |
| 2026-11-27 | Tabellenkalkulation `table` | Domäne + Store + UI: Raster 8–26 × 20–200, Formelparser (fünf Bereichsfunktionen, Zyklusschutz, `#FEHLER`), Zellstile mit Stilverschiebung, CSV-Roundtrip, Dokument-CRUD in SQLite Schema v22, Ribbon mit vier Tabs, Formelbalken, Statuszeile, Tastatur; 10 Core- + 4 Store- + 9 UI-Tests (`cargo test -p socdof-core --lib` 434, `-p socdof-ui --lib` 464), Telefon-Sweep grün (1.424 Fälle), Katalog 2.678 Keys; Beleg `rust-48` |
