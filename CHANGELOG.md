# 📝 Pending Updates / Changelog
<!-- 
Updates written here accumulate across versions and are broadcast to Discord on the next release or workflow run.
Once sent, this file is automatically reset so you can accumulate the next batch of updates.
Format guidelines:
- Keep it concise: what is new, what changed/improved, what was fixed.
- Avoid exhaustive UI/visual layout breakdowns.
-->

### v23.9.6 (2026-09-24)

🚀 **Neu / What's New**:
- **Kompaktes „Weiteres“-Menü mit 3 Strichen (Hamburger-Dropdown)**: Beseitigt die unschöne horizontale Scroll-Leiste in der Kopfzeile vollständig. Fahrtenbuch und Termine sind übersichtlich in einem responsiven Ausklappmenü gebündelt.
- **Kundenbuch-Synchronisation bei manueller Klientenerstellung**: Optionale Checkbox beim manuellen Anlegen, die neue Klienten automatisch als vollwertige Kontakte im zentralen CRM speichert.

🔄 **Geändert / Improved**:
- **Dynamische Währungsanbindung**: Die in den Einstellungen hinterlegte Unternehmenswährung (z. B. €, $, CHF, £) wird nahtlos in allen Praxis-, Honorar- und Fahrtenansichten angewendet.

### v23.9.5 (2026-09-24)

🚀 **Neu / What's New**:
- **Direktes Kundenbuch bei Klientenerstellung**: Klick auf „+ Neuer Klient“ öffnet sofort das vollständige CRM-Kundenbuch (`CustomerPickerModal`) zur Übernahme aller Stammdaten ohne lästige Zwischenformulare.
- **Normales, professionelles Abrechnungsfenster**: Vollständiges Rechnungsmanagement mit Rechnungsnummern, Leistungsbeschreibungen, Fälligkeit, Statusfiltern, Druck-/PDF-Vorschau und 1-Klick-Übertragung in das Rechnungs-Hauptmodul.
- **Dynamische Praxis-Statistik & Verlaufschart**: Neues Dashboard mit interaktivem Monatsverlaufs-Diagramm für Umsatz und Sitzungen sowie fokussierten KPI-Karten.

🔄 **Geändert / Improved**:
- **Schlankes, einheitliches App-Design**: Beseitigung redundanter Header-Badges und doppelter Leisten zugunsten einer sauberen 5-Tab-Navigation.
- **Optimiertes Fahrtenbuch & Dokumentation**: Klare Eingabefelder mit festen Höhen und ohne ziehbare Textfeld-Griffe (`resize-none`).

### v23.9.0 (2026-09-24)

🚀 **Neu / What's New**:
- **Fahrtenbuch mit Live-Distanz- & Erstattungsberechnung**: Transparente Erfassung von Start- und End-Kilometerständen (Tachostand), automatische Berechnung der gefahrenen Kilometer und Live-Erstattung mit Pauschalenschnellauswahl (0,30 €, 0,38 €, 0,42 €/km).
- **Schnellauswahl für Sitzungsdauer**: Direkte Buttons für 30, 50, 60 und 90 Minuten sowie vordefinierte Leistungsvorlagen bei der Abrechnungserfassung.

🔄 **Geändert / Improved**:
- **Klienten-Auswahl & CRM-Verknüpfung**: Prominenter Kontaktbuch-Button mit Anzeige der vorhandenen Kontakte, schneller Wechsel zur Kontakte-App und vereinfachte manuelle Klientenerfassung.
- **Nahtlose Abrechnungsübernahme**: Direkter Export von Therapieleistungen in offizielle Rechnungen mit sofortiger Verlinkung ins Rechnungs- und Buchhaltungsmodul.

🛠️ **Behoben / Fixed**:
- **Textfeld-Verzerrung behoben**: Textbereiche (Textareas) in Klienten-, Sitzungs- und Kontakt-Dialogen können nicht mehr versehentlich über Ziehpunkte verkleinert/verzerrt werden (`resize-none`).

### v23.8.0 (2026-09-24)

🚀 **Neu / What's New**:
- **Therapie- & Praxis-Modul mit tiefer Rechnungs- & CRM-Integration**: Klienten direkt aus dem Adressbuch/CRM auswählen, vorgefüllte Stammdaten übernehmen und offizielle Rechnungen mit einem Klick aus Sitzungen und Abrechnungspositionen erstellen.
- **Praxis-Umsatzstatistik & Jahresübersicht**: Ausführliche Monats- und Jahresstatistiken zu Honorarumsätzen, Sitzungsanzahlen, durchschnittlichem Sitzungssatz und Gesamtdauer in Stunden.
- **Authentische Desktop-Live-Vorschau**: Die Einstellungs-Vorschau zeigt nun echte SOCDOF-Desktop-Icons, ein detailgetreues Programmfenster mit Live-Umsatzdaten und das offizielle Start-Icon.
- **Responsives 4-Spalten-Grid für Personalisierung**: Beseitigt mühsames horizontales Maus-Scrollen durch ein klares, auf einen Blick erfassbares Tab-Raster.

🔄 **Geändert / Improved**:
- **Klare Trennung von Konten & Personalisierung**: Profilbild- und Benutzerkontenverwaltung wird nun sauber und einheitlich im Bereich "Konten & Profile" gebündelt.
- **Termin- & Sitzungsverwaltung**: Klare Feldbezeichnungen für Behandlungsthemen und Sitzungsnotizen mit automatischer Dauerberechnung und Schnellauswahl-Buttons.
- **Vollständige Viersprachigkeit**: Alle neuen Funktionen und Texte in Deutsch, Englisch, Französisch und Spanisch verfügbar.

🛠️ **Behoben / Fixed**:
- **Textfeld-Begrenzung in Modals**: Verhindert das unbegrenzte Vergrößern und Herausschieben von Textfeldern über den Bildschirmrand.

### v23.7.0 (2026-09-24)

🚀 **Neu / What's New**:
- **Multi-Monitor & Extended Display Management**: Dedizierter Bereich "Anzeige & Bildschirme" in den Einstellungen mit interaktiver Bildschirmanordnung, Display-Erkennung, Monitor-Identifizierung per Overlay-Animation ("1", "2") und Unterstützung für virtuelle Zweitmonitore.
- **Fenster-Ausdocken (Popout)**: Neues Ausdock-Icon (`Tv`) in der Fenster-Titelleiste zum einfachen Verschieben von Modulen auf einen zweiten Monitor oder in ein separates Browser-/Electron-Fenster.
- **Nachtmodus (Night Light)**: Stufenloser Farbtemperaturregler (1500K–5500K) mit warmem Bildschirmschutzfilter für ergonomisches Arbeiten bei schlechtem Umgebungslicht.
- **Multi-Monitor Electron IPC**: Native Abfrage von Systembildschirmen (`getDisplays`), gezieltes Verschieben von Fenstern (`moveWindowToDisplay`) und Erzeugung sekundärer Electron-Workspaces (`popoutWindow`).

🔄 **Geändert / Improved**:
- **Fensterpositions-Gedächtnis**: Exakte Fensterkoordinaten, -größen und Maximierungszustände werden per Monitor gespeichert und beim erneuten Öffnen zuverlässig wiederhergestellt.
- **Skalierung & Ausrichtung**: Vollständige Einstellmöglichkeiten für UI-Skalierung (100%–200%), Bildschirmausrichtung (Quer-/Hochformat) und GPU-Hardwarebeschleunigung.
- **Vollständige Viersprachigkeit**: Alle neuen Einstellungen, Beschreibungen und Dialoge in Deutsch, Englisch, Französisch und Spanisch verfügbar.

🛠️ **Behoben / Fixed**:
- Optimierung der Sidebar-Kategoriengruppierung im Settings Hub für eine saubere, intuitive Gliederung von Bildschirmen, Geschäftsprozessen und Systemwartung.

