# 📝 Pending Updates / Changelog
<!-- 
Updates written here accumulate across versions and are broadcast to Discord on the next release or workflow run.
Once sent, this file is automatically reset so you can accumulate the next batch of updates.
Format guidelines:
- Keep it concise: what is new, what changed/improved, what was fixed.
- Avoid exhaustive UI/visual layout breakdowns.
-->

### v22.9.0
🚀 **Neu / What's New**:
- **Intelligenter CSV- & vCard-Import**: Robuster RFC 4180-Parser mit automatischer Spaltenerkennung (Outlook, Apple, Google, Excel), Unterstützung für mehrzeilige Textfelder und Delimiter-Erkennung (Semikolon, Komma, Tab).
- **Gästebuch / Privates Adressbuch**: Neuer Kontakttyp `guest` mit eigener Filteransicht und türkisfarbenem Badge für private Kontakte, Freunde und Gästebucheinträge abseits kommerzieller Kunden/Lieferanten.
- **Export für CSV & vCard**: Flexibles Exportmenü zum Herunterladen aller Kontakte oder der aktuellen Filteransicht als CSV oder vCard (.vcf).

🔄 **Geändert / Improved**:
- **Kategorie-Auswahl beim Import**: Vor dem Import kann direkt gewählt werden, ob Kontakte ins Gästebuch, zu Kunden oder Lieferanten importiert werden sollen, inklusive Zeilen-Löschfunktion im Vorschaudialog.
- **Keine künstlichen Platzhalter-Mails**: Kontakte nur mit Name oder Firma werden sauber ohne erfundene E-Mail-Adressen übernommen.

🛠️ **Behoben / Fixed**:
- **Altdaten-Bereinigung (Sanitizer)**: Automatische Bereinigung alter Importe, wodurch fehlerhaft generierte Dummy-Adressen (`kontakt_X@import.local`) rückstandslos aus der Datenbank entfernt werden.
- **Vollständige 4-Sprachen-Lokalisierung**: Alle neuen Gästebuch-, Import- und Export-Texte in Deutsch, Englisch, Französisch und Spanisch hinterlegt.

### v22.8.0
🚀 **Neu / What's New**:
- **Pop-up-Dialog für Aufgaben & Positionen**: Übersichtliches Modal-Fenster zum Erfassen und Bearbeiten von Service-Arbeitsschritten mit Kundenauswahl, Titel, Detailbeschreibung, Pauschalkosten und Beilagen.
- **Nur-Dokument Modus & PDF-Direktvorschau**: Möglichkeit, Arbeitsschritte als reine Dokumentenbeilage (z.B. Messprotokoll, Schaltplan) anzulegen – inklusive prominentem „Dokument anzeigen“-Button in der Aufgabenliste.
- **In-App Dokumenten- & PDF-Betrachter**: Integriertes Vorschaufenster für PDF-Dokumente, Fotos, Prüfberichte und Belege ohne externen PDF-Reader.
- **Zeiterfassungs- & Beleg-Modal**: Pop-up zur Schnellerfassung von Arbeitsstunden mit Anbindung von Werkstatt- oder Spesenbelegen per Drag & Drop.

🔄 **Geändert / Improved**:
- **Drag & Drop Dateiupload**: Bequemes Hinzufügen von PDFs und Belegen per Drag & Drop oder Klick mit Größenanzeige und direkter Entfernungsfunktion.

🛠️ **Behoben / Fixed**:
- **Sprachmischmasch bei Zeiterfassung behoben**: Der Begriff „Work Description“ wurde in deutschen Ansichten korrigiert und lautet nun konsistent „Tätigkeitsbeschreibung“ über Live-Timer, Tabellen und Eingabemasken hinweg.
- **Vollständige 4-Sprachen-Lokalisierung**: Alle neuen Modalfenster, Belegansichten und Tooltips in Deutsch, Englisch, Französisch und Spanisch harmonisiert.

### v22.7.0
🚀 **Neu / What's New**:
- **Arbeitsschritte & Service-Positionen im Ticket**: Neuer Reiter „Aufgaben & Positionen“ für Support-Tickets zum Erfassen mehrerer Einzelschritte mit Titel, Detailnotizen, optionalen Pauschalbeträgen, Fortschrittsanzeige und 1-Klick Erledigt-Status.
- **Schnelle Mehrfacherfassung**: Erfassungsmaske mit Enter-Unterstützung und „Speichern & Weiteres anlegen“-Button für zügiges Eintragen mehrerer Arbeitsschritte nacheinander.
- **DIN-A4 Servicebericht (Druck & PDF-Export)**: Vollständiger Kundendienstbeleg nach DIN 5008 mit Faltmarken, Firmenkopf, Kundendaten, Problembeschreibung, Aufgabenliste inklusive Beträgen, Zeiterfassung, MwSt.-Berechnung und Unterschriftsfeldern.
- **Ersteinrichtungs-Assistent (Onboarding)**: Automatisches Öffnen der Support-Einstellungen mit Willkommens-Banner beim allerersten Öffnen des Kundendienst-Moduls zur direkten Konfiguration.

🔄 **Geändert / Improved**:
- **Einstellung für Service-Positionen**: Option in den Support-Einstellungen (Allgemein) zum Aktivieren oder Deaktivieren von Arbeitsschritten je nach Betriebsbedarf.
- **4-Sprachen-Parität**: Vollständige Lokalisierung aller neuen Dialoge, Druckbelege und Eingabefelder auf Deutsch, Englisch, Französisch und Spanisch.

🛠️ **Behoben / Fixed**:
- **Sprachdateien & Lokalisierung bereinigt**: Vollständige Bereinigung und Angleichung aller Übersetzungsschlüssel in allen vier Sprachen (`de`, `en`, `fr`, `es`) in `src/lib/i18n.ts`, Support-Tickets, DIN-A4-Serviceberichten und Kunden-Auswahldialogen.
