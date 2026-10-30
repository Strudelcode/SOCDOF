# 📝 Pending Updates / Changelog
<!-- 
Updates written here accumulate across versions and are broadcast to Discord on the next release or workflow run.
Once sent, this file is automatically reset so you can accumulate the next batch of updates.
Format guidelines:
- Keep it concise: what is new, what changed/improved, what was fixed.
- Avoid exhaustive UI/visual layout breakdowns.
-->

## v24.11.4
- 🛠️ **Behoben / Fixed**: Keine überlappenden Desktop-Icons mehr – Der vertikale Rasterabstand auf dem Desktop wurde von 96px auf 116px vergrößert, sodass mehrzeilige App-Namen (wie „Praxis & Therapie“) nicht mehr in darunterliegende Icons hineinragen.
- 🔄 **Geändert / Improved**: Bündige Icon-Ausrichtung & saubere Abstände – App-Symbole richten sich einheitlich oben aus (`justify-start`), haben eine feste Maximalhöhe und einen optimierten Textabstand für alle 4 Sprachen.
- 🔄 **Geändert / Improved**: Automatische Positions-Migration – Bereits gespeicherte Desktop-Anordnungen werden beim Start nahtlos in das neue, luftigere Raster überführt.

## v24.11.3
- 🔄 **Geändert / Improved**: Modernisiertes Update- & Installer-Fenster – Das automatische Update-Fenster wurde visuell aufgewertet mit Status-Farben (grüne Haken, hervorgehobener aktiver Schritt), flüssigem Farbverlaufs-Balken und dezenteren Bezeichnungen statt technischer Großbuchstaben.
- 🛠️ **Behoben / Fixed**: Sprachliche Bereinigung im Handbuch & Installer – Unnatürliche Begriffe wie „geräuschloser Installer“ wurden durch professionelle Bezeichnungen („automatische Hintergrund-Installation“) ersetzt.
- 🔄 **Geändert / Improved**: Handbuch ohne KI-Floskeln – Der künstlich wirkende „⚡ Blitzschneller Performance-Modus“-Banner in der Versionshistorie wurde durch eine schlichte, natürliche Anzeige ersetzt.

## v24.11.2
- 🚀 **Neu / What's New**: Betriebssystem-Spracherkennung beim Erststart – Erkennt automatisch die Windows-/Systemsprache des PCs (Deutsch, Englisch, Französisch, Spanisch) mit sicherem englischem Fallback.
- 🚀 **Neu / What's New**: Option „Mit Betriebssystem synchronisieren“ in den Einstellungen – Neuer Schalter unter Sprache & Region, um die App bei jedem Start kontinuierlich an das Betriebssystem anzupassen.
- 🔄 **Geändert / Improved**: Manuelle Sprachauswahl wird verlässlich beibehalten – Sobald eine Sprache manuell gewählt wird, bleibt diese dauerhaft fest gespeichert.
- 🔄 **Geändert / Improved**: Mehrsprachige Netzwerk-Konfliktdialoge – Alle Warnmeldungen, Sitzungssperren und Abfragen bei paralleler Netzlaufwerk-Nutzung erscheinen jetzt auf Deutsch, Englisch, Französisch und Spanisch passend zur gewählten Sprache oder Systemsprache.
- 🔄 **Geändert / Improved**: Setup.exe Sprachauswahl – Der Windows-Installer zeigt beim Starten die Sprachauswahl an und wählt automatisch die Systemsprache mit Englisch als primärem Standard vor.

## v24.11.1
- 🚀 **Neu / What's New**: QNAP NAS & Netzlaufwerk-Modus – SOCDOF kann direkt vom Server-Laufwerk gestartet werden und speichert Datenbank, Einstellungen, Rechnungen und Backups im gemeinsamen Ordner auf dem Netzlaufwerk.
- 🚀 **Neu / What's New**: Setup-Auswahl für Business / Netzlaufwerke – Der Windows-Installer (`Setup.exe`) erlaubt jetzt die freie Auswahl des Installationsverzeichnisses (z. B. direkt auf das Netzlaufwerk `Z:\SOCDOF`).
- 🔄 **Geändert / Improved**: Intelligente Netzwerk-Sitzungssperre – Erkennt, welcher Benutzer auf welchem Computer die gemeinsame Datenbank geöffnet hat und bietet 3 klare Aktionen (Beenden, Anderen Benutzer remote speichern & schließen, Trotzdem fortfahren).
- 🛠️ **Behoben / Fixed**: Schutz vor Mehrfachnutzung auf Netzlaufwerken mit automatischem Remote-Safe-Close-Signal verhindert Datenkorruption bei versehentlichem Zweitzugriff.
- 🚀 **Neu / What's New**: Duales Build-System mit Unterstützung für eigenständige portable Windows-Executables (`build:portable`).

## v24.11.0
- 🚀 **Neu / What's New**: Textwerk, a Word-style text editor with a ribbon, offline German spell check, a proofing panel with suggestions and a word list with statistics.
- 🔄 **Geändert / Improved**: Text Editor (formerly Textwerk) is available in the launcher, App Store, command palette and documentation in all four languages, and appears on the desktop, taskbar and Start menu.
- 🔄 **Geändert / Improved**: Text Editor uses typographic quotation marks, system fonts, portrait and landscape pages with page breaks, Word-style standard colors, and a ribbon that wraps instead of scrolling.
- 🔄 **Geändert / Improved**: Text Editor adds superscript, subscript, clear formatting, time insertion and margin presets.
- 🚀 **Neu / What's New**: Text Editor can insert a table of contents built from the Heading 1 and Heading 2 paragraphs (Insert tab).
- 🚀 **Neu / What's New**: Tables, a simple spreadsheet program with formulas (SUM, AVERAGE, MAX, MIN, COUNT and cell arithmetic) that saves and opens CSV files.
- 🛠️ **Behoben / Fixed**: Pages move to the next page when full instead of growing endlessly.
