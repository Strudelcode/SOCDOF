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
| Fensterverwaltung mit gespeicherter Geometrie je Benutzer, 18 Launcher-Einträge als eigene Fenster | Tests in `crates/ui/src/desktop.rs` |

- Command Palette: App-Suche und Treffer für Kontakte, Produkte und Rechnungen sind auf Apps
  beschränkt, die im aktuellen Desktop sichtbar sind; Ergebnislisten scrollen auf kleinen Fenstern.
  Die fünf TypeScript-Schnellaktionen öffnen jetzt die passenden Formulare bzw. das neue
  Lagerbuchungsfenster; Aktionen werden ebenfalls nach sichtbaren Apps gefiltert.

### Einstellungen (14 Sektionen)

Anzeige, Allgemein, Zahlungen & Bankverbindung, Briefkopf, Sprache, Personalisierung, **Sound &
Lautstärke**, Sicherheit, Sicherung, Benutzer, Rollen, Updates, Portable, Tastenkombinationen.

- **Sound & Lautstärke** (neu, 2026-11-27): Stummschalter, Master-Lautstärke mit Prozent-Pille,
  0 %/100 %-Enden, Schnellwahl 15/35/60/85/100 %, sofortiges Speichern, Telefon-Layout — `rust-41`.
- Anzeige-Skalierung (75–200 %) wird validiert, gespeichert und auf egui angewendet; Nachtlicht ist
  ein Fenster-Tint (keine OS-Farbtemperatur, siehe Abweichungen).
- Briefkopf: Logo, Betreff, Register-/Geschäftsführungsangaben, vier Fußzeilen-Spalten, Hintergrund,
  DIN-5008-Falzmarken — gespeichert, aber noch nicht in alle PDF/DOCX-Renderer verdrahtet (offen).
- Sprachpakete: TypeScript-kompatibler JSON-Import/Export, mehrere gespeicherte Pakete mit Auswahl
  und Löschen, ein persistentes aktives Overlay, Migration des alten Einzelpakets und native
  Dateidialoge.
- Systemsprache: optionale, persistente Synchronisierung aus `LC_ALL`/`LC_MESSAGES`/`LANG`;
  manuelle Sprachwahl deaktiviert sie, unbekannte Locales fallen auf Englisch zurück.

### Anmeldung und Konten

- Login mit Konto-Auswahl, Sperren/Entsperren (`Ctrl+L`), Wiederherstellung über zwei Antworten
  (Argon2id, case-insensitiv), erzwungener Passwortwechsel beim ersten Login, Ersteinrichtung des
  ersten Administrators, Benutzer-/Rollenverwaltung.
- Sitzungen werden beim Passwortwechsel invalidiert; pro Benutzer getrennte Einstellungen,
  Icon-Positionen, Fenstergeometrie und Desktop-Layout.

### Daten und Exporte (funktional, mit Tests)

SQLite-Schema v18, Backups/Archive, CSV (Kontakte, Flotte, Buchhaltung, Journal, Stock-Moves),
vCard, iCal, PDF/DOCX-Erzeugung, FatturaPA, Z-Bericht, Mahnwesen.

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
- [x] Kontotyp Privat/Geschäftlich ist je Benutzer auswählbar und wird persistent gespeichert;
      Wiederherstellungsantworten werden gehasht und dem richtigen Benutzerkonto zugeordnet
- [ ] Benutzer-Avatare
- [x] Eigene Sprachpakete importieren, exportieren, aktivieren und deaktivieren
- [x] Nativer SQLite-Speicherinspektor mit Datenbankgröße, Schema-Version und ausgewählten
      Tabellen-Zählständen
- [x] TypeScript-kompatibler JSON-Datenexport mit nativer Dateiauswahl
- [ ] Vollständiger Storage-Inspector (Assets, Benutzerprofile, Bereinigungsaktionen)
- [ ] Vollständiger System-Reset (destruktiver Reset aller Daten)
- [ ] Google-Calendar-/iCal-Verbindungen (nur lokaler iCal-Export vorhanden)

### Module

- [x] Therapie: neues Sitzungsdatum (ISO-UTC), Startzeit 10:00 und 60-Minuten-Dauer entsprechen
      den TypeScript-Defaults; leere Pflichtdaten werden abgewiesen
- [x] Therapie: verknüpfte Rechnungen lassen sich aus dem Klientendetail über den gemeinsamen
      PDF-/DOCX-Druckdialog öffnen
- [ ] Therapie: eigener Therapie-Rechnungsvorlagen-Manager und dessen HTML-/Word-Ausgabe
- [ ] Buchhaltung: exakte CSV/Excel-Bytes, Teilzahlungs-Sonderfälle, Abgleich der konfigurierten Zeitzone mit der Browser-Lokalzeit
- [ ] Kontakte: Byte-Ausgabe für Randfälle, weitere Header-Varianten, Fehlerfälle
- [x] Flotte: CSV-Dateinamen erhalten Firmenname und Leerzeichen wie TypeScript; plattform-illegale
      Zeichen werden im nativen Dateinamen sicher ersetzt
- [ ] Flotte: Formular-Sonderfälle und Rechnungsübergabe
- [ ] Restaurant: vollständige Abnahme des Bestell-/Küchenablaufs
- [x] Restaurant: Tages-Z-Bericht mit Belegzahl, Bar-/Kartensummen, Steuer und Bruttoumsatz
      einschließlich PDF-Ausgabe
- [x] POS: historischer Bon kann mit Positionen, Steuer, Zahlung, Wechselgeld und Kunde als PDF
      ausgegeben werden
- [x] Projekte: Such-/Status-/Kategorie-Filter, Aufgaben-Übergänge und Rechnungserstellung mit
      Jahresnummern für abrechenbare, erfasste Stunden
- [x] Portfolio-CSV ist eine native Erweiterung; die TypeScript-ProjectsModule bietet keinen CSV-Export
- [ ] App Store, Support, Reports, Editor/Textwerk: vollständige Workflow-Abnahme

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

- 14 Einstellungs-Sektionen, 18 Launcher-Module
- 2.413 i18n-Keys je Sprache (de/en/fr/es), `catalogue-keys.json` generiert
- `cargo test -p socdof-core`: 406 Lib-Tests + Integrationstests, 0 Fehler
- `cargo test -p socdof-ui`: 442 Lib-Tests + Integrationstests, 0 Fehler
- Telefon-Sweep: 1.312 Fälle (360/390/412/432 px × Light/Dark) ohne Überlauf
- `cargo fmt --check` und `cargo clippy --all-targets -D warnings` sauber (2026-11-27)
- Belege: `docs/artifacts/gui-parity/rust-01`…`rust-41`
