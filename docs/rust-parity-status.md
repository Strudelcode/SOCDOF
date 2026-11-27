# Rust-Edition: was steht, was fehlt (Stand 2026-11-27)

Diese Datei ist die kurze Gesamtübersicht über die Portierung von `SOCDOF - TS/` nach `crates/`.
Sie ergänzt die Detaildokumente:

- [`rust-functional-parity-inventory.md`](rust-functional-parity-inventory.md) — Datei-für-Datei-Inventar und Audit-Notizen
- [`RUST_MIGRATION.md`](../RUST_MIGRATION.md) — chronologisches Änderungsprotokoll, §15 = GUI-Parität
- [`settings-rust-parity.md`](settings-rust-parity.md), [`accounting-rust-parity.md`](accounting-rust-parity.md), [`contacts-rust-parity.md`](contacts-rust-parity.md) — Bereichs-Audits
- `docs/parity/` — TS/Rust-Bildpaare mit Pixel- und SSIM-Messung
- `docs/artifacts/gui-parity/` — native egui-Szenen (Light/Dark) je abgeschlossenem Punkt

## Legende

| Kennzeichnung | Bedeutung |
|---|---|
| **1:1** | Verhalten, Optik, Tastatur und Persistenz gegen die TS-Vorlage geprüft; Bildbeleg und Tests vorhanden |
| **funktional** | Portiert und getestet, aber noch kein abgeschlossener optischer Vergleich |
| **offen** | In der Rust-Edition nicht vorhanden oder nur teilweise vorhanden |
| **Abweichung** | Bewusst anders, weil egui/Plattform es nicht hergeben (begründet) |

## 1. Was 1:1 fertig ist

### Shell und Desktop

| Punkt | Beleg |
|---|---|
| Taskbar (36×36-Buttons, transluzente Fläche, Suchpille, Task-View, Versions-Pille, Sekunden-Uhr, Overflow-Menü) | `rust-07`, `rust-31`…`rust-33` |
| Desktop-Icons: 48-px-Kacheln mit Akzent-Schatten, umbrechende Labels, Öffnen-Marker, freie Positionen, responsive Spalten | `rust-08`, `rust-31` |
| Desktop-Ordner: Mini-Vorschau (1/2/3–4 Apps, `+n`), Ordner-Modal (Starten, Entfernen, Umbenennen, Auflösen), Ziehen auf Ordner, Icon-auf-Icon-Zusammenführen | `rust-31`…`rust-33` |
| Desktop-Hintergrundmenü: Widgets, Haftnotiz, Task-View, Upload, Anordnen, Einrasten, App Store, Einstellungen, Vollbild; Datei-/Speicher-Tab im Ordner | `rust-34`, `rust-35` |
| Virtuelle Desktops und vollständige Task-Ansicht (Fenster je Desktop, Verschieben, Anlegen/Löschen/Umbenennen, `Ctrl+Alt+←/→`, `Ctrl+Shift+D`) | `rust-37`…`rust-40` |
| Sperrbildschirm (Uhr, Datum, Avatar, Passwortfeld, Wiederherstellungs-Hinweis, Kontowechsel-Kacheln) | `rust-02` |
| Ersteinrichtung: fünf Schritte (Willkommen, Konto, Erscheinungsbild, Apps, Abschluss), Sprachwahl, Kontotyp, Vorlagen, Passwortstärke, Swatches, Wallpaper-Upload | `rust-09` |
| Command Palette, Toasts, gebündelte Source-Sans-3-Schriften, F11 / `Ctrl+K` / `Ctrl+L` / `Escape` | `docs/parity` (Command Palette light/dark ≥98 %) |
| Fensterverwaltung mit gespeicherter Geometrie je Benutzer, 19 Launcher-Einträge als eigene Fenster | Tests in `crates/ui/src/desktop.rs` |

### Einstellungen (14 Sektionen)

Anzeige, Allgemein, Zahlungen & Bankverbindung, Briefkopf, Sprache, Personalisierung, **Sound &
Lautstärke**, Sicherheit, Sicherung, Benutzer, Rollen, Updates, Portable, Tastenkombinationen.

- **Sound & Lautstärke** (neu, 2026-11-27): Stummschalter, Master-Lautstärke mit Prozent-Pille,
  0 %/100 %-Enden, Schnellwahl 15/35/60/85/100 %, sofortiges Speichern, Telefon-Layout — `rust-41`.
- Anzeige-Skalierung (75–200 %) wird validiert, gespeichert und auf egui angewendet; Nachtlicht ist
  ein Fenster-Tint (keine OS-Farbtemperatur, siehe Abweichungen).
- Briefkopf: Logo, Betreff, Register-/Geschäftsführungsangaben, vier Fußzeilen-Spalten, Hintergrund,
  DIN-5008-Falzmarken — gespeichert, aber noch nicht in alle PDF/DOCX-Renderer verdrahtet (offen).

### Anmeldung und Konten

- Login mit Konto-Auswahl, Sperren/Entsperren (`Ctrl+L`), Wiederherstellung über zwei Antworten
  (Argon2id, case-insensitiv), erzwungener Passwortwechsel beim ersten Login, Ersteinrichtung des
  ersten Administrators, Benutzer-/Rollenverwaltung.
- Sitzungen werden beim Passwortwechsel invalidiert; pro Benutzer getrennte Einstellungen,
  Icon-Positionen, Fenstergeometrie und Desktop-Layout.

### Daten und Exporte (funktional, mit Tests)

SQLite-Schema v18, Backups/Archive, CSV (Kontakte, Flotte, Buchhaltung, Journal, Stock-Moves),
vCard, iCal, PDF/DOCX-Erzeugung, FatturaPA, Z-Bericht, Mahnwesen.

### Funktionsblöcke vom 2026-11-27 (Fortsetzung)

- **FatturaPA/SdI-Inspektor** (Rechnungen): Dokumenttyp TD01/TD04/TD24, Empfängercode, PEC,
  Stempelsteuer, CUP/CIG, Schemaprüfung über `domain::fattura::validate`, XML-Vorschau und
  XML-Export mit SdI-Dateinamen (`IT<USt-IdNr.>_<Progressiv>.xml`) — Beleg `rust-42`.
- **Berichte-Export**: CSV (`Report::to_csv`, Semikolon, englische Spaltenköpfe) und A4-PDF
  (`Report::to_pdf`) über den Systemdialog — Beleg `rust-43`.
- **Einkauf mit Produktbezug**: Jede Bestellposition kann ein Katalogprodukt wählen; Beschreibung,
  Einkaufspreis und Steuersatz werden vorbelegt, der Wareneingang bucht den Bestand. Vorher blieb
  `product_id` immer leer, sodass der Wareneingang keinen Bestand verändern konnte — Beleg `rust-44`.
- **Schnellkasse `ios_billing`** (neu): fünf Tabs mit Speisen-CRUD (Kategorie, MwSt., Bestand,
  Beilagen mit Aufpreis/Vorauswahl), Warenkorb mit halb-auf gerundeten Netto-/Steuer-Summen, die
  drei Zahlarten der Vorlage (Bar mit Rückgeld, Karte, Apple Pay/NFC), Bon-Journal mit Detail und
  **Storno als Gegenbuchung** samt Bestandsrückbuchung, Tages-/Gesamtstatistik aus den gespeicherten
  Belegen, Kassen- und Fußzeilen-Einstellungen. Persistenz in SQLite-Schema v21 — Belege `rust-45`…`rust-47`.

## 2. Funktional fertig, optisch noch nicht abschließend verglichen

Diese Module laufen, haben Tests und eigene Fenster, sind aber noch nicht Bild-für-Bild gegen die
TS-Vorlage abgenommen:

Dashboard, Kontakte, Produkte (inkl. Journal/Stock-Moves), Projekte, Flotte, Restaurant, Rechnungen
(inkl. Vorlagen, Druck, E-Mail), Buchhaltung, Einkauf, POS/Kasse, Kalender, Benutzer, Editor,
Textwerk, App Store, Support, Reports, Therapie.

Für Dashboard, Rechnungen, Kontakte, Einstellungen und Command Palette liegen bereits TS/Rust-Paare
mit ≥98 % Pixel-Übereinstimmung und ≥0,90 SSIM vor (`docs/parity`); die übrigen Modulpaare fehlen.

## 3. Was noch offen ist

### Shell / Desktop

- [ ] Taskbar-Hintergrund-Blur (siehe Abweichungen)
- [ ] OS-Tray-Integration und Autostart-Verknüpfung in der nativen Shell
- [ ] Desktop-Widgets über die vorhandenen Platzhalter hinaus (Rechner-Widget, Widget-Einstellungen)
- [ ] Studio-Drawer / Widgets-Modul vollständig

### Einstellungen

- [ ] Sound-Katalog der Referenz (einzelne Effekte mit eigenen Vorschau-Buttons) — ohne Audio-Backend
      nicht sinnvoll (Abweichung)
- [ ] Monitor-Layout bearbeiten, Auflösung/Ausrichtung/Primärmonitor setzen (nur Erkennung + Anzeige)
- [ ] Nachtlicht als echte OS-Farbtemperatur
- [ ] Briefkopf-Werte in allen PDF/DOCX/Druck-Renderern
- [ ] Benutzer-Avatare, Kontotyp-Anzeige, Wiederherstellungsfragen pro Benutzer
- [ ] Eigene Sprachpakete / Sprachpaket-Import
- [ ] Vollständiger System-Reset (destruktiver Reset aller Daten)
- [ ] Google-Calendar-/iCal-Verbindungen (nur lokaler iCal-Export vorhanden)

### Module

- [ ] Therapie: exakte Alt-Datums-/Default-Semantik, Löschbestätigung, Rechnungsdruck-Details
- [ ] Buchhaltung: exakte CSV/Excel-Bytes, Teilzahlungs-Sonderfälle, Zeitzonengrenzen
- [ ] Kontakte: exakte Dateinamen/MIME/Byte-Ausgabe, weitere Header-Varianten, Fehlerfälle
- [ ] Flotte: Formular-Sonderfälle, Rechnungsübergabe, CSV-Dateinamen
- [ ] Restaurant: kompletter Bestell-/Küchenablauf, Bon-Druck
- [ ] POS: Bon-Druck, Z-Bericht-Darstellung
- [ ] Schnellkasse: Bondruck/E-Mail-Versand, Beweisfotos (kein Bild-Backend), echte TSE-Hardware
- [ ] Projekte: Filter, Aufgaben-Übergänge, CSV-Formatierung, Rechnungsnummern
- [ ] App Store, Support, Editor/Textwerk: vollständige Workflow-Abnahme
- [ ] Rechnungen: Status-Filterchips, Rechnung duplizieren
- [ ] Einkauf: Bestellung duplizieren, Bestell-KPIs, PDF/E-Mail-Druck
- [x] **Kalender & Termine** sind portiert (`crates/ui/src/appointments.rs`, Schema v23, Beleg `rust-49`); offen bleiben Google-Sync, Browser-Druck und die mobilen Sheets
- [x] **Tabellenkalkulation `table`** ist portiert (`crates/ui/src/table.rs`, Schema v22, Beleg `rust-48`); offen bleibt nur der in der Vorlage ungenutzte Vorlagen-Speicher

### Übergreifend

- [ ] Bildpaare (TS/Rust) für alle Module außer den fünf abgenommenen Ansichten
- [ ] Side-by-side-Abnahme auf Windows und macOS (bisher Linux/Xvfb)
- [ ] CI-Lauf auf dem aktuellen Stand (lokal sind fmt, clippy und Tests grün)

## 4. Bewusste Abweichungen und technische Grenzen

| Thema | Abweichung | Grund |
|---|---|---|
| Taskbar-Blur | 84 % transluzente Fläche statt Backdrop-Blur | egui 0.27 kann nicht in eine Textur rendern; ein echter Blur bräuchte einen eigenen wgpu-Pass |
| Audio | keine Wiedergabe, `Probehören` deaktiviert + Hinweis; kein Sound-Katalog | der Workspace hat kein Audio-Backend und keine Audio-Abhängigkeit |
| Lautstärke | `u8`-Prozent statt `f64` | `Preferences` ist `Eq`; die Referenz speichert ebenfalls Prozentwerte |
| Nachtlicht | Tint über dem eigenen Fenster | keine OS-Farbtemperatur-API ohne Plattform-Abhängigkeit |
| Anzeige | nur Erkennung und Layout-Vorschau | sicheres Schreiben von Auflösung/Ausrichtung ist plattformspezifisch |
| Persistenz | SQLite je Benutzer statt `localStorage` | die native Edition hat eine echte Datenbank; Werte und Defaults entsprechen der Vorlage |

## 5. Selbst prüfen

```bash
source "$HOME/.cargo/env"
cargo fmt -p socdof-ui -p socdof-core -- --check
cargo clippy -p socdof-ui -p socdof-core --all-targets -- -D warnings
cargo test -p socdof-core
cargo test -p socdof-ui          # enthält den Telefon-Sweep über alle Bildschirme
```

Szenen einzeln rendern (Belege erzeugen):

```bash
cargo build -q -p socdof-ui --bin socdof-ui-preview
SOCDOF_PREVIEW_OUT=target/ui-audio ./target/debug/socdof-ui-preview settings-audio
```

Die Szene wird als `light-de-settings-audio.png` und `dark-de-settings-audio.png` geschrieben;
der Filter ist ein Substring der Szenen-ID.

## 6. Zahlen

- 14 Einstellungs-Sektionen, 20 Launcher-Module (vollständig, `table` ist neu)
- 2.607 i18n-Keys je Sprache (de/en/fr/es), `catalogue-keys.json` generiert
- `cargo test -p socdof-core --lib`: 420 Tests, 0 Fehler
- `cargo test -p socdof-ui --lib`: 455 Tests, 0 Fehler; `cargo test -p socdof-ui --test visual`: 2/2
- Telefon-Sweep: 1.312 bisherige Fälle + 9 Schnellkassen- und 6 Tabellen-Fälle je Breite/Theme (1.424 Fälle,
  360/390/412/432 px × Light/Dark) ohne Überlauf
- `cargo fmt --check` und `cargo clippy --all-targets -D warnings` sauber (2026-11-27)
- Belege: `docs/artifacts/gui-parity/rust-01`…`rust-47`
- Verbindliche Modulübersicht für alle KIs: [`feature-status.md`](feature-status.md)

## Tabellenkalkulation `table` (2026-11-27)

Portiert aus `SOCDOF - TS/src/components/sales/TableModule.tsx`. Die Vorlage ist eine
Tabellenkalkulation (kein Tischplan); Tisch-Lebenszyklus, Reservierung und Storno leben weiterhin in
`restaurant` und `ios_billing`.

- **Domäne** `crates/core/src/domain/spreadsheet.rs`: Raster 8–26 Spalten (A–Z) × 20–200 Zeilen,
  `CellStyle` (fett/kursiv/unterstrichen, Ausrichtung, Schrift-/Füllfarbe, Schriftfamilie), eigener
  Formelparser für `=`, A1-Referenzen, Bereiche und `SUMME`/`MITTELWERT`/`MAX`/`MIN`/`ANZAHL`,
  Zyklusschutz (Zyklus liest 0), `#FEHLER` wie die Vorlage, Zahlen mit Komma, CSV mit Semikolon,
  BOM beim Export, Kürzung auf Maximalgröße beim Import.
- **Store** `crates/core/src/store/spreadsheet.rs` + Schema **v22** (`table_documents`): Die Vorlage
  hält Tabellen nur im React-State; Rust speichert Name, Raster, Stile, Gitternetz-/Formelbalken-
  Schalter und Zeitstempel dauerhaft (Projektregel „keine Mock-Daten“).
- **UI** `crates/ui/src/table.rs`: Ribbon Datei/Start/Einfügen/Ansicht, Formelbalken, Spaltenköpfe
  A–Z, Statuszeile (aktive Zelle, gefüllte Zellen, Hinweis), Tastaturnavigation, CSV über Pfadfeld.
- **Verdrahtung**: `AppModule::Spreadsheet` (`"table"`, 20 Module), App-Store-Eintrag (startet wie in
  der Vorlage deaktiviert), Chrome-Tile, Desktop-Icon, natives Fenster, Settings-Label, Rollenmatrix,
  71 neue i18n-Keys in de/en/fr/es (Katalog 2.678).
- **Bewusste Abweichungen**: Persistenz (die Vorlage hat keine); Bereichsfunktion über einem Block,
  der in Zeile 1 beginnt, wird mit Hinweis abgelehnt statt eine selbstreferenzierende Formel zu
  schreiben; mehrzeilige CSV-Felder werden beim Import wie in der Vorlage zeilenweise getrennt.
- **Verifikation**: `cargo fmt --all -- --check`, clippy core+ui `-D warnings`, Core 434, UI 464,
  Visual 2, Backoffice 4, Telefon-Sweep 1.424 Fälle grün; Beleg
  `docs/artifacts/gui-parity/rust-48-spreadsheet-{light,dark}.png`.

## Kalender & Termine (2026-11-27)

Die Vorlage verteilt den Kalender auf `CalendarModule.tsx` (Ansichten, Filter, Formulare) und
`lib/googleCalendar.ts` (vereinigte Ereignisliste und `.ics`-Export). Portiert ist alles, was ohne
Google-Konto und ohne Netzwerk läuft.

- **Domäne** `crates/core/src/domain/appointment.rs`: `AppointmentCategory` (Rechnung, Kunde,
  Meeting, Frist, Privat, Allgemein), `Appointment::all_day`, `day_count`, iCalendar-Export mit
  `DTSTART;VALUE=DATE`/`DTEND;VALUE=DATE` und `CATEGORIES` für Ganztagstermine, `InvoiceEvent` +
  `invoice_events` für fällige, nicht stornierte Rechnungen (Bezahlt/Überfällig wird aus Status und
  Fälligkeit abgeleitet).
- **Store** `crates/core/src/store/appointments.rs` + Schema **v23**: `category` und `all_day` mit
  Defaults, Kategorie/Flag in Insert, Update und Mapping.
- **UI** `crates/ui/src/appointments.rs`: vierte Ansicht **Arbeitswoche** (Mo–Fr), mehrtägige und
  Ganztagstermine (eigene Leiste über den Spalten, „Ganztägig“ in Liste und Detail), Kategorie-
  Farbpunkte, Filterchips je Kategorie und „Nur Rechnungen“, Rechnungstermine als schreibgeschützte
  Einträge mit Rechnungsnummer und Status, Duplizieren (auch von Rechnungsterminen), Schnelldauern
  15 m/30 m/45 m/1 h/2 h/Ganztägig, Enddatum und Endzeit statt Dauer, Suche über Titel, Notizen und
  Rechnungsnummern. Der ICS-Export schreibt die gefilterte Liste inklusive Rechnungsterminen.
- **Verdrahtung**: keine neues Modul nötig (Kalender war bereits als 8. Modul verdrahtet);
  Vorschau-Szene `calendar-workweek`, Kalender-Fixtures mit Kategorien und einem Ganztagstermin,
  App-Demo-Seed ebenso. 23 neue i18n-Keys in de/en/fr/es (Katalog **2.701**).
- **Bewusste Abweichungen**: Google-Kalender-Sync (OAuth, Google-API, Push der Rechnungen) fehlt –
  der Rust-Kalender arbeitet ausschließlich auf der lokalen Datenbank; `window.print()` der Vorlage
  hat kein Desktop-Pendant, der `.ics`-Export deckt den Austausch ab; die mobilen Bottom-Sheets
  ersetzen die gestapelten Formulare der Telefonbreite. Wiederholungen und `.ics`-Import gibt es in
  der Vorlage nicht und daher auch nicht in Rust.
- **Verifikation**: `cargo fmt --all -- --check`, clippy core+ui `-D warnings`, Core **437**, UI
  **467**, Visual 2, Backoffice 4, Telefon-Sweep **1.432** Fälle grün. Der Sweep fand zwei echte
  Überläufe: ein zu breites Suchfeld in der Werkzeugleiste (jetzt eigene Zeile) und lange
  Rechnungstitel in der Agenda (jetzt mit Ellipse gekürzt); beide sind behoben.
- **Belege**: `docs/artifacts/gui-parity/rust-49-calendar-{light,dark}.png`,
  `rust-49-calendar-workweek-{light,dark}.png`, `rust-49-calendar-form-{light,dark}.png`.

**Offen:** Google-Sync, Drucken, mobile Sheets; Pixelvergleich (dieser Block prüft Funktion).
