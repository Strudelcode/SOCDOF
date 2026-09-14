# 📝 Pending Updates / Changelog
<!-- 
Updates written here accumulate across versions and are broadcast to Discord on the next release or workflow run.
Once sent, the workflow automatically resets this file so you can accumulate the next batch of updates.
Format guidelines:
- Keep it concise: what is new, what changed/improved, what was fixed.
- Avoid exhaustive UI/visual layout breakdowns.
-->

## 🌟 Version 22.6.4 (Support-Layout-Optimierung, Kanban-Anpassung & Status-Workflow)
- 🛠️ **Behoben**: Initialisierungsreihenfolge im Support-Modul behoben (`ReferenceError: Cannot access 'getStatusLabel' before initialization`), indem die Status-Hilfsfunktion vor der Kanban-Spaltenberechnung deklariert wird.
- 🛠️ **Behoben**: Windows-Setup-Build (`electron-builder`) in GitHub Actions behoben – `build/installer.nsh` bereitgestellt und `.gitignore` korrigiert, sodass NSIS-Build-Ressourcen zuverlässig im Git-Repository versioniert werden.
- 🛠️ **Behoben**: Layout-Überlauf im Support-Modul behoben – die Statusspalten im Kanban-Board und die Detailansicht bleiben nun sauber innerhalb der Fenstergrenzen und scrollen intern, ohne nach hinten abzudriften.
- 🚀 **Neu**: Ergonomische Status-Filterleiste im Filterband zum direkten Umschalten nach Ticket-Phasen mit Zähleranzeige.
- 🔄 **Verbessert**: Adaptive 5-Stufen-Statuspipeline im Ticket-Kopf mit sichtbaren Statuspunkten und flexibler Anpassung an die Fensterbreite.
- 🚀 **Neu**: Ein- und Ausblend-Funktion für das interne Logbuch und Aktivitäts-Chatter im Support-Ticket, um bei Bedarf die gesamte Arbeitsfläche für das Formular freizugeben.
- 🛠️ **Behoben**: Viersprachige Lokalisierung (DE, EN, FR, ES) für alle neuen Steuerelemente und Tooltips.

## 🌟 Version 22.6.3 (Freie Rechnungspositionen & Direktauswahl aus Lagerbestand)
- 🚀 **Neu**: Volle Flexibilität bei Rechnungspositionen – Positionen können nun als freier Text (z. B. Beratung, Montage, individuelle Dienstleistungen) direkt eingetippt oder wahlweise aus dem Warenlager mit Live-Bestandsanzeige übernommen werden.
- 🚀 **Neu**: Schnell-Aktionsbuttons im Positionseditor: `+ Freie Position` und `+ Artikel aus Lager` für blitzschnelles Hinzufügen.
- 🔄 **Verbessert**: Intelligente Bestandsbuchung – Freitext-Positionen werden beim Festschreiben der Rechnung automatisch ohne Lagerabzug verbucht, während mit dem Lager verknüpfte Artikel weiterhin automatisch ausgebucht werden.
- 🛠️ **Behoben**: Vollständige Viersprachigkeit (Deutsch, Englisch, Französisch, Spanisch) für alle neuen Positionsfelder, Platzhalter und Statushinweise.

## 🌟 Version 22.6.2 (Behebung des DOM-Portal-Fehlers & Sicheres Root-Mounting)
- 🛠️ **Behoben**: Fehler `Target container is not a DOM element` im Artikelmodul (`ProductsModule`) behoben – fehlendes `document.body`-Ziel beim Erstellen/Bearbeiten von Artikeln per Portal ergänzt.
- 🔄 **Verbessert**: Sicheres Einhängen des React-Roots (`main.tsx`) mit Prüfung auf DOM-Bereitschaft zur Vermeidung von Hydrations-Konflikten.

## 🌟 Version 22.6.1 (Null-Safety Härtung für QR-Etiketten, Modale & Startmenü)
- 🛠️ **Behoben**: Laufzeitfehler `Cannot read properties of null (reading 'name')` vollständig behoben – Modaldialog zur QR- & Barcode-Etikettenerstellung (`ProductLabelModal`) stürzt bei nicht ausgewähltem Artikel nicht mehr ab.
- 🔄 **Verbessert**: Defensive Null-Prüfung bei der QR-Code-Generierung und bedingtes Rendering im Artikelmodul (`ProductsModule`).
- 🛠️ **Behoben**: Zusätzliche Absicherung gegen noch nicht initialisierte Unternehmensdaten (`company?.name`) im Einstellungsmenü und im Desktop-Startmenü.

## 🌟 Version 22.6.0 (Zahlungs-Hub, Live-Synchronisation, SMTP & Transparenter Rechnungsversand)
- 🚀 **Neu**: Eigene Kategorie "Zahlungsmethoden & Terminals" in den Einstellungen – Bankverbindung, Kartenterminals und E-Mail-Konfiguration übersichtlich gebündelt statt im allgemeinen Profil versteckt.
- 🔄 **Verbessert**: Sofortige Live-Aktualisierung in der gesamten App – Änderungen an Bankverbindung oder Kartenterminal werden beim Speichern unmittelbar in Rechnungen, Zahlungsdialoge und EPC-QR GiroCodes übernommen.
- 🔄 **Verbessert**: Transparenter, echter Rechnungsversand – keine Schein-Versandbestätigungen mehr; Rechnungen werden wahlweise über das lokale E-Mail-Programm (`mailto:`), als `.eml`-Datei oder über hinterlegte eigene SMTP-Zugangsdaten übermittelt.
- 🛠️ **Behoben**: Vollständige Viersprachigkeit (Deutsch, Englisch, Französisch, Spanisch) für alle neuen Zahlungsoptionen, Statushinweise und Erklärungen.

## 🌟 Version 22.5.8 (Dynamische Sprachsynchronisation, Dropdown-Auswahlmodul & Zahlungsdatenschutz)
- 🚀 **Neu**: Dynamische Live-Erkennung für Sprachdateien – Änderungen an `.json`-Dateien im Ordner `languages/` werden sofort ohne Neustart in SOCDOF geladen und im Dropdown zur Verfügung gestellt.
- 🚀 **Neu**: Ergonomisches Sprachauswahl-Modul mit Dropdown in der oberen Menüleiste (TopBar), im Einstellungsmenü und im modalen Sprachdialog.
- 🔄 **Verbessert**: Authentische Flaggen-Darstellung ohne KI-Grafiken – Priorisierung von benutzerdefinierten Flaggenbildern im Ordner `languages/flags/`, echten Länder-Emojis und einer schwarzen Flagge mit Fragezeichen als Standard-Fallback.
- 🛠️ **Behoben**: Maskierung sensibler Kartendaten (`1234 ******`) im Rechnungszahlungs-Dialog; Kartenzahlung wird erst angezeigt, wenn sie in den Einstellungen aktiviert wurde.

## 🌟 Version 22.5.7 (Rechnungserstellung & Fenster-Parameter-Orchestrierung)
- 🛠️ **Behoben**: Der Button "Neue Rechnung" öffnet nun sofort das Erstellungsfenster und generiert automatisch die nächste fortlaufende Rechnungsnummer.
- 🔄 **Verbessert**: Fenster-Orchestrierung im Desktop-Workspace erweitert – "Rechnung erstellen" aus Kontakten, Lagerbuchungen oder Support-Tickets öffnet das Rechnungsmodul direkt mit vorausgewählten Kundendaten.
- 🚀 **Neu**: Direkteingabe für Kunden im Rechnungsformular, falls noch keine Kontakte im Adressbuch angelegt sind.
- 🛠️ **Behoben**: Modaldialog für Lagerbuchungen (Stock Moves) auf autarke Zustandsverwaltung gehärtet.

## 🌟 Version 22.5.6 (Backup-Ordner SOCDOF/backups & Direkter Abschluss)
- 🚀 **Neu**: Automatisches Vorbereiten und Anlegen des Verzeichnisses `Dokumente/SOCDOF/backups` direkt beim Programmstart.
- 🔄 **Verbessert**: Die Ordnerauswahl öffnet sich direkt im `SOCDOF`-Ordner, sodass der Unterordner `backups` sofort sichtbar und wählbar ist.
- 🛠️ **Behoben**: Das Backup-Einrichtungsfenster kann nun nach Ordnerauswahl (oder sofort mit dem vorbereiteten Pfad) direkt über den neuen Button "Einrichtung abschließen & Backups aktivieren" abgeschlossen werden – kein Überspringen mehr nötig!
- 🚀 **Neu**: "Im Explorer öffnen"-Button direkt im Backup-Fenster und in den Einstellungen für schnellen Dateizugriff.

## 🌟 Version 22.5.5 (Automatischer /SOCDOF Installationsordner & Start-Optimierung)
- 🚀 **Neu**: Automatisches Anlegen und Anhängen des `/SOCDOF`-Ordners bei der Pfadauswahl im Windows-Setup (`build/installer.nsh`) – kein versehentliches Entpacken ins Hauptverzeichnis mehr möglich.
- 🛠️ **Behoben**: Behebt das Einfrieren ("Reagiert nicht" / "Keine Rückmeldung") nach Klick auf "Fertigstellen" durch Single-Instance-Lock und geschütztes Start-Handling.
- 🔄 **Verbessert**: Schnellerer, flüssiger Anwendungsstart durch verzögerte Hintergrunddienste und optimierte Fensterinitialisierung.

## 🌟 Version 22.5.4 (Professionelles Taschenrechner-Design & Übersichtliches Layout)
- 🚀 **Neu**: Windows-inspiriertes Modus-Auswahlmenü direkt in der Titelleiste – schneller Wechsel zwischen Standard- und Wissenschaftlichem Modus per Dropdown mit klaren Erklärungen.
- 🔄 **Verbessert**: Klares, professionelles Tasten-Design mit erhöhtem Kontrast, feinen Rändern und abgerundeten Ecken (`rounded-xl`), sodass Tastenfelder sofort übersichtlich und intuitiv erfassbar sind.
- 🔄 **Verbessert**: Schlanke, elegante Speicher-Leiste (MC, MR, M+, M-, MS) im modernen Windows 11-Stil, die mehr Raum für Display und Tasten freigibt.
- 🔄 **Verbessert**: Flexible Nebeneinander-Ansicht für den wissenschaftlichen Modus (Tastenfelder links & rechts) mit praktischem Umschalt-Button in der Symbolleiste.

## 🌟 Version 22.5.3 (Taschenrechner Mindestgröße & Überlappungsschutz)
- 🛠️ **Behoben**: Feste Mindestgröße für den Taschenrechner (`minWidth: 320px`, `minHeight: 480px`) eingeführt – das Fenster kann nicht mehr so klein gezogen werden, dass Tasten überlappen oder Titel abgeschnitten werden.
- 🛠️ **Behoben**: Tasten-Raster im wissenschaftlichen Rechner gegen Überlappungen gehärtet (`grid-template-rows` mit flexibler Zellhöhenbegrenzung).
- 🔄 **Verbessert**: Automatische Korrektur von zu klein gespeicherten Fenstergrößen beim Start.

## 🌟 Version 22.5.2 (Discord Webhook, Skalierung des Taschenrechners & Sprachpaket-Update)
- 🚀 **Neu**: Intelligente Erkennung von Discord-Forum-Kanälen – erstellt bei Webhooks in Foren automatisch einen strukturierten Ankündigungs-Post.
- 🔄 **Verbessert**: Dynamische Schriftgrößen-Skalierung im wissenschaftlichen Rechner – Tasten wie `2nd`, `sin`, `cos`, `tan`, `log`, `ln` wachsen nun proportional mit der Fenstergröße mit und bleiben nicht mehr klein.
- 🔄 **Verbessert**: Alle Taschenrechner-Texte und -Funktionen wurden vollständig in die Sprachpaket-Dateien (`public/languages/` de, en, fr, es, template_en) synchronisiert.
- 🔄 **Verbessert**: Klare Diagnose-Logs in GitHub Actions (zeigt Webhook-ID und Ziel-Thread ohne geheime Token preiszugeben).
- 🛠️ **Behoben**: Zuverlässige Kanal-Zustellung ohne unerwünschte automatische Fehlweiterleitung in fremde Kanäle.

## 🌟 Version 22.5.1 (App Store Bereinigung & Einzeilige Button-Anordnung)
- 🔄 **Verbessert**: Bereinigter App Store Header – unschöne Badge-Pills ("Modulverwaltung") und doppelte Begriffe entfernt, klarer Fokus auf "App Store" und "App-Pakete".
- 🔄 **Verbessert**: Perfekt ausgerichtete, einzeilige Button-Leiste in den Paket-Karten – einheitliche Höhe (`h-10`), harmonische Abstände und aufgeräumte Optik.
- 🛠️ **Behoben**: Verwirrenden, losgelösten Play-Button in den Paketkarten entfernt.
- 🛠️ **Behoben**: Ungerade App-Listen in Paket-Karten füllen nun die gesamte Zeile aus, sodass keine leeren Lücken mehr entstehen.

## 🌟 Version 22.5.0 (Taschenrechner-Widget, App Store Bereinigung & Desktop Farbverläufe)
- 🚀 **Neu**: Interaktives Taschenrechner-Widget direkt auf dem Desktop für Sofortrechnungen, Kopieren per Klick und Schnellzugriff auf die Voll-App.
- 🔄 **Verbessert**: Moderne Desktop-App-Icons mit lebendigen Farbverläufen (`bg-gradient-to-br`), identisch zum Design im App Store.
- 🔄 **Verbessert**: Bundle-Aktivierung im App Store müllt den Desktop nicht mehr mit Icons voll – Apps stehen im Startmenü und Suchmenü bereit.
- 🛠️ **Behoben**: Veraltete Terminal- und Kartenzahlungs-Banner im App Store Header komplett entfernt für eine aufgeräumte Modulverwaltung.
- 🛠️ **Behoben**: Taschenrechner ist nun offiziell als Standard-Systemwerkzeug registriert.

## 🌟 Version 22.4.0 (Schul- & Wissenschaftlicher Taschenrechner & Overlay-Modus)
- 🚀 **Neu**: Dual-Modus Taschenrechner mit Standard- und Wissenschaftlichem Modus (Schule/MINT: Trigonometrie `sin`/`cos`/`tan`, Logarithmen `log`/`ln`, Potenzen, Wurzeln, Fakultät `n!`, Konstanten `π` und `e`).
- 🚀 **Neu**: Always-on-Top / Overlay-Modus (Fenster-Pin) – hält den Rechner wie in Windows dauerhaft im Vordergrund über allen anderen Arbeitsfenstern.
- 🔄 **Geändert**: Flüssige dynamische Skalierung – Tastenfeld und Displaygröße passen sich stufenlos jeder Fenstergröße an (kompakt ab 260px Breite).
- 🔄 **Geändert**: Tastentöne folgen automatisch den zentralen Audio-Einstellungen des Systems (Einstellungen -> Töne & Feedback).
- 🔄 **Verbessert**: Vollständige Einbindung in das "Schule & Bildung"-Bundle im App Store sowie nahtlose 4-Sprachen-Lokalisierung (DE, EN, FR, ES).
