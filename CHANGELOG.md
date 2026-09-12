# 📝 Pending Updates / Changelog
<!-- 
Updates written here accumulate across versions and are broadcast to Discord on the next release or workflow run.
Once sent, the workflow automatically resets this file so you can accumulate the next batch of updates.
Format guidelines:
- Keep it concise: what is new, what changed/improved, what was fixed.
- Avoid exhaustive UI/visual layout breakdowns.
-->

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
