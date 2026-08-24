# SOCDOF (Strudel's Organization, Commerce & Documentation Offline Flow)

[![GitHub](https://img.shields.io/badge/GitHub-Strudelcode%2FSOCDOF-blue?logo=github)](https://github.com/Strudelcode/SOCDOF)
[![Discord](https://img.shields.io/badge/Support-Discord%20Server-5865F2?logo=discord)](https://discord.gg/QW85EaXTgB)
[![Offline First](https://img.shields.io/badge/Datenschutz-100%25%20Lokal%20%26%20Offline-emerald)](#)

> **SOCDOF** ist eine modulare, 100% offline-fähige ERP- und Unternehmenssoftware mit moderner **Windows 11 Desktop-Fensterverwaltung**, Buchhaltung, DIN 5008 Fakturierung, Restaurant-/POS-Kasse und robuster lokaler Datenhaltung (IndexedDB).

---

## 📌 Wichtige Links & Community

- 🐙 **Offizielles GitHub Repository (Open Source):** [https://github.com/Strudelcode/SOCDOF](https://github.com/Strudelcode/SOCDOF)
- 💬 **Hilfe & Support (Ausschließlich auf Discord):** [https://discord.gg/QW85EaXTgB](https://discord.gg/QW85EaXTgB)

---

## 🚀 Kernfunktionen

- 🪟 **Windows 11 Desktop-Umgebung:** Echte verschiebbare, maximierbare und minimierbare Fenster, Taskleiste mit Live-Status, Startmenü und Mehrfensterbetrieb.
- 📄 **DIN 5008 Fakturierung:** Rechnungen, Angebote und Lieferscheine mit rechtssicherem Briefkopf, Faltmarken, Logo-Wasserzeichen und QR-Zahlcodes (GiroCode).
- 👥 **Kunden- & Kontaktverwaltung:** Adressbuch, Zahlungsbedingungen, Notizen und Kundenhistorie.
- 📦 **Warenwirtschaft & Lager:** Artikelverwaltung, Bestandsüberwachung, Mindestbestände und Lagerbewegungen.
- 🍽️ **Restaurant- & POS-Kassenmodul:** Tischplan mit Live-Status, grafischer Rechnungs-Split, Rabatte, Tagesabschlüsse (Z-Bon).
- 📅 **Kalender & Schnittstellen:** Export von Fälligkeitsterminen als `.ics` oder Live-Feed (Google Kalender, iCal, Outlook) — wird erst aktiv nach Verknüpfung.
- 🔒 **100% Datenschutz & Offline First:** Keine fremde Cloud. Alle Daten verbleiben in der lokalen Browserdatenbank (IndexedDB) mit 1-Klick JSON-Backup.

---

## 📝 Update-Log / Versionshistorie

### v18.3.2 (2026-08-24)
- 🔄 **Kalender-Status korrigiert:** Der Status-Badge unter *Einstellungen > Verbindungen* zeigt nun standardmäßig **"Nicht verbunden (Inaktiv)"** und schaltet erst bei tatsächlicher Verknüpfung/Feed-Kopieren auf **"Verbunden / Aktiv"**.
- 🐙 **Open Source GitHub Integration:** Verlinkung des offiziellen Repositories `https://github.com/Strudelcode/SOCDOF` in Startmenü, Handbuch und Einstellungsübersicht.
- 💬 **Discord Support Integration:** Klarer Hinweis und Direktlinks für Support ausschließlich über den offiziellen Discord-Server `https://discord.gg/QW85EaXTgB`.
- 🎨 **SOCDOF Branding & Logo:** Einbindung des offiziellen SOCDOF-Logos (weißes S mit Windows-Farbrahmen) als Favicon, PWA-Icon, Taskleisten-Startbutton und Dashboard-Header.
- 🏢 **Firmenprofil-Standard:** Standard-Firmenname auf *Strudel's Test GmbH* aktualisiert.

### v18.3.1
- 🚀 **Windows Launcher:** Automatische Generierung von `.bat` und `.ps1` Starterskripten für den nativen Windows Desktop-Betrieb.
- 🔊 **Sound-Feedback:** Akustisches Feedback für Klicks, Popups und Fehler (mit Stummschalt-Funktion).
- 🌓 **Windows Dark / Light Mode:** Nahtloser Wechsel zwischen Dark Mode und DIN-konformem Light Mode.

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

*Erstellt mit ❤️ *
