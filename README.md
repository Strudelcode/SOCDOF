# SOCDOF

**Strudel's Organization, Commerce & Documentation Offline Flow** ist eine modulare ERP- und Unternehmenssoftware für Windows und den Browser. SOCDOF kombiniert eine Windows-11-ähnliche Desktop-Oberfläche, Buchhaltung, Fakturierung, Warenwirtschaft, POS-Funktionen, Mehrsprachigkeit und lokale Datenspeicherung.

> Die Anwendung ist offline-first. Daten werden lokal in IndexedDB gespeichert. Funktionen mit externen Diensten werden nur nach ausdrücklicher Verbindung aktiviert.

[![GitHub](https://img.shields.io/badge/GitHub-Strudelcode%2FSOCDOF-blue?logo=github)](https://github.com/Strudelcode/SOCDOF)
[![Discord](https://img.shields.io/badge/Support-Discord-5865F2?logo=discord)](https://discord.gg/QW85EaXTgB)
[![Offline First](https://img.shields.io/badge/Offline--first-Local%20data-emerald)](#datenschutz-und-datenhaltung)

## Links

- **Repository:** <https://github.com/Strudelcode/SOCDOF>
- **Live-Demo:** <https://strudelcode.github.io/SOCDOF/>
- **Support:** <https://discord.gg/QW85EaXTgB>
- **Versionshistorie:** [`versions/`](./versions/)
- **Arbeitsaufgaben:** [`todo/todo.md`](./todo/todo.md)

## Funktionen

- Windows-11-Desktop mit verschiebbaren, minimierbaren, maximierbaren und andockbaren Fenstern
- Startmenü, Taskleiste, System-Tray und paralleler Mehrfensterbetrieb
- DIN-5008-Rechnungen, Angebote, Lieferscheine und QR-Zahlcodes
- Kunden-, Lieferanten- und Kontaktverwaltung
- Artikelverwaltung, Lagerbestände und Lagerbewegungen
- Einkauf, Bestellungen und Lieferantenrechnungen
- POS-, Restaurant-, Tischplan- und Küchenanzeige-Funktionen
- Dashboard mit Kennzahlen sowie Finanz- und Buchhaltungsauswertungen
- Mehrsprachigkeit mit Englisch, Deutsch, Französisch und Spanisch
- Lokale Backups sowie JSON-Import und -Export
- Kalender- und Feed-Funktionen, die erst nach bewusster Verknüpfung aktiv werden

## Windows-Installation

Der Setup-Assistent kann über `Setup_SOCDOF_Windows.cmd`, `Setup_SOCDOF_Windows.bat` oder `Install_SOCDOF_Wizard.ps1` gestartet werden. Der Zielordner wird über einen nativen Windows-Dialog ausgewählt.

Dabei können folgende Elemente angelegt werden:

```text
[Gewählter Ordner, z. B. C:\SOCDOF]
├── Data\                   Lokale Daten und Belegdaten
├── Backups\                Manuelle und automatische Sicherungen
├── Exports\                Rechnungen, Berichte und andere Exporte
├── Config\                 Firmen- und Anwendungseinstellungen
├── SOCDOF_Starten.bat      Lokaler Starter
└── SOCDOF Desktop.lnk      Desktop-Verknüpfung
```

## Datenschutz und Datenhaltung

- Daten werden standardmäßig lokal über IndexedDB mit Dexie.js gespeichert.
- Es ist kein eigener Remote-Backend-Dienst für den Grundbetrieb erforderlich.
- Backups können lokal als JSON exportiert und wieder importiert werden.
- Externe Kalender oder andere Integrationen benötigen eine separate Verbindung und sollten vor der Aktivierung hinsichtlich Datenschutz und Berechtigungen geprüft werden.

## Entwicklung

Voraussetzungen: Node.js und npm.

```bash
# Repository klonen
git clone https://github.com/Strudelcode/SOCDOF.git
cd SOCDOF

# Abhängigkeiten installieren
npm install

# Entwicklungsserver starten
npm run dev

# Typprüfung ausführen
npm run lint

# Produktions-Build erstellen
npm run build
```

Der Entwicklungsserver verwendet standardmäßig Port `3000`.

## Windows-EXE erstellen

Der Windows-Build wird über Electron Builder erzeugt:

```bash
npm run build:exe
```

Für GitHub-Releases steht zusätzlich der Workflow `.github/workflows/build-windows-exe.yml` zur Verfügung. Release-Tags und die Veröffentlichung von Build-Artefakten erst nach erfolgreicher Prüfung und bewusster Freigabe verwenden.

## Versionierung

- Innerhalb einer Hauptversion dürfen Feature- und Fix-Versionen selbstständig erhöht werden, zum Beispiel `v19.3.1`.
- Eine neue Hauptversion wie `v20` darf nur nach vorheriger Rückfrage und bewusster Entscheidung begonnen werden.
- Die vollständige Versionshistorie befindet sich in [`versions/`](./versions/).
- Vor einem Release müssen `package.json`, zentrale Versionsquelle, README und Versionsdatei dieselbe Version ausweisen.

## Projektstruktur

| Pfad | Zweck |
|---|---|
| `src/` | React-Anwendung und UI-Module |
| `src/lib/db.ts` | Dexie-/IndexedDB-Datenbank |
| `src/lib/i18n.ts` | Übersetzungen und Sprachumschaltung |
| `src/lib/version.ts` | Zentrale Versionsdaten |
| `electron/` | Electron-Hauptprozess |
| `public/` | Statische Assets und Manifest |
| `versions/` | Release- und Versionshistorie |
| `todo/todo.md` | Geplante Aufgaben und Arbeitsregeln |
| `.github/workflows/` | Automatisierte Builds und Deployments |

---

*SOCDOF – Strudel's Organization, Commerce & Documentation Offline Flow*
