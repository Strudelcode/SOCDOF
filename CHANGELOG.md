# 📝 Pending Updates / Changelog
<!-- 
Updates written here accumulate across versions and are broadcast to Discord on the next release or workflow run.
Once sent, this file is automatically reset so you can accumulate the next batch of updates.
Format guidelines:
- Keep it concise: what is new, what changed/improved, what was fixed.
- Avoid exhaustive UI/visual layout breakdowns.
-->

### v24.6.9 — Handbuch: Versions-Filter & Release-Suchfunktion

🚀 **Neu / What's New**:
- **Hauptversions-Filter (v24.x, v23.x, v22.x etc.)**: Im Handbuch unter „Versionen & Updates“ kann nun direkt nach Hauptversionen (v24, v23, v22, v21, v20, v19) gefiltert werden.
- **Echtzeit-Release-Suchfunktion**: Neue Suchleiste für Release-Notes – suchen Sie nach Versionsnummern (z.B. v24, v23.5), Stichwörtern oder Funktionen mit automatischer Text-Hervorhebung.

🔄 **Geändert / Improved**:
- **Übersichtliche Filterleiste**: Inklusive dynamischer Release-Anzahl, Filter-Zurücksetzen-Button und anpassbarem Such-Ergebnis-Zähler.

### v24.6.8 — Praxis: Standardmäßige Tabellenansicht & Rechnungs-App-Übertragung optimiert

🚀 **Neu / What's New**:
- **Standardmäßige Tabellenansicht**: Die Abrechnungsübersicht startet nun immer standardmäßig in der übersichtlichen Tabellenansicht (inkl. dauerhafter Speicherung der bevorzugten Ansicht).

🔄 **Geändert / Improved**:
- **Reibungslose Übertragung in die Rechnungs-App**: Die Übertragung einzelner oder mehrerer ausgewählter Honorarabrechnungen in die zentrale Rechnungs-App (`db.invoices`) funktioniert nun absolut zuverlässig inklusive automatischer CRM-Kundenverknüpfung und sofortigem Fokus.
- **Ruhige Sammelaktionsleiste**: Das Einblenden der blauen Leiste bei ausgewählten Rechnungen erfolgt nun flüssig und ohne störende Layout-Verschiebungen.

### v24.6.7 — Bug-Reports: Fehlerhafte „Post existiert nicht mehr“-Meldung behoben

🛠️ **Behoben / Fixed**:
- **Keine fälschliche „Gelöscht“-Meldung mehr bei Meine Tickets**: Tickets, die über BotGhost oder Webhooks eingereicht wurden, werden nicht mehr fälschlicherweise als auf Discord gelöscht markiert.
- **Präzise Snowflake-Filterung**: Der automatische Statusabgleich prüft nun ausschließlich echte Discord-Thread-IDs und schließt HTTP 403 (fehlende Berechtigungen) oder Webhook-Kennungen sicher aus.
- **Automatische Wiederherstellung (Auto-Healing)**: Alle bereits lokal gespeicherten Tickets, die fälschlicherweise die gelbe Warnmeldung erhalten hatten, werden automatisch bereinigt und wieder als aktiv dargestellt.

### v24.6.6 — Praxis: Mehrfachauswahl, 1-Klick-Bezahlt & Rechnungs-App-Sync

🚀 **Neu / What's New**:
- **Auswahl-Kästchen für Rechnungen**: Checkboxen bei jeder Rechnung sowie „Alle auswählen“-Masterbox sowohl in der Tabellen- als auch in der Kästchen-Ansicht.
- **1-Klick „Als bezahlt markieren“ (Sammelaktion)**: Ausgewählte Rechnungen mit einem einzigen Klick als bezahlt markieren – ohne unnötige Abfragen nach Bar/Bank.
- **Sammelübertragung in die Rechnungs-App**: Ausgewählte Praxis-Honorarabrechnungen können gesammelt direkt in das zentrale Rechnungs-Modul synchronisiert werden.

🔄 **Geändert / Improved**:
- **Direkte Stift-Buttons & Schnellbearbeitung**: Klienten, Stundensätze, Sitzungen, Honorare und Rechnungsdetails können überall über intuitive Stift-Symbole direkt bearbeitet werden.
- **Vollständige 4-Sprachen-Übersetzung**: Alle Sammelaktionen, Tooltips und Dialoge sind in Deutsch, Englisch, Französisch und Spanisch verfügbar.

### v24.6.5 — Praxis: Stundensatz & Stammdaten direkt bearbeiten

🚀 **Neu / What's New**:
- **Direktes Editieren in Klientenkarten & Dossier**: Schnelles Bearbeiten von Stundensätzen, Diagnosen, Adressen und Behandlungsnotizen per Stift-Schaltfläche.

### v24.6.4 — Web-Browser: Vollbild-Autostart bei App-Klick deaktiviert

🛠️ **Behoben / Fixed**:
- **Kein ungewollter Vollbildmodus mehr im Web-Browser**: Beim Anklicken von Apps oder Desktop-Icons im Browser wird nicht mehr automatisch der HTML5-Vollbildmodus des Browsers erzwungen.
- **Saubere Trennung zwischen Browser- und Desktop-App**: Der automatische Vollbild-Start ist nun strikt auf die native Windows-Desktop-App (Electron) beschränkt.
- Der Vollbildmodus im Browser bleibt bei Bedarf jederzeit manuell per F11 oder Taskleisten-Schaltfläche verfügbar.

### v24.6.3 — Praxis & Therapie: Sitzungen beliebig anklicken & bearbeiten

🚀 **Neu / What's New**:
- **Sitzungen per Klick bearbeiten**: Jede Sitzung kann nun in der Sitzungsliste, der Übersicht (Zuletzt dokumentierte Sitzungen) und im Klientenverlauf direkt per Klick auf die Karte geöffnet und editiert werden.
- **Zentrales Sitzungs-Modal**: Vollständige Dokumentationsmaske für Klient, Datum, Uhrzeit, Dauer, Schnellwahltasten, Interventionsvorschläge, klinische Verlaufsprotokolle und automatisierte Honorarabrechnungs-Erstellung.

🔄 **Geändert / Improved**:
- Klare visuelle Klick- und Hover-Hinweise mit Editier-Stift-Buttons und Tooltips in allen 4 Sprachen (DE, EN, FR, ES).

🛠️ **Behoben / Fixed**:
- Behoben: Sitzungen in der Übersicht leiteten zuvor nur zum Klienten weiter anstatt die Sitzung zur Bearbeitung zu öffnen; im Klientenverlauf waren Sitzungskarten zuvor nicht interaktiv.
