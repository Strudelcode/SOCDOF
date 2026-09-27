# 📝 Pending Updates / Changelog
<!-- 
Updates written here accumulate across versions and are broadcast to Discord on the next release or workflow run.
Once sent, this file is automatically reset so you can accumulate the next batch of updates.
Format guidelines:
- Keep it concise: what is new, what changed/improved, what was fixed.
- Avoid exhaustive UI/visual layout breakdowns.
-->

### v23.18.3
- 🛠️ **Behoben / Fixed**:
  - **Beseitigung von Binär-Müll ("Krypto-Zeichen") / Pure Text Extraction**: Der Fallback liest Binärdateien (wie veraltete Word `.doc`-Dateien oder komprimierte Streams) nicht mehr fälschlicherweise als Rohtext ein. Beseitigt unverständliche Steuerzeichen (`ÐÏ11à¡±á...`).
  - **Smarte Text- & Variablen-Filterung für alte `.doc`-Dateien / Clean Stream Filtering**: `extractPrintableTextFromBinaryBuffer` filtert lesbaren deutschen Text, Wörter und Variablen-Tags (`{Rechnungsnummer}`, `{Kunde_Name}`, `{Gesamtbetrag}`) gezielt heraus und strukturiert sie in sauberen `<p>`-Absätzen.
  - **Sofortige Vorschau ohne DOM-Blockade / Instant Lightweight Preview**: Durch sauberes HTML ohne Millionen ungültiger Steuerzeichen rendert die Live-Vorschau blitzschnell und stotterfrei.

### v23.18.2
- 🛠️ **Behoben / Fixed**:
  - **Vollständig entkoppelte Hintergrund-Verarbeitung / Non-Blocking Micro-Tasks**: Das Parsen von Dokumenten (`.docx`, `.pdf`) wird nun in Asynchron-Häppchen unterteilt. Durch automatisches Yielding an den Event-Loop (`setTimeout 0`) bleibt die Webseite zu 100% flüssig und ansprechbar. Die Meldung „Die Seite reagiert nicht“ wird somit vollständig verhindert.
- 🚀 **Neu / What's New**:
  - **Live Status-Fortschritt im Import-Feld / Real-Time Extraction Status**: Zeigt während des Einlesens präzise Teilschritte an (`"Analysiere Word XML-Struktur & Tabellen im Hintergrund..."`, `"Extrahiere Vorlagen-Variablen..."`), sodass der Anwender transparent über die Hintergrundverarbeitung informiert wird.

### v23.18.1
- 🛠️ **Behoben / Fixed**:
  - **Verhinderung von Hängern & Abstürzen beim Datei-Import / Non-Blocking File Extraction**: Ersetzung rekursiver `getElementsByTagName`-Abfragen durch eine direkt-gezielte Knoten-Inspektion (`getDirectChildrenByTagName`). Schließt unendliche DOM-Schleifen bei verschachtelten Word-Tabellen (`.docx`) aus.
  - **Sicherer PDF-Parser & Timeout-Schutz / PDF Inline Parsing**: Deaktivierung externer PDF-Webworker (CORS/CDN-Sperre) und Absicherung mit einem 10-Sekunden Timeout-Versprechen.
- 🔄 **Geändert / Improved**:
  - **Visueller Lade-Indikator & Datei-Reset / Loading Feedback**: Während des Einlesens von Vorlagendateien wird ein Ladespinner angezeigt ("Vorlagendatei wird analysiert & extrahiert..."). Das Datei-Eingabefeld wird nach Abschluss zurückgesetzt, damit beliebige Dateien beliebig oft nacheinander ausgewählt werden können.

### v23.18.0
- 🚀 **Neu / What's New**:
  - **Vollständiger XML-Parser für Word-Dokumente (.docx) / High-Fidelity DOCX XML Parsing**: Rechnungs- und Briefvorlagen im Microsoft Word-Format (`.docx`) werden nun inklusive ihrer vollständigen Tabellenstruktur (`<w:tbl>`, `<w:tr>`, `<w:tc>`), Spaltenbreiten, Tabellenrahmen, Zell-Hintergründen, Textausrichtungen (`<w:jc>`) und Kopf-/Fußzeilen (`word/header1.xml`, `word/footer1.xml`) ausgelesen.
- 🔄 **Geändert / Improved**:
  - **Smarte Positionstabellen-Ersetzung / Smart Item Table Substitution**: Mehrfach gestapelte Platzhalter-Absätze (z.B. einzeln aufgelistete Spaltenüberschriften wie `Pos.`, `Bezeichnung`, `Menge`, `Einzelpreis`, `MwSt`, `Gesamt`) vor `{Positionen_Tabelle}` werden automatisch zusammengefasst.
  - **Saubere 1:1 Live-Vorschau / Clean Table Rendering**: `{Positionen_Tabelle}` wird aus umschließenden `<p>`-Tags entpackt und rendert als eigenständige, responsive HTML-Tabelle mit perfekter visueller Treue in Live-Vorschau, Druck und PDF-Export.

### v23.17.0
- 🛠️ **Behoben / Fixed**:
  - **Bereinigung von Emojis aus Auswahl-Menüs / Clean Option Labels**: Emojis wurden vollständig aus den Dropdown-Optionen für die Bereichsauswahl (`Design, Logo, Farben & Typografie`, `Texte, Titel & Belegangaben`, etc.) entfernt.
  - **Festes Fenster ohne Rahmen-Scrollen / Fixed Window Bounds**: Durch striktes `overflow-hidden` auf allen Container-Ebenen bleibt der Fensterrahmen absolut stabil, während Scrollen rein intern im Formular oder Dokument geschieht.
- 🔄 **Geändert / Improved**:
  - **Kompakter 2-Button Umschalter unten / Clean Mobile View Switcher**: Der Ansichts-Umschalter für kleine Bildschirme zeigt ausschließlich die zwei Buttons `[ Editor ]` und `[ Live-Vorschau ]` ohne Emojis oder überflüssige Optionen. Auf großen Bildschirmen wird der Umschalter ausgeblendet und automatisch Split-View angezeigt.

### v23.16.5
- 🛠️ **Behoben / Fixed**:
  - **Bereinigung von Emojis & Doppel-Buttons / Minimalist Layout**: Alle Emojis sowie der überflüssige „Beides (Split-View)“-Button wurden aus dem Rechnungs-Editor entfernt.
  - **Aufgeräumter Header / Clean Header Bar**: Entfernung des doppelten Umschalters aus der Kopfzeile.
- 🚀 **Neu / What's New**:
  - **Automatischer Desktop Split-View & Kompakte 2-Button Umschaltung / Pure Responsive Layout**: Auf Desktop-Bildschirmen wird automatisch immer die vollständige Nebeneinander-Ansicht (Split-View) angezeigt. Auf kleineren bzw. schmaleren Fenstern erscheint unten eine aufgeräumte 2-Button Leiste (`[ Editor ]` / `[ Live-Vorschau ]`), ohne Emojis oder überflüssige Steuerungen.

### v23.16.3
- 🛠️ **Behoben / Fixed**:
  - **Kein Fenster-Scrollen auf dem Bildschirm / Fixed Backdrop Overflow**: Auf dem Hintergrund-Overlay der Modals wurde `overflow-hidden` erzwungen, sodass Fenster beim Scrollen im Editor oder in der Vorschau nicht mehr unruhig auf dem Bildschirm nach oben/unten verrutschen.
- 🚀 **Neu / What's New**:
  - **Editor & Live-Vorschau Ansichts-Umschalter / Responsive View Modes**: Neuer Ansichts-Umschalter (`[ ✏️ Editor ]` / `[ 👁️ Live-Vorschau ]` / `[ ↔️ Nebeneinander ]`) in Kopf- und Fußzeile des Rechnungs-Editors. Erlaubt beliebiges Umschalten zwischen voller Editor-Breite und großer, lesbarer DIN-A4-Vorschau.

### v23.16.2
- 🛠️ **Behoben / Fixed**:
  - **Vordergrund-Layering & Taskbar-Abstand / Foreground Z-Index & Taskbar Clearance**: Rechnungs-Modals (`InvoiceTemplateModal`, `InvoicePrintModal`, `InvoiceEmailModal`, `PaymentModal`) nutzen nun `z-[999999]` und einen dynamischen Taskleisten-Sicherheitsabstand unten (`pb-16`/`pb-20`), sodass Fußzeilen und Speicher-Buttons nicht mehr von der Windows-Taskleiste verdeckt werden.
- 🔄 **Geändert / Improved**:
  - **Aufgeräumtes Sub-Tab Grid im Layout-Editor / Non-Scrolling Sub-Tabs**: Ersetzung der überfüllten horizontalen Scrollleiste durch ein übersichtliches 2-zeiliges Segmented-Grid-Control (`Design & Logo`, `Texte`, `Firmendaten` / `Variablen`, `Datei-Import`). Kein Hin- und Herschrollen oder Textabschneiden mehr.

### v23.16.1
- 🚀 **Neu / What's New**:
  - **Dynamische Forum-Tags Abfrage / Discord Channel Tags API**: Das System fragt nun über die Discord API (`GET /channels/{channel_id}`) in Echtzeit alle im Forum-Kanal verfügbaren Tags (`available_tags`) mit ID, Namen und Emoji ab.
  - **Automatische Tag-Zuordnung / Dynamic Tag Resolution**: Bei neuen Bug-Reports und Vorschlägen wird dynamisch der passende Tag ermittelt (z. B. „Neue Einreichung“, „Pending“ oder der primäre Kanal-Tag), auch wenn Tags auf dem Discord-Server umbenannt oder angepasst werden.
- 🔄 **Geändert / Improved**:
  - **Robuste Ausfallsicherheit**: Nahtlose Synchronisation über Backend-Proxy, direkte Discord REST API und lokale Fallbacks.

### v23.16.0
- 🚀 **Neu / What's New**:
  - **Anonyme Bug-Reports & Feedback / Anonymous Mode**: Die Angabe des Discord-Namens ist nun optional. Bleibt das Namensfeld leer, wird der Bericht automatisch und sauber als „Anonym“ (`@Anonym`) erfasst und dargestellt.
  - **Automatische Versions- & Spracherkennung / App Version & Language Metadata**: Bug-Reports und Vorschläge übertragen nun automatisch die aktuelle SOCDOF Software-Version (z. B. `SOCDOF v23.16.0`), die eingestellte App-Sprache (z. B. `Deutsch (DE)`) sowie die Systemsprache des PCs (z. B. `de-DE`).
  - **Echtes Discord-Bot Profil im Embed / Dynamic Bot Identity**: In der Live-Vorschau wird nun dynamisch der echte Bot-Name (z. B. `StrudelTeam - Bot`) sowie das tatsächliche Discord-Avatarbild des Bots angezeigt statt statischer Platzhalter.
- 🔄 **Geändert / Improved**:
  - **Optimiertes Discord-Embed Layout**: Strukturierte Darstellung von Fehlerort, Beschreibung und 3-spaltigem Metadaten-Raster für Version und Sprachen.
  - **Viersprachige Lokalisierung**: Alle Platzhalter und Hinweise für den anonymen Modus sind auf Deutsch, Englisch, Französisch und Spanisch hinterlegt.

### v23.15.0
- 🚀 **Neu / What's New**:
  - **Offline-Warteschlange für Bug-Reports & Feedback / Offline Feedback Queue**: Berichte können nun auch vollständig offline oder bei temporären Bot-Ausfällen abgesendet werden. Sie werden lokal in der Warteschlange gespeichert und automatisch an Discord übertragen, sobald wieder eine Verbindung besteht.
  - **Exakter Erfassungszeitpunkt / Exact Creation Timestamp**: Der genaue Zeitpunkt, an dem die Meldung offline erfasst wurde, bleibt erhalten und wird im Discord-Beitrag transparent dargestellt (`🕒 Ursprünglich offline erfasst am`).
- 🔄 **Geändert / Improved**:
  - **Automatischer Hintergrund-Sync / Automatic Online Sync**: Die App erkennt automatisch, wenn man wieder online ist (oder beim App-Start / Fenster-Fokus) und sendet ausstehende Offline-Tickets selbstständig an Discord.
  - **Manueller Sofort-Senden-Button**: In der Ticket-Historie können Berichte aus der Warteschlange bei Bedarf auch per Klick sofort an Discord übertragen werden.
  - **Freundliche Info-Banner**: Ersetzt Fehlermeldungen durch verständliche Hinweise zur Offline-Warteschlange in allen 4 Sprachen (DE, EN, FR, ES).

### v23.14.5
- 🛠️ **Behoben / Fixed**:
  - **Discord-Name selbst eingeben / User Discord Handle**: Beim Erstellen von Bug-Reports wird der Name nicht mehr standardmäßig mit Entwickler-Namen vorbefüllt, sondern muss vom Nutzer selbst eingetragen werden. Inklusive Validierungs-Hinweis vor dem Absenden.
  - **Discord-Bot Status & Offline-Meldung**: Das Status-Badge prüft den Bot nun in Echtzeit („Discord-Bot online“ / „Discord-Bot offline“). Ist der Bot offline, wird das Absenden gesperrt und ein deutlicher Hinweis angezeigt, dass der Bot im Normalfall innerhalb von maximal 10 Minuten wieder online ist.
- 🔄 **Geändert / Improved**:
  - **Status manuell aktualisieren**: Ein neuer Aktualisieren-Button neben dem Status-Badge und im Offline-Hinweis erlaubt das sofortige erneute Prüfen der Bot-Verbindung.
  - **Vollständige Viersprachigkeit**: Alle Offline-Meldungen, Hinweise und Button-Texte wurden in Deutsch, Englisch, Französisch und Spanisch übersetzt.

### v23.14.4
- 🛠️ **Behoben / Fixed**:
  - **Ersteinrichtungs-Sprachübernahme / Onboarding Language Retention**: Bei der Ersteinrichtung ausgewählte Sprache (Deutsch) wird nun zuverlässig und dauerhaft in den Benutzer-Präferenzen, dem Firmenprofil und im Speicher hinterlegt, statt auf Englisch zurückzuspringen.
  - **Standard-Sprache Deutsch**: Das initiale Datenbank-Standardprofil wurde von Englisch auf Deutsch umgestellt, sodass beim ersten Start oder Zurücksetzen nicht fälschlicherweise Englisch forciert wird.
  - **Profil-Synchronisation & Multi-User**: Beim Anmelden und Wechseln von Benutzern wird die gespeicherte Sprache des jeweiligen Kontos nun sofort nahtlos geladen.
- 🔄 **Geändert / Improved**:
  - **Bereinigung doppelter Sprachauswahl-Modals**: Entfernung überflüssiger Modals im Hauptfenster, um Konflikte mit dem geführten AuthGate-Einrichtungsassistenten zu vermeiden.
