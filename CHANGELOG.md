# 📝 Pending Updates / Changelog
<!-- 
Updates written here accumulate across versions and are broadcast to Discord on the next release or workflow run.
Once sent, this file is automatically reset so you can accumulate the next batch of updates.
Format guidelines:
- Keep it concise: what is new, what changed/improved, what was fixed.
- Avoid exhaustive UI/visual layout breakdowns.
-->

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
