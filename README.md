# SOCDOF (Strudel's Organization, Commerce & Documentation Offline Flow)

[![GitHub](https://img.shields.io/badge/GitHub-Strudelcode%2FSOCDOF-blue?logo=github)](https://github.com/Strudelcode/SOCDOF)
[![Discord](https://img.shields.io/badge/Support-Discord%20Server-5865F2?logo=discord)](https://discord.gg/QW85EaXTgB)
[![Offline First](https://img.shields.io/badge/Datenschutz-100%25%20Lokal%20%26%20Offline-emerald)](#)
[![Version](https://img.shields.io/badge/Version-SOCDOF%20v18.3.4-indigo)](#)

> **SOCDOF** ist eine modulare, 100% offline-fähige ERP- und Unternehmenssoftware mit moderner **Windows 11 Desktop-Fensterverwaltung**, Buchhaltung, DIN 5008 Fakturierung, Restaurant-/POS-Kasse, mehrsprachiger Lokalisierung und robuster lokaler Datenhaltung (IndexedDB).

---

## 📌 Wichtige Links & Community

- 🐙 **Offizielles GitHub Repository (Open Source):** [https://github.com/Strudelcode/SOCDOF](https://github.com/Strudelcode/SOCDOF)
- 💬 **Hilfe & Support (Ausschließlich auf Discord):** [https://discord.gg/QW85EaXTgB](https://discord.gg/QW85EaXTgB)

---

## 🚀 Kernfunktionen

- 🪟 **Reine Windows 11 Desktop-Umgebung:** Echte verschiebbare, maximierbare und minimierbare Fenster, Taskleiste mit Live-Status, Aero-Snap-Andocken, Startmenü und paralleler Mehrfensterbetrieb.
- 📦 **Windows Setup- & Installations-Assistent:** Direkte Auswahl des Ziel-Installationspfades (z. B. `C:\SOCDOF` oder eigenes Laufwerk) mit automatischer Erstellung der Ordnerstruktur (`\Data`, `\Backups`, `\Exports`, `\Config`) und Desktop-Verknüpfung.
- 📄 **DIN 5008 Fakturierung:** Rechnungen, Angebote und Lieferscheine mit rechtssicherem Briefkopf, Faltmarken, Logo-Wasserzeichen und QR-Zahlcodes (GiroCode / EPC-QR).
- 👥 **Kunden- & Kontaktverwaltung:** CRM-Adressbuch, Zahlungsbedingungen, Notizen und lückenlose Umsatzhistorie.
- 📦 **Warenwirtschaft & Lager:** Artikelverwaltung, Bestandsüberwachung, Mindestbestände und doppische Lagerbuchungen.
- 🍽️ **Restaurant- & POS-Kassenmodul:** Grafischer Tischplan mit Live-Status, Rechnungs-Split, Rabatte, Tagesabschlüsse (Z-Bon) und Küchen-Display (KDS).
- 🌐 **Mehrsprachigkeit (i18n):** Volle Unterstützung für Englisch (Standard), Deutsch, Französisch und Spanisch mit Vektor-Flaggen und reaktiver Sprachumschaltung.
- 📅 **Kalender & Schnittstellen:** Export von Fälligkeitsterminen als `.ics` oder Live-Feed (Google Kalender, iCal, Outlook) — wird erst nach expliziter Verknüpfung aktiv geschaltet.
- 🔒 **100% Datenschutz & Offline First:** Keine fremde Cloud. Alle Daten verbleiben sicher in der lokalen Browserdatenbank (IndexedDB) mit 1-Klick JSON-Backup und Demo-Reset.

---

## 📁 Windows Dateisystem & Ordnerstruktur

Nach Ausführung des Installations-Assistenten (`Setup_SOCDOF_Windows.cmd` oder `Install_SOCDOF_Wizard.ps1`) wird folgende Ordnerhierarchie auf Ihrem PC angelegt:

```text
📁 C:\SOCDOF\                   (Installationshauptverzeichnis)
├── 📁 Data\                   (Lokale Datenbank & Kontakt-/Belegdaten)
├── 📁 Backups\                (Automatische & manuelle JSON-Sicherungsdateien)
├── 📁 Exports\                (DIN 5008 PDF-Rechnungen, BWA & Berichte)
├── 📁 Config\                 (Firmeneinstellungen & Briefpapier)
├── 🚀 SOCDOF_Starten.bat      (Lokaler Desktop-Starter)
└── 🖥️ SOCDOF Desktop.lnk      (Verknüpfung auf Ihrem Windows-Desktop)
```

---

## 📝 Update-Log / Versionshistorie

### v18.3.4 (2026-08-24)
- 💻 **Echter Windows Desktop Setup-Assistent (`Setup_SOCDOF_Windows.cmd` & `Install_SOCDOF_Wizard.ps1`):**
  - Interaktive Auswahl des Zielinstallationspfads auf dem PC (z. B. `C:\SOCDOF`, `D:\SOCDOF`, `%USERPROFILE%\SOCDOF`).
  - Automatische Erstellung der vollständigen Verzeichnisstruktur (`\Data`, `\Backups`, `\Exports`, `\Config`).
  - Automatische Erstellung einer Desktop-Verknüpfung (`SOCDOF Desktop.lnk`) und Startskript.
  - Vollständige Behebung von Google 403 Forbidden Fehlern: App läuft 100% lokal ohne Abhängigkeit zu Sandbox-Cloud-URLs.
- ⚙️ **Windows-Pfadverwaltung in den Einstellungen:** Unter *Speicher & Datensicherung* kann der Speicherort für Backups und lokale Daten direkt hinterlegt und angepasst werden.
- 🐙 **GitHub Releases Verlinkung:** Direkter Absprung zu vorkompilierten Electron / NSIS `.exe` Binärpaketen.

### v18.3.3 (2026-08-24)
- 🪟 **Fokus auf Windows OS Desktop-Modus:** Der überflüssige Web-Vollbildmodus sowie die oberen Umschalt-Banner wurden komplett entfernt. Die Anwendung startet und agiert nun ausschließlich als nativer Multi-Window-Desktop.
- 🌐 **Optimierter Sprachauswahl-Dialog:** 
  - Einheitliches, übersichtliches Auswahlmenü mit hohem Kontrast im Light- und Dark-Mode.
  - Entfernung von doppelten Dropdown-Verschachtelungen und redundanten Schnellwahl-Leisten.
  - Vektor-SVG-Flaggen für pixelgenaue Darstellung auf allen Betriebssystemen.
  - Standard-Vorauswahl: **English (`en`)** mit deutlichem *"Default"* und *"Skip (Default: English)"*-Hinweis.
- ⚙️ **Zentralisierte Versionsverwaltung:** Systemstatus-Widget in den Einstellungen und im Handbuch liest die Version dynamisch aus `src/lib/version.ts`.
- 📖 **Handbuch erweitert:** Neues Kapitel *Versionshistorie & Updates* direkt im Dokumentationsmodul integriert.

### v18.3.2 (2026-08-24)
- 🔄 **Kalender-Status korrigiert:** Der Status-Badge unter *Einstellungen > Verbindungen* zeigt standardmäßig **"Nicht verbunden (Inaktiv)"** und schaltet erst bei tatsächlicher Verknüpfung/Feed-Kopieren auf **"Verbunden / Aktiv"**.
- 🐙 **Open Source GitHub Integration:** Verlinkung des offiziellen Repositories `https://github.com/Strudelcode/SOCDOF` in Startmenü, Handbuch und Einstellungsübersicht.
- 💬 **Discord Support Integration:** Klarer Hinweis und Direktlinks für Support ausschließlich über den offiziellen Discord-Server `https://discord.gg/QW85EaXTgB`.
- 🎨 **SOCDOF Branding & Logo:** Einbindung des offiziellen SOCDOF-Logos (weißes S mit Windows-Farbrahmen) als Favicon, PWA-Icon, Taskleisten-Startbutton und Dashboard-Header.
- 🏢 **Firmenprofil-Standard:** Standard-Firmenname auf *Strudel's Test GmbH* aktualisiert.

### v18.3.1 (2026-08-24)
- 🚀 **Windows Launcher:** Automatische Generierung von `.bat` und `.ps1` Starterskripten für den nativen Windows Desktop-Betrieb.
- 🔊 **Sound-Feedback:** Akustisches Feedback für Klicks, Popups und Fehler (mit Stummschalt-Funktion).
- 🌓 **Windows Dark / Light Mode:** Nahtloser Wechsel zwischen Dark Mode und DIN-konformem Light Mode.

### v18.3.0 (2026-08-20)
- 🖥️ **Windows 11 Desktop Core:** Multi-Window-Manager mit Taskleiste, Startmenü und Fenster-Snapping.
- 💶 **Finanz- & Fakturamodule:** Vollständige BWA, EÜR, UStVA Voranmeldung und DIN 5008 Rechnungsgenerator.
- 💾 **IndexedDB Engine:** 100% Offline-Datenhaltung über Dexie.js mit JSON-Import/Export.

---

## 💻 Lokale Installation & Entwicklung

```bash
# Repository klonen
git clone https://github.com/Strudelcode/SOCDOF.git
cd SOCDOF

# Abhängigkeiten installieren
npm install

# Entwicklungsserver starten (Port 3000)
npm run dev
```

---

*SOCDOF — Strudel's Organization, Commerce & Documentation Offline Flow*
