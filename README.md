# SOCDOF

> **Strudel's Organization, Commerce & Documentation Offline Flow**  
> *Eine offline-first Windows-ERP-Desktopsuite und Produktivitäts-Arbeitsplatz für Betriebe, Praxen, Freelancer und Handel.*

[![GitHub Release](https://img.shields.io/github/v/release/Strudelcode/SOCDOF?color=blue&logo=github)](https://github.com/Strudelcode/SOCDOF/releases)
[![Discord](https://img.shields.io/badge/Community-Discord-5865F2?logo=discord)](https://discord.gg/QW85EaXTgB)
[![Offline First](https://img.shields.io/badge/Data%20Storage-100%25%20Offline%20First-emerald)](#-privacy--offline-first-architektur)
[![License](https://img.shields.io/badge/License-MIT%20%2F%20Free-green)](#)
[![Languages](https://img.shields.io/badge/Languages-EN%20%7C%20DE%20%7C%20FR%20%7C%20ES-indigo)](#-vier-sprachen-von-anfang-an)



> **Two implementations live in this repository.** The TypeScript/React/Electron
> application is preserved in [`SOCDOF - TS`](SOCDOF%20-%20TS) (25.2.x line); the
> native Rust/Tauri rebuild is in [`crates/`](crates) (26.0.0, migration in
> progress). The Rust plan, gates and parity evidence are in
> [`RUST_MIGRATION.md`](RUST_MIGRATION.md); the measured screenshots are in
> [`docs/parity/`](docs/parity).

## Repository layout

```text
SOCDOF/
├── Cargo.toml               # Rust workspace (core, app, ui, web, cli)
├── crates/                  # native Rust/Tauri rebuild (v26.0.0)
├── docs/parity/             # ten TypeScript/Rust screenshot pairs + scores
├── scripts/                 # Rust build, budget and release tooling
├── RUST_MIGRATION.md        # migration plan, checklist, parity evidence
├── SOCDOF - TS/             # complete TypeScript/React/Electron application
└── CHANGELOG.md             # Rust changelog (TypeScript log in SOCDOF - TS/)
```

---

## 🌟 Überblick

**SOCDOF** bringt die Leistungsfähigkeit eines ERP-Systems in eine vertraute, **Windows-11-inspirierte Desktop-Oberfläche**.

Ob Kundenverwaltung, Rechnungen, Lagerbestand, ein Restaurant-Kassensystem mit Tischplan, Therapie-Dokumentation oder das Fahrtenbuch: SOCDOF deckt diese Aufgaben ab, **zu 100 % offline**, ohne Pflicht-Cloud-Konto und ohne Abo.

Alle Daten liegen lokal auf deinem Rechner in einer IndexedDB-Datenbank (Dexie.js). Dazu kommen schnelle Suche, Kundenakten und Ein-Klick-Backups als JSON.

---

## 🚀 Funktionen & Module

### 🪟 Windows-Desktop-Erlebnis
- **Mehrfenster-Arbeitsfläche**: Fenster öffnen, verschieben, skalieren, andocken, minimieren und maximieren.
- **Startmenü & Taskleiste**: Angeheftete Apps, Suche, Systemstatus und Benutzerwechsel.
- **Mehrere Monitore**: Arbeitsbereiche auf mehrere Bildschirme erweitern und Fenster abtrennen.
- **Nachtmodus**: Warme Farbtemperatur (1500 K – 5500 K) gegen Augenbelastung.
- **Personalisierung**: Hintergrundbilder, Mica-Effekt, Akzentfarben und eigene Profilbilder.
- **Systemmodus beim Start**: Hell, dunkel oder dem System folgend. Die Ersteinrichtung folgt direkt dem System.

### 👥 Kontakte & CRM (Kundenbuch)
- **Zentrales Adressbuch** für Kunden, Lieferanten, Partner und Interessenten.
- **Kundenauswahl überall**: Live-Suche und Neuanlage direkt aus jedem Modul.
- **360°-Kundenakte**: Rechnungen, Angebote, Therapieprotokolle und Zahlungen pro Kontakt.

### 🧾 Rechnungen & Abrechnung
- **DIN-5008-Layouts** für Rechnungen, Angebote, Lieferscheine und Gutschriften.
- **EPC-QR-Code** (GiroCode) für Überweisungen per Smartphone.
- **Steuern**: Regelsteuersatz, ermäßigter Satz, Kleinunternehmerregelung (§ 19 UStG) und Steuerbefreiung für Therapie (§ 4 Nr. 14 UStG).
- **Zahlungsverfolgung**: Offene, bezahlte und überfällige Posten mit Zahlungserinnerungen.

### 🏥 Therapie- & Praxisverwaltung (TheraPsy Suite)
- **Klienten direkt aus dem Kundenbuch** auswählen, ohne doppelte Eingabe.
- **Sitzungsdokumentation** mit Verlaufsnotizen, Methoden und Dauer-Vorlagen (30, 50, 60, 90 Minuten).
- **Abrechnung** mit Praxis-Briefkopf und Synchronisation in die Hauptbuchhaltung.
- **Fahrtenbuch**: Start- und Endkilometer, automatische Strecke und EStG-Erstattung (0,30 €, 0,38 €, 0,42 €/km).
- **Auswertung**: Umsatz- und Sitzungsdiagramme mit KPI-Karten.

### 📦 Lager, Produkte & Warenbewegungen
- **Bestandsführung** mit Artikelnummern, Barcodes, Einkaufs- und Verkaufspreisen sowie Mindestbeständen.
- **Bewegungsprotokoll** für Umlagerungen, Lieferungen, Verluste und Wareneingänge.
- **Warnungen** bei Unterschreitung des Mindestbestands.

### 🍽️ Kasse (POS) & Gastronomie
- **Tischplan-Editor** mit Drag-and-Drop für Tische, Plätze und Räume.
- **Bestellungen** am Tisch oder zum Mitnehmen mit Varianten und Notizen.
- **Küchen- und Barbildschirm** mit Bestellstatus.
- **Rechnung teilen** nach Person oder Artikel, Bar- oder Kartenzahlung.

### 📊 Buchhaltung & Auswertung
- **Auswertungen**: Umsatz, Ausgaben und Margen.
- **Steuerberichte**: BWA, EÜR, UStVA und tägliche Kassenberichte (Z-Bon).

### 🌐 Vier Sprachen von Anfang an
Alle Oberflächentexte gibt es in **Deutsch, Englisch, Französisch und Spanisch**. Die Sprache wird bei der ersten Einrichtung gewählt.

---

## 🛡️ Stabilität & Betrieb

- **Sitzungsprotokolle**: Die Desktop-Version schreibt Sitzungslogs, auch bei Abstürzen. Die letzten 20 Sitzungen bleiben erhalten.
- **Startbildschirm**: Ein Splash-Screen erscheint bei jedem Start.
- **Selbst-Update der portablen Version**: Die portable EXE kann sich selbst aktualisieren. Auf anderen Arbeitsplätzen erscheint ein Hinweis zum Update.

---

## 🔒 Datenschutz & Offline-First

Deine Geschäftsdaten gehören dir.

- **Keine Cloud-Pflicht**: Läuft vollständig lokal auf dem Desktop oder im Browser. Keine Konten und keine Telemetrie.
- **IndexedDB & Dexie.js**: Transaktionale Speicherung im Browser, geeignet für zehntausende Datensätze.
- **Lokale JSON-Backups**: Gesamte Datenbank als Datei exportieren und auf jedem Rechner wiederherstellen.
- **Sicheres Zurücksetzen**: Mehrstufiger Assistent, um den lokalen Stand beim Gerätewechsel zu löschen.

---

## 📥 Installation & Downloads

Fertige Windows-Versionen gibt es auf den [GitHub Releases](https://github.com/Strudelcode/SOCDOF/releases):

1. **Setup-Installer (`SOCDOF Setup ... .exe`)**: Installation mit Desktop-Verknüpfung, Startmenü und Auto-Updater.
2. **Portable Version (`SOCDOF ... .exe`)**: Eine einzelne EXE ohne Installation, mit Selbst-Update.
3. **Web-App**: Im Browser ausführen oder als statische Progressive Web App (PWA) bereitstellen.

---

## 🛠️ TypeScript-Entwicklung (`SOCDOF - TS`)

### Voraussetzungen
- **Node.js** (v18 oder neuer)
- **npm** (v9 oder neuer)

### Schnellstart
```bash
# 1. Repository klonen
git clone https://github.com/Strudelcode/SOCDOF.git
cd SOCDOF
cd "SOCDOF - TS"

# 2. Abhängigkeiten installieren
npm install

# 3. Entwicklungsserver starten (Port 3000)
npm run dev

# 4. TypeScript- und Syntaxprüfung
npm run lint

# 5. Produktionsbuild (Web-Bundle)
npm run build
```

### Windows-Electron-App bauen
```bash
# NSIS-Installer und portable EXE erstellen
npm run build:exe
```

---

## 📂 TypeScript-Projektstruktur

```text
SOCDOF - TS/
├── electron/              # Electron-Hauptprozess, IPC-Handler, Fensterverwaltung, Splash & Sitzungslogs
├── src/
│   ├── components/        # UI-Module (Rechnungen, Kasse, Lager, Therapie, Einstellungen usw.)
│   │   └── therapy/       # Therapie-Untermodule (Dashboard, Abrechnung, Fahrtenbuch, Klienten)
│   ├── lib/               # Datenbank (Dexie.js), Übersetzungen (i18n), Sound, Displays, Versionierung
│   ├── types/             # TypeScript-Typen für alle Geschäftsobjekte
│   ├── App.tsx            # Hauptsteuerung der Arbeitsfläche
│   └── main.tsx           # React-Einstiegspunkt
├── todo/                  # Offene Aufgaben (todo.md) und Archiv (completed_todo.md)
├── versions/              # Detaillierte Versionshinweise je Versionsreihe
└── package.json           # App-Metadaten, Abhängigkeiten und Build-Skripte
```

---

## 🦀 Rust rewrite (`crates/`, v26.0.0)

The native rebuild talks to one SQLite core through Tauri commands. It ships the
Tauri webview in `crates/app/ui`, keeps a pure-Rust egui surface in `crates/ui`
and a WebAssembly host in `crates/web`, and has no second database layer.

### Build and gates

Requirements: stable Rust (pinned in `rust-toolchain.toml`) and a C toolchain for
the bundled SQLite.

```bash
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
cargo run -p socdof-cli -- ./socdof.db
```

The native launcher now includes the Restaurant module alongside the existing business apps; its menu, table orders, kitchen flow and checkout use the shared SQLite store.

The first native Rust desktop host is available separately from the Tauri transition build:

```bash
cargo run -p socdof-ui --features window --bin socdof-ui-desktop
```

It opens the persistent SQLite database under the operating-system application-data folder
(Windows: `%APPDATA%\com.strudelcode.socdof\socdof.db`, matching the existing Tauri data folder). Use `--database <path>` to select another file.
Unlike the component gallery, the desktop host does not seed example customers, invoices or
demo accounts; it starts with first-run setup or the existing local login.

Desktop prerequisites (Ubuntu/Debian):

```bash
sudo apt-get update
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev \
  librsvg2-dev libxdo-dev libssl-dev patchelf
```

```bash
cd crates/app
npm ci
npm run build
npm run tauri build
```

### Visual parity

`docs/parity/` holds the ten 1440×900 pairs (Dashboard, Invoices, Contacts,
Settings and Command Palette, light and dark) captured from the TypeScript app
and the Rust webview. `python3 docs/parity/parity_diff.py` recomputes the window
pixel score and SSIM and writes `diff.csv` / `diff.json`. The remaining gaps are
documented in `RUST_MIGRATION.md` §15.7; the dense Settings text and the dark
Spotlight panel are still below the SSIM target because of WebKitGTK/Chromium
text rasterization and the backdrop, not a different layout.

### CI

The workflows in `.github/workflows/` are **manual only** while the rewrite is
merged: `rust.yml` (format, clippy, tests, desktop bundles, GUI smoke) and
`release.yml` (signed release) plus the Discord announcement only run through
**Run workflow**. Pushing to `main` triggers no build, release or Discord post.

---

## 🤝 Community & Support

- **Discord**: Diskussionen, Funktionswünsche und Hilfe auf dem [Discord-Server](https://discord.gg/QW85EaXTgB).
- **Fehlerberichte**: Über die [GitHub Issues](https://github.com/Strudelcode/SOCDOF/issues).
- **Changelog**: [CHANGELOG.md](./CHANGELOG.md) für den Rust-Zweig, [`SOCDOF - TS/CHANGELOG.md`](SOCDOF%20-%20TS/CHANGELOG.md) für die TypeScript-App.

---

*Entwickelt von Strudel / Yuri in Südtirol, Italien.*

*Dieses Projekt wird mithilfe von KI programmiert.*
