# SOCDOF

**SOCDOF** ist eine lokale Windows-Desktop-Anwendung für die Organisation von Unternehmensdaten, Kontakten, Artikeln, Lagerbewegungen, Einkäufen, Verkäufen, Rechnungen und POS-Vorgängen. Die Anwendung bündelt diese Bereiche in einer Windows-11-inspirierten Arbeitsumgebung mit verschiebbaren Fenstern, Startmenü und Taskleiste.

SOCDOF läuft als Electron-Anwendung mit React und Vite. Die Daten werden standardmäßig lokal im Browser-Speicher (IndexedDB über Dexie.js) verwaltet. Ein zentraler Online-Server ist für den normalen Betrieb nicht erforderlich. Zusätzlich kann die Anwendung als Web-Build beziehungsweise über GitHub Pages ausgeführt werden.

[![GitHub](https://img.shields.io/badge/GitHub-Strudelcode%2FSOCDOF-blue?logo=github)](https://github.com/Strudelcode/SOCDOF)
[![Discord](https://img.shields.io/badge/Support-Discord-5865F2?logo=discord)](https://discord.gg/QW85EaXTgB)
[![Offline First](https://img.shields.io/badge/Offline--first-Local%20data-emerald)](#datenschutz-und-datenhaltung)

## Links

- **Repository:** <https://github.com/Strudelcode/SOCDOF>
- **Live-Demo:** <https://strudelcode.github.io/SOCDOF/>
- **Support:** <https://discord.gg/QW85EaXTgB>
- **Versionshistorie:** [`versions/`](./versions/)
- **Arbeitsaufgaben:** [`todo/todo.md`](./todo/todo.md)

## Was SOCDOF aktuell bietet

- Windows-Desktop-Arbeitsbereich mit mehreren verschiebbaren, skalierbaren und minimierbaren Fenstern
- Startmenü, Taskleiste, System-Tray und Fenster-Andocken
- Dashboard und Übersichten für betriebliche Kennzahlen
- Kontaktverwaltung für Kunden und Lieferanten
- Artikelverwaltung und Bestandsgrenzen
- Lagerbewegungen und Bestandsverwaltung
- Einkäufe, Bestellungen und Lieferantenrechnungen
- Rechnungen, Angebote und Lieferscheine mit DIN-5008-orientiertem Layout
- QR-Zahlcodes für geeignete Rechnungsdaten
- POS- und Restaurantfunktionen mit Tischplan, Bestellverwaltung und Küchenanzeige
- Finanz- und Buchhaltungsauswertungen wie BWA, EÜR, UStVA und Z-Berichte
- Mehrsprachige Benutzeroberfläche mit Englisch, Deutsch, Französisch und Spanisch
- Dark Mode, Light Mode, Akzentfarben und Sound-Einstellungen
- Lokale JSON-Backups sowie Import und Export
- Optionale Kalender-/Feed-Funktionen, die erst nach einer bewussten Verbindung aktiviert werden
- Integrierte Dokumentation und Hilfe

## Datenschutz und Datenhaltung

- Die Anwendungsdaten werden standardmäßig lokal über IndexedDB mit Dexie.js gespeichert.
- Für die grundlegenden ERP-Funktionen ist kein eigener Remote-Backend-Dienst erforderlich.
- Backups können lokal als JSON exportiert und wieder importiert werden.
- Externe Dienste wie Kalenderintegrationen sind nicht Bestandteil des zwingenden Offline-Kernbetriebs und benötigen eine separate Aktivierung.

## Installation über GitHub Releases

Für normale Benutzer ist keine Installation aus dem Quellcode notwendig. Die fertigen Windows-Versionen werden im Bereich **Releases** des GitHub-Repositories veröffentlicht:

<https://github.com/Strudelcode/SOCDOF/releases>

Dort können – sofern für die jeweilige Version veröffentlicht – folgende Dateien verfügbar sein:

- **Setup-Installer (`SOCDOF Setup … .exe`):** normale Windows-Installation mit auswählbarem Installationsordner sowie Startmenü- und Desktop-Verknüpfung.
- **Portable-Version (`SOCDOF … .exe`):** direkt startbare Version ohne klassische Installation.

Die passende Datei herunterladen, unter Windows ausführen und den Anweisungen des Installers folgen. Nur Releases aus dem offiziellen Repository verwenden.

## Lokale Entwicklung

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

## Windows-Build für Maintainer

Maintainer können den Electron-Build lokal erstellen:

```bash
npm run build:exe
```

Der Build erzeugt einen NSIS-Installer und eine portable Windows-Version. Zusätzlich kann der GitHub-Actions-Workflow `.github/workflows/build-windows-exe.yml` für veröffentlichte Releases verwendet werden. Release-Tags und die Veröffentlichung von Build-Artefakten erst nach erfolgreicher Prüfung und bewusster Freigabe verwenden.

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

*SOCDOF – lokale Unternehmensorganisation in einer Windows-Desktop-Arbeitsumgebung*
