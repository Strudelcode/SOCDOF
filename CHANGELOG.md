# 📝 Pending Updates / Changelog
<!-- 
Updates written here accumulate across versions and are broadcast to Discord on the next release or workflow run.
Once sent, this file is automatically reset so you can accumulate the next batch of updates.
Format guidelines:
- Keep it concise: what is new, what changed/improved, what was fixed.
- Avoid exhaustive UI/visual layout breakdowns.
-->

### v23.14.3 (2026-09-26)

🚀 **Neu / What's New**:
- **Forum-Nachrichten & Status-Verlauf ansehen**: Neuer interaktiver Inspektionsdialog (`DiscordThreadInspectorModal`) zum Einsehen des gesamten Nachrichten- und Diskussionsverlaufs im Discord-Forum-Post, inklusive Bot/User-Avataren, Zeitstempeln und Discord-Embeds.
- **Discord Custom Emoji & Markdown-Unterstützung**: Automatische Erkennung und Anzeige von Discord-Custom-Emojis (`<:name:id>` und animierte `<a:name:id>`), User-Pings (`<@ID>`), Codeblöcken, Zitaten und Textformatierungen.
- **Präzise Forum-Tag ID-Zuordnung**: Exakte Erkennung aller Bug-Report Tags (`⏳ Neue Einreichung`, `🔍 In Überprüfung`, `❌ Abgelehnt`, `✅ Behoben`, `🔨 Fix in Bearbeitung`, `↗️ Bestätigt & Weitergeleitet`) zur fehlerfreien Anzeige des echten Status.

🔄 **Geändert / Improved**:
- **Manuelle Status-Auswahl entfernt**: Das überflüssige Status-Dropdown wurde aus allen Ticket-Ansichten entfernt, da der Status direkt und verbindlich vom Discord-Forum gesteuert wird.
- **Vollständige 4-Sprachen-Übersetzung**: Sämtliche neuen Inspektionsdialoge, Statusleisten und Schaltflächen sind in Deutsch, Englisch, Französisch und Spanisch verfügbar.

---

### v23.14.2 (2026-09-26)

🚀 **Neu / What's New**:
- **Live-Status & Discord-Tags Abfrage**: Echte Discord-Forum-Tags (`⏳ Prüfung ausstehend`, `🔨 In Bearbeitung`, `✅ Erledigt / Behoben`, etc.) werden direkt vom Discord-Server ausgelesen und als Status-Badges auf den Ticket-Karten angezeigt – ganz ohne manuelles Zutun.
- **30-Sekunden Live-Aktualisierung (nur bei geöffnetem Fenster)**: Tickets prüfen automatisch alle 30 Sekunden im Hintergrund auf Discord-Änderungen (neue Tags, Antworten, Bearbeitungsstatus), solange das Fenster geöffnet ist.
- **Antworten-Zähler & Manuelle Synchronisation**: Anzeige der Antwortanzahl (`💬 X Antworten`) sowie ein „Jetzt synchronisieren“-Button mit Lade-Animation und Zeitstempel.

---

### v23.14.1 (2026-09-26)

🚀 **Neu / What's New**:
- **Authentische Discord-Live-Vorschau**: Überarbeitete, detailgetreue Discord-Dark-Theme-Vorschau mit Forum-Kanalheader (`#🐛 | REPORT` / `#💡vorschläge`), Tag-Badges (`⏳ Prüfung ausstehend`), SOCDOF-Bot-Badge (`APP`), Discord-User-Ping (`<@ID>`), farbigen Embed-Seitenstreifen (Orange für Bugs, Blau für Ideen) und allen Embed-Feldern.

🔄 **Geändert / Improved**:
- **Echtzeit-Synchronisierung beim Tippen**: Die Discord-Vorschau aktualisiert sich nun sofort live während der Eingabe von Titel, App-Ort und Beschreibung.

---

### v23.14.0 (2026-09-26)

🚀 **Neu / What's New**:
- **App- & Modul-Auswahl per Pop-up**: Neuer Pop-up-Dialog mit Suchfeld („App oder Funktion suchen...“), farbigen Icons und allen Apps zur einfachen Fehlerauswahl (z. B. Support, Rechnungen, Dashboard).
- **Vier-Sprachen-Übersetzung**: Vollständige Lokalisierung aller Texte, Anleitungen, Statusmeldungen, Dialoge und Ticket-Ansichten in Deutsch, Englisch, Französisch und Spanisch.

🔄 **Geändert / Improved**:
- **Schritt 2 standardmäßig nicht vorausgefüllt**: Zeigt nun standardmäßig „Wähle einen Ort aus...“ mit Validierungsprüfung vor dem Absenden.
- **Startmenü bereinigt**: Discord-Links und -Texte aus der Fußleiste des Sub-Group-Startmenüs entfernt und durch 4 klare Schnellaktionen (Sprache, Handbuch, GitHub, Bug-Reports) ersetzt.

---

### v23.13.0 (2026-09-26)

🚀 **Neu / What's New**:
- **Eigene Desktop-App „Bug-Reports & Meldungen“**: Vollständige App im App Launcher, auf dem Desktop und im Startmenü zum Erfassen von Fehlern und Verfolgen eigener Tickets mit Direktlink zum Discord-Forum.
- **3-Schritte-Anleitung mit Status-Check**: Klare Checkliste führt Nutzer strukturiert durch 1. Titel, 2. App-Auswahl, 3. Fehlerbeschreibung.
- **Vollständige App-Auswahl**: Alle SOCDOF-Apps zur präzisen Fehlerzuordnung gelistet, inklusive Freitext-Option „Sonstiges (Eigene Eingabe)“.
- **Ticket-Verwaltung & Filter**: Eigene Meldungen können als offen, in Bearbeitung oder erledigt markiert werden; erledigte Tickets lassen sich per Knopfdruck ausblenden.

🔄 **Geändert / Improved**:
- **Keine vorzeitige Vorschau mehr**: Das Discord-Embed wird erst generiert und angezeigt, sobald alle Pflichtfelder (Titel, App, Beschreibung) ausgefüllt sind.
- **Strikte Discord-ID-Validierung**: User-IDs werden auf 17 bis 20 Ziffern validiert mit Zähler und Fehlerhinweis vor dem Absenden.

🛠️ **Behoben / Fixed**:
- **Doppelter Zeitstempel in Discord behoben**: Überflüssiger Embed-Timestamp entfernt, sodass Discord nicht mehr zweimal „heute um [Zeit]“ anzeigt.
- **Rechtschreibung korrigiert**: Feldbezeichnung von „Bug Infomation“ zu „Bug Information“ korrigiert.

---

### v23.12.0 (2026-09-26)

🚀 **Neu / What's New**:
- **Direkte Discord-Bot-Forum-Integration**: Nutzer können Feedback, Vorschläge und Fehlerberichte direkt aus der Anwendung in das offizielle Discord-Forum senden.
- **Automatischer Bug-Report in #🐛 | REPORT**: Bug-Meldungen werden direkt als Forum-Thread im Kanal `1535709136363462757` angelegt und erhalten automatisch das Tag `⏳ Prüfung ausstehend` (`1535711015902384269`).
- **Ideen & Feedback in #💡vorschläge**: Feature-Ideen und Anregungen werden im Forum `1524133720876126408` mit dem Tag `SOCDOF` (`1553317496159731722`) veröffentlicht.
- **Discord-Identität & User-Ping**: Angabe von Discord-Name und optionaler User-ID für einen echten Discord-Ping (`<@ID>`) im Embed; Zugangsdaten werden lokal gespeichert.
- **Authentische Discord-Live-Vorschau**: Integrierte Echtzeit-Vorschau im originalen Discord-Dark-Theme mit Embed-Farben, Feldern und Zeitstempel.

🔄 **Geändert / Improved**:
- **Schnellzugriff überall verfügbar**: Das Feedback-Fenster kann bequem über das Windows-Startmenü, die Einstellungen-Seitenleiste oder die Befehlspalette (`Ctrl+K`) aufgerufen werden.

---

### v23.11.0 (2026-09-25)

🚀 **Neu / What's New**:
- **Rechnungsvorlagen & Layout-Editor in Rechnungs-App & Einstellungen**: Vollständiger Vorlagen-Editor direkt in der Rechnungs-App (`InvoicesModule`) über den Button „Vorlagen & Layout“ und in den Einstellungen unter „Briefkopf & Vorlagen“ erreichbar.
- **Vorgefertigte Profi-Vorlagen**: Sofortige Auswahl zwischen *DIN 5008 Standard* (inkl. Falt- und Lochermarken), *Modern Minimalist*, *Executive Corporate* (mit Firmen-Header), *Creative Studio* und *Praxis/Heilbehandlung* (§ 4 Nr. 14 UStG).
- **Interaktive Live-Vorschau mit 100.000 € Test-Beleg**: Schnellansicht zur visuellen Kontrolle mit Logo-Sockel oben links, Musterempfänger und 100.000,00 € Testvolumen oder echten Belegdaten.
- **Dynamisches Variablen-System & Datei-Import**: Unterstützung für Platzhalter (`{Rechnungsnummer}`, `{Datum}`, `{Kunde_Name}`, `{Netto}`, `{Gesamtbetrag}`) mit 1-Klick-Einfügen sowie Datei-Upload für `.docx`, `.html`, `.txt` und `.json` mit automatischer Erkennung.
- **Microsoft Word (.doc) & PDF/Druck-Export**: Vorlagen und Rechnungsbelege können direkt als formatierte Word-Datei heruntergeladen oder als DIN-A4 gedruckt werden.

🔄 **Geändert / Improved**:
- **Therapie-Modul aufgeräumt**: Entfernung des unübersichtlichen Vorlagen-Editors aus dem Praxis-Modul zugunsten eines sauberen Dashboards für Klienten, Termine und Abrechnungen.
- **Druckansicht erweitert**: `InvoicePrintModal` bietet nun eine Vorlagenauswahl und Word-Export direkt im Druckdialog.
