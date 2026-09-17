# 📝 Pending Updates / Changelog
<!-- 
Updates written here accumulate across versions and are broadcast to Discord on the next release or workflow run.
Once sent, this file is automatically reset so you can accumulate the next batch of updates.
Format guidelines:
- Keep it concise: what is new, what changed/improved, what was fixed.
- Avoid exhaustive UI/visual layout breakdowns.
-->

### v22.9.5
🔄 **Geändert / Improved**:
- **Verbessertes Preisfeld für Aufgaben & Positionen**: Das optionale Preisfeld für Service-Positionen ist bei neu geöffneten Aufgaben nun standardmäßig aufgeräumt (mit dezentem Platzhalter `0,00`), sodass kein störender `0`-Wert mehr mühsam weggelöscht werden muss.
- **Automatische Vorbelegung aus Einstellungen**: Wenn in den Support-Einstellungen ein Standard-Aufgabenpreis hinterlegt ist, wird dieser automatisch vorausgefüllt.
- **Schnellauswahl-Chips für Beträge**: Über dem Preisfeld stehen nun Sofortauswahl-Buttons für gängige Pauschalen (`25 €`, `50 €`, `100 €`, hinterlegter Standardwert oder Ticket-Stundensatz) sowie ein Schnell-Reset bereit.

### v22.9.4
🛠️ **Behoben / Fixed**:
- **Laufzeitfehler bei Array-Mapping behoben**: Ein `TypeError: Cannot read properties of undefined (reading 'map')` im Zeiterfassungs-Modal (`SupportTimesheetModal`) wurde durch Vereinheitlichung der Mitarbeiterlisten-Props (`staffList` und `staffOptions`) und sichere Fallbacks dauerhaft behoben.
- **Datenabsicherung für Tickets**: Beim Laden und Auswählen von Tickets werden die Felder `tags`, `timesheets`, `workItems` und `activities` stets als gültige Arrays initialisiert, um Zugriffsfehler zu verhindern.

### v22.9.3
🛠️ **Behoben / Fixed**:
- **Dark Mode im Aufgaben-Dialog korrigiert**: Ein Fehler in der Theme-Ansteuerung des Pop-up-Dialogs („Position / Aufgabe hinzufügen“) wurde behoben, bei dem der Fensterhintergrund weiß blieb, während die Eingabefelder im Dark Mode dunkel dargestellt wurden. Der Dialog passt sich nun nahtlos und sauber an den Dunkel- bzw. Hellmodus an.
- **Einheitliche Modal-Farbgebung**: Die Klassen für Arbeitszeit- und Dokumentenbetrachter-Dialoge wurden vereinheitlicht, um Farbkollisionen zuverlässig zu verhindern.

### v22.9.2
🚀 **Neu / What's New**:
- **E-Mail-Entwurf (.eml) mit Vorschau-Dialog**: Klick auf „E-Mail-Entwurf (.eml)“ lädt die Datei nicht mehr sofort herunter, sondern öffnet ein Vorschaufenster mit Absender, Empfänger, Betreff und editierbarem Nachrichtentext.
- **Direkter Download & Zwischenablage**: Im Vorschaufenster kann der Text geprüft, in die Zwischenablage kopiert oder über „Jetzt downloaden (.eml)“ gezielt gespeichert werden.

🔄 **Geändert / Improved**:
- **Zusätzlicher Lösch-Button im Dialog-Footer**: Neben dem Icon in der Kopfleiste bietet die Kontaktansicht nun auch im Fußbereich einen direkten „Kontakt löschen“-Button.

🛠️ **Behoben / Fixed**:
- **Kontakt löschen im iframe / Browser behoben**: Das blockierende native `window.confirm()` wurde durch einen zuverlässigen In-App Bestätigungsdialog mit Rechnungs-Warnhinweis ersetzt, wodurch das Löschen von Kontakten stets fehlerfrei funktioniert.
- **Vollständige 4-Sprachen-Übersetzung**: Sämtliche Texte des Vorschau- und Löschdialogs in Deutsch, Englisch, Französisch und Spanisch hinterlegt.

### v22.9.1
🚀 **Neu / What's New**:
- **Direkter Pop-up-Dialog für Aufgaben**: Die doppelte Inline-Eingabemaske im Ticket wurde entfernt – ein Klick auf „Aufgabe hinzufügen“ öffnet direkt das strukturierte Modal zur Aufgaben- und Positionserfassung.
- **Standard-Kosten / Betrag in Einstellungen**: In den Support-Einstellungen kann jetzt ein Standardbetrag für Aufgaben definiert werden, der beim Anlegen neuer Positionen automatisch vorausgefüllt wird.

🔄 **Geändert / Improved**:
- **Übersichtlicher Nur-Dokument Modus**: Bei Aktivierung von „Nur Dokument“ wird das Notizen-/Beschreibungsfeld automatisch ausgeblendet, um die Ansicht für reine Beilagen (Pläne, Protokolle) sauber zu halten.
- **Mehrfacherfassung per Schnell-Button**: Im Aufgaben-Modal steht nun „Speichern & Weiteres anlegen“ zur Verfügung, um schnell aufeinanderfolgende Arbeitsschritte einzupflegen.

🛠️ **Behoben / Fixed**:
- **Konsistente Button- & Feldbezeichnungen**: Einheitliche Benennung „Aufgabe hinzufügen“ in allen Modulen und vollständige 4-Sprachen-Übersetzung (DE, EN, FR, ES).

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
