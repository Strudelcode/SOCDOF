# 📝 Pending Updates / Changelog
<!-- 
Updates written here accumulate across versions and are broadcast to Discord on the next release or workflow run.
Once sent, this file is automatically reset so you can accumulate the next batch of updates.
Format guidelines:
- Keep it concise: what is new, what changed/improved, what was fixed.
- Avoid exhaustive UI/visual layout breakdowns.
-->

## [v23.5.0] - 2026-09-19

### 🚀 Neu / What's New
- **Mehrstufige System-Zurücksetzung ("System zurücksetzen")**: Neuer 4-stufiger Sicherheits-Assistent in den Einstellungen, der versehentliches Löschen zuverlässig verhindert (Wort-Bestätigung „Löschen“ ➔ Sicherheitsabfrage ➔ Passwortüberprüfung des Benutzerkontos ➔ Letzte Bestätigung).
- **Vollständiger Daten- & Account-Reset**: Bereinigung der gesamten IndexedDB-Datenbanken, gespeicherten Dateien, Einstellungen sowie aller Benutzerkonten mit anschließender Weiterleitung zum anfänglichen Startbildschirm zur Neueinrichtung.

### 🔄 Geändert / Improved
- **Viersprachige Lokalisierung**: Vollständige Unterstützung in Deutsch, Englisch, Französisch und Spanisch (`i18n.ts`) inklusive toleranter Erkennung von Bestätigungswörtern („Löschen“, „Delete“, „Supprimer“, „Eliminar“).
- **Visuelles Feedback**: Flüssige Statusanzeige („Wird zurückgesetzt...“) mit Ladebalken während der Bereinigung aller Daten.

## [v23.4.5] - 2026-09-19

### 🛠️ Behoben / Fixed
- **Desktop Icon Positionen**: Manuell verschobene, getauschte oder angeordnete Icons auf dem Desktop behalten ihre exakten Koordinaten nun dauerhaft und werden beim Neustart oder Neuladen nicht mehr auf Standardspalten zurückgesetzt.
- **In-App App Store Aktivierung**: Im App Store aktivierte Module (wie z. B. Praxis & Therapie oder Rechnungen) bleiben zuverlässig installiert und auf dem Desktop/Taskbar angeheftet, anstatt bei Neustart durch Filter zurückgesetzt zu werden.
- **Benutzer-Workspace Synchronisierung**: Synchronisation aller Desktop-Koordinaten und Modulstatus direkt mit dem benutzerspezifischen Account-Speicher ohne Initialisierungsverzögerung behoben.

