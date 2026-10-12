# 📝 Pending Updates / Changelog
<!-- 
Updates written here accumulate across versions and are broadcast to Discord on the next release or workflow run.
Once sent, this file is automatically reset so you can accumulate the next batch of updates.
Format guidelines:
- Keep it concise: what is new, what changed/improved, what was fixed.
- Avoid exhaustive UI/visual layout breakdowns.
-->

### v24.9.0 — One-Click Setup & Frameless Startup-Splash (wie bei Discord & Claude)

🚀 **Neu / What's New**:
- **Modernes One-Click Setup ohne weiße Dialoge**: Der alte weiße Windows-Assistent mit "Für wen soll installiert werden?", "Weiter" und "Abbrechen" wurde komplett abgeschafft. SOCDOF installiert sich per Doppelklick in 2–3 Sekunden lautlos und automatisch in `%LOCALAPPDATA%` (genau wie Discord und Claude).
- **Sofortiges Dark-Mode Startup-Splash-Fenster**: Wenn man SOCDOF startet, öffnet sich ab sofort in unter 100 ms ein kleines, edles Dark-Mode-Fenster (320×380 px) mit pulsierendem SOCDOF-Logo, animiertem Ladebalken und Status-Text ("Wird gestartet...").
- **Keine 15 Sekunden Wartezeit mehr ohne Feedback**: Man weiß sofort, dass der Klick funktioniert hat. Sobald die Haupt-App bereit ist, verschwindet das kleine Splash-Fenster geschmeidig und das Dashboard öffnet sich.

### v24.8.9 — Mehrsprachige BotGhost-Webhook-Übermittlung (Original, Deutsch & Englisch)

🚀 **Neu / What's New**:
- **Automatische Übersetzung & Text-Veredelung**: Jeder gesendete Bug-Report und Vorschlag wird vor der Weiterleitung an BotGhost automatisch in klares Deutsch (`german_...`) und Englisch (`english_...`) übersetzt, während die Originaleingabe (`original_...` und Standardvariablen) 100% erhalten bleibt.
- **Rate-Limit Schutz durch Batch-Bündelung**: Alle Textfelder (Titel, Beschreibung, Bereich, Unterbereich) werden in einer einzigen gebündelten Anfrage übersetzt – das verhindert HTTP 429 Sperren zuverlässig.
- **Anonymitäts- & Discord-Mention Erkennung**: Bei anonymen Meldungen wird automatisch `german_reported_by = (@Anonym)` und `english_reported_by = (@Anonymous)` gesetzt, während echte Discord-Pings (`<@...>`) unverändert bleiben.
- **Nahtloses, gestochen scharfes Header-Banner (Option 1)**: Der obere Header im Installer besitzt ab sofort einen reinweißen Hintergrund (`#FFFFFF`), sodass der harte schwarze Kastenrand komplett verschwindet. Mit 4x Supersampling und Lanczos-Filter gerendert für kristallklare Darstellung ohne jegliche Pixelkanten auf High-DPI und 4K Bildschirmen.
- **Komplette 8-Wege-Variablen-Matrix**: Alle Variablen stehen in BotGhost als Lang- und Kurzform sowie als Top-Level-JSON-Felder zur Verfügung.

### v24.8.8 — Custom Download-Hub & Hintergrund-Update-Fenster ("Updating to Version...")

🚀 **Neu / What's New**:
- **Custom NSIS Deinstallations- & Installations-Design**: Das altbackene blaue Standard-Laptop-Banner im Windows-Deinstaller wurde durch ein edles, dunkles SOCDOF-Branding-Banner (`uninstallerSidebar.bmp` & `installerSidebar.bmp`) ersetzt – inklusive Datensicherheits-Hinweis und Strudelcode-Signatur.
- **Maßgeschneiderter Download-Screen & Setup-Begleiter**: Neuer, interaktiver Download-Hub für SOCDOF Desktop mit direktem .EXE-Installer Download, animiertem Fortschrittsbalken und 4-stufiger Schritt-für-Schritt-Anleitung.
- **Windows SmartScreen Hilfestellung**: Anschauliche visualisierte Erklärung für den Windows Defender SmartScreen Hinweis ("Weitere Informationen" -> "Trotzdem ausführen") für eine reibungslose Erstinstallation.
- **Natives Hintergrund-Update-Fenster ("Updating to Version...")**: Wenn sich SOCDOF Desktop für ein automatisches Update schließt, erscheint ab sofort ein rahmenloses, modernes Updater-Fenster, das den Status in Echtzeit anzeigt, bis die neue Version automatisch startet.
- **Live-Vorschau im Browser**: Das Update-Fenster kann über den neuen Button *Update-Fenster testen* direkt im Web-Workspace und Handbuch simuliert und erlebt werden.

### v24.8.7 — Handbuch-Erweiterung & Schneller Doppel-Hauptversions-Modus (V24 & V23)

🚀 **Neu / What's New**:
- **8 neue Handbuch-Kapitel**: Das Handbuch wurde um ausführliche Erklärungen erweitert: *Artikel & Lagerwirtschaft*, *Einkauf & Lieferanten*, *Gastronomie-Suite & Tischplan*, *Kaufmännischer Rechner & Preiskalkulation*, *Desktop-Widgets & Taskleiste*, *App Store & Modularität*, *Rechnungs-Sync & Kassenbuch*, sowie *Power-User Shortcuts & Multi-Window*.
- **Standard-Filter auf Neueste (V24 & V23)**: Der Changelog lädt standardmäßig gezielt die zwei neuesten Hauptversions-Zyklen (V24 & V23). Das verhindert DOM-Last komplett und sorgt für seidenweiches 60fps-Scrollen.
- **Ältere Versionen per Klick nachladen**: Über den Button *Ältere Versionen (V22, V21...) anzeigen* oder *Alle Versionen* können jederzeit alle 240+ Versionen eingesehen werden. Bei der Stichwortsuche wird weiterhin sofort das gesamte Versionsarchiv durchsucht.

### v24.8.6 — Handbuch: Changelog-Performance & Schrittweises Laden

🚀 **Neu / What's New**:
- **Schrittweises Laden im Handbuch (Changelog)**: Statt alle 240+ Versionen auf einmal ins DOM zu rendern, lädt das Handbuch standardmäßig die neuesten 15 Versionen. Dies verhindert Ruckler, beschleunigt den Tab-Wechsel und spart spürbar Rechenleistung.
- **Mehr Versionen laden**: Über Buttons am Ende der Liste (*Mehr Versionen laden (+20)* und *Alle laden*) können ältere Versionen jederzeit flüssig nachgeladen werden.
- **Intelligente Suche & Hauptversions-Filter**: Bei einer Suche oder Klick auf eine Hauptversion (*v24.x*, *v23.x* etc.) werden stets sofort alle passenden Treffer angezeigt.

### v24.8.5 — Dropdown-Menüs: 100% Deckkraft & Solider Vordergrund

🛠️ **Behoben / Fixed**:
- **Keine halb-transparenten Dropdowns mehr**: Popover- und Dropdown-Menüs (*Rechnungs-Sync*, *Mehr/Weiteres*) sind nun strikt von den transluzenten Frostglas-Regeln des Ambient-Designs ausgenommen. Sie besitzen 100% Deckkraft (`opacity: 1`), einen soliden Hintergrund und volle Schärfe im Vordergrund.
- **Kein Durchscheinen des Hintergrunds**: Karten, Textfelder und Tabellen im Hintergrund scheinen nicht mehr durch das geöffnete Dropdown-Menü durch. Auch innere Statusboxen und Umschalter bleiben blickdicht und kontrastreich.

### v24.8.4 — Praxis-App: Vordergrund-Ebene & Toolbar-Ausrichtung

🛠️ **Behoben / Fixed**:
- **Z-Index & Vordergrund des Dropdown-Menüs**: Durch eine saubere Stacking-Context-Ebene (`z-40` für die Leiste, `z-0` für den Hauptinhalt) überdecken Dashboard-Aktions-Pills (`+ Neuer Klient`), Kennzahlen-Karten und Tabellen-Umschalter das geöffnete `Rechnungs-Sync`-Menü nicht mehr – das Menü liegt nun vollständig im Vordergrund.
- **Menü- und Button-Ausrichtung in der Praxis-App**: Der Tabellen-Button (*Kassenbuch / Excel*) liegt nun links neben den Rechnungs-Aktionen direkt an den Modul-Reitern. Der Button *Rechnungs-Sync* ist ganz rechts verankert, sodass das Menü bündig aufklappt und durch Klick außerhalb sauber schließt.

### v24.8.3 — Automatische Anmeldung (Direkt zum Desktop), Single-User Schutz & Discord Channel-Klartext

🚀 **Neu / What's New**:
- **Automatische Anmeldung (Direkt zum Desktop)**: In den Einstellungen kann unter *Sicherheitsrichtlinien* die automatische Anmeldung aktiviert werden. Beim Start der Anwendung wird der Anmeldebildschirm übersprungen und sofort der persönliche Desktop geöffnet – ohne erneute Passworteingabe.
- **Single-User Schutz & 2. Benutzer Sperre**: Die automatische Anmeldung steht nur zur Verfügung, wenn genau ein Benutzer registriert ist. Solange die Option aktiv ist, kann kein zweiter Benutzer angelegt werden (gesperrte Buttons, Warnhinweise im Formular und Sicherheitsprüfung im System).
- **Schnellzugriff bei manuellem Logout**: Wird sich bewusst abgemeldet, bietet der Anmeldebildschirm einen 1-Klick-Button, um sofort wieder zum Desktop zurückzukehren.

🔄 **Geändert / Improved**:
- **Standardisierte Discord-Kanalbeschriftung**: Der Ideen- und Feedback-Kanal wurde von stilisierter Kapitälchen-Schrift auf sauberen Klartext umgestellt (`#💡idea-suggestions`), einheitlich über Formulare, Übersichten und Embed-Vorschauen.

### v24.8.2 — Kontakte: Firmen-Modus mit Unterkontakten, getrennte Vor-/Nachnamen & Länder-Autovervollständigung

🚀 **Neu / What's New**:
- **Firmen-Eingabe ohne Personenzwang**: Beim Anlegen eines Kontakts kann nun ausschließlich der Firmenname (`Fa.`) eingetragen werden – kein erzwungener Einzelpersonen-Name mehr nötig.
- **Unterkontakte / Kontaktpersonen für Firmen**: Zu jeder Firma können beliebig viele Ansprechpartner (z. B. für Geschäftsführung, Einkauf, Buchhaltung) mit Vorname, Nachname, E-Mail-Adresse und Durchwahl hinterlegt und als Hauptkontakt markiert werden.
- **Aufgeteilte Felder für Vor- & Nachname**: Sowohl bei Einzelpersonen als auch bei Firmen-Unterkontakten sind die Felder für Vorname und Nachname sauber getrennt.
- **Live-Ländervorschläge bei Tastatureingabe**: Bei Eingabe der ersten Buchstaben im Feld *Land* schlägt die Anwendung passende Länder mit Flaggen, lokalisierten Namen und ISO-Kürzeln vor (inkl. Tastaturnavigation per Pfeiltasten und Enter).

🔄 **Geändert / Improved**:
- **Kontakt-Details mit Unterkontakten**: Die Detailansicht listet alle zugehörigen Ansprechpartner einer Firma übersichtlich mit Schnellaktionen für E-Mail, Anruf und 1-Klick-Kopieren.
- **Erweiterte Suche über Ansprechpartner**: Die Adressbuch- und Kunden-Suche findet Firmen nun auch sofort über die Vor-/Nachnamen, E-Mails, Telefonnummern oder Rollen ihrer Mitarbeiter.

### v24.8.1 — Reports: App-Icon & GUI-Feinschliff

🚀 **Neu / What's New**:
- **Neues dediziertes Reports App-Icon**: Ein hochauflösendes, modernes Squircle-Icon mit dynamischem Farbverlauf und Micro-Badge (`DynamicReportsIcon`), abgestimmt für Desktop, Taskleiste, Startmenü und Fenster-Kopfzeilen.
- **Einheitliche Modulbeschriftung "Reports"**: Der zuvor lange und umbrechende Text ("Bug-Reports & Meldungen") wurde systemweit in allen 4 Sprachen (DE, EN, FR, ES) auf das prägnante "Reports" verkürzt – keine abgeschnittenen Zeichen oder unschöne Auslassungspunkte mehr.

🔄 **Geändert / Improved**:
- **Prominenter Discord-Kontakt im Assistenten**: Die optionale Kontaktbox in Schritt 3 ist nun mit einem auffälligen Badge (`★ OPTIONAL & EMPFOHLEN`) versehen, damit Rückfragen zum Report direkt auf dem Discord-Server geklärt werden können.
- **Responsives Split-Layout**: Die permanente Live-Vorschau wird nun bereits ab mittleren Bildschirm- und Fensterbreiten (`md`) direkt neben dem Formular angezeigt.

### v24.8.0 — Reports: 3-Schritte-Assistent, permanente Live-Vorschau & Discord-Kontakt

🚀 **Neu / What's New**:
- **Geführter 3-Schritte-Assistent für Reports**: Einreichungen erfolgen nun in einem übersichtlichen Ablauf:
  - **Schritt 1**: Schnellauswahl des Berichtstyps (🐛 *Bug / Fehler*, 💡 *Idee / Vorschlag*, 💬 *Feedback & Meinung*).
  - **Schritt 2**: Eingabe von Titel, betroffener App/Modul (inkl. praktischem App-Picker) und ausführlicher Beschreibung.
  - **Schritt 3**: Überprüfung und Absenden mit optionalem Discord-Kontakt.
- **Permanente Live-Vorschau**: Die Discord-Embed-Vorschau wird nun über alle 3 Schritte hinweg direkt neben den Eingaben angezeigt und aktualisiert sich live bei jedem Tastendruck.
- **Hervorgehobener Discord-Kontakt**: Ein **fett hervorgehobener Hinweis** empfiehlt die optionale Angabe des Discord-Namens oder der User-ID, damit das Entwickler-Team direkt im Server-Ticket antworten oder bei Rückfragen pingen kann.

🛠️ **Behoben / Fixed**:
- **Desktop- & Fenster-Icon GUI-Fehler behoben**: Veraltete CSS-Ring-Stile in Fenster-Kopfzeilen entfernt, die zu dunklen Kontur-Artefakten führten. Desktop-Symbole trennen nun den Aktivitäts-Balken sauber von der Beschriftung und unterstützen zweizeiligen Textumbruch ohne hässliches Abschneiden.

### v24.7.9 — Praxis: App-Icon & Kopfbanner GUI-Fehler behoben

🛠️ **Behoben / Fixed**:
- **App-Icon Darstellungsfehler im Kopfbanner behoben**: Das Icon im Praxis-Kopfbanner war bisher in einer blassen, transluzenten Glashülle mit weiß-auf-weißem Kontrast und unleserlichen Raster-Artefakten gefangen. Es ist nun als solide weiße Kachel mit gestochen scharfem Icon in der Akzentfarbe umgesetzt.
- **Offizielles Praxis-Symbol vereinheitlicht**: Das generische Bürogebäude (`Building2`) im Banner wurde durch das offizielle medizinische Praxissymbol (`Hospital` mit Kreuz-Symbol) ersetzt, passend zum App-Launcher und den Desktop-Fenstern.
- **Farbverläufe im Launcher**: Die Praxis-Verknüpfungen nutzen nun einen harmonischen Blau-/Indigo-Verlauf statt störendem Türkis.

### v24.7.8 — Praxis & Design: Harmonische Farbbalance, Beseitigung aller Grünstiche & GUI-Feinschliff

🛠️ **Behoben / Fixed**:
- **Unerwünschte Grün- & Türkistöne auf der rechten Bildschirmseite beseitigt**: Alle fest codierten Teal-/Grün-Elemente in der Praxis-App (`+ Sitzung`, `Timer`, Notiz-Buttons, Sitzungskarten und Kennzahlen) dynamisch an die vom Nutzer gewählte Akzentfarbe angebunden.
- **Harmonische Begleitfarbe ohne Farbkollisionen**: Bei warmen Farben (wie *Sunset Gold*, *Bernstein*, *Orange*, *Rot*) wird als Kontrastfarbe für Diagramme nun ein elegantes Indigo statt knalligem Cyan/Grün berechnet.
- **Unruhige Diagrammbalken behoben**: Bei Monaten, in denen nur Umsatz oder nur Sitzungen vorliegen, halten dezent verankerte Basis-Indikatoren die Spalten sauber in Reih und Glied.

🔄 **Geändert / Improved**:
- **Sanfterer, dezenterer Hintergrund-Farbverlauf**: Die Deckkraft der radialen Hintergrundverläufe und Ambiente-Auren wurde auf eine wohltuende, unaufdringliche Aquarell-Nuance reduziert – kein grelles Fleckenmuster mehr.
- **Einheitliche KPI-Kachelgrößen**: Alle Kennzahl-Boxen besitzen nun exakt dasselbe ausgewogene Innenmaß (`p-3.5 sm:p-4`).

### v24.7.7 — Praxis: Einheitliche Aktions-Buttons & Layout-Optimierung

🚀 **Neu / What's New**:
- **Einheitliche, solide Banner-Buttons**: Alle Schnellaktionen im Praxis-Kopf (`+ Neuer Klient`, `+ Sitzung`, `+ Abrechnung`) sind jetzt konsistent als solide weiße Karten mit scharfer Akzentfarbe gestaltet – kein blasser Halb-Transparenz-Effekt mehr.
- **Diagramm-Gitterlinien**: Dezente Hilfslinien im Umsatz- und Sitzungsverlauf geben den Balken optischen Halt und Orientierung.
- **Kompakterer Aufbau für besseren Überblick**: Vertikale Abstände und Kachelhöhen optimiert, sodass Termine und Sitzungen ohne Abschneiden direkt ins Auge fallen.

### v24.7.6 — Praxis: GUI-Feinschliff & Layout-Korrekturen

🛠️ **Behoben / Fixed**:
- **Banner-Buttons & Kontrast**: Die Schnellaktions-Buttons im Praxis-Banner (`+ Sitzung`, `+ Abrechnung`) sind jetzt klar lesbar mit kontrastreichem Rahmen und aktivem Hover-Effekt versehen; der störende weiße Weichzeichner-Schleier wurde entfernt.
- **Diagramm-Balken bei 0-Werten**: Monate ohne Umsatz/Sitzungen zeigen keine schwebenden 8px-Balkenstümpfe mehr, sondern eine saubere, unauffällige Basislinie.
- **Doppelte Werte bei „Durchschnitt pro Sitzung“**: Die Unterzeile wiederholt nicht mehr denselben Betrag, sondern liefert den nützlichen Kontext (z. B. *„1 Sitzung ausgewertet“*).
- **Grammatik-Korrektur**: *„1 dokumentierte Sitzung“* (Einzahl) wird nun sprachlich korrekt dargestellt.
- **Scroll-Freiraum**: Genügend Abstand nach unten hinzugefügt, sodass anstehende Termine und letzte Sitzungen nicht mehr am unteren Fensterrand abgeschnitten werden.

### v24.7.5 — Design: Monochromer Hintergrund-Farbverlauf ohne störenden Grünstich

🛠️ **Behoben / Fixed**:
- **Grün-/Türkisstich im Hintergrund behoben**: Beim Auswählen warmer Akzentfarben (wie *Sunset Gold* oder *Rot*) erschien auf der rechten Bildschirmseite ein grünlicher/türkiser Schimmer. Dieser entstand durch die automatische Begleitfarbe für Diagramme und wurde aus dem Hintergrund-Farbverlauf entfernt.
- **Einheitliche Farbwärme**: Der dezente Hintergrund-Farbverlauf leitet sich nun zu 100% harmonisch aus der gewählten Akzentfarbe ab (z. B. warmes Gold/Pfirsich bei *Sunset Gold*).

### v24.7.4 — Design: Sanfter verschwommener Farbverlauf im Hintergrund & Frosted-Glass Optik

🚀 **Neu / What's New**:
- **Leichter verschwommener Farbverlauf im Hintergrund**: Anstelle von harten Kontrastlinien sorgt ein dezenter, weichgezeichneter Farbverlauf in der gewählten Akzentfarbe im Hintergrund für eine warme, angenehme Atmosphäre ohne steriles Weiß.
- **Elegante Frosted-Glass Karten & Kästchen**: Boxen und Karten erhalten eine dezente transluzente Glas-Optik mit sanften, ruhigen Rändern, durch die der Hintergrund-Farbverlauf dezent durchscheint.
- **Ambiente-Atmosphäre in der Praxis-App**: Dezente verschwommene Farb-Auren im Praxis-Modus harmonieren dynamisch mit der Akzent- und Begleitfarbe.
- **Live-Vorschau in den Einstellungen**: Schalter unter *Einstellungen -> Personalisierung & Farben* mit direkter visueller Status-Vorschau (standardmäßig deaktiviert, dauerhaft gespeichert).

🔄 **Geändert / Improved**:
- Harte Kontrast-Umrandungen wurden durch beruhigende, sanfte Übergänge ersetzt.
- Selektoren im Design-System optimiert, sodass der Ambiente-Farbverlauf verlässlich in allen App-Fenstern greift.

### v24.7.3 — Design: Farbiger Kontrast-Modus für alle Apps (Weniger Weiß & Mehr Farbe)

🚀 **Neu / What's New**:
- **Farbiger Kontrast-Modus für alle Apps**: Der Farbmodus wurde auf die gesamte SOCDOF Desktop-Suite ausgeweitet (Rechnungen, Buchhaltung, Praxis, Kontakte, Artikel & Lager, Kalender, Kasse etc.).
- **Sanfte Farbtönung statt sterilem Weiß**: Fenster-Hintergründe erhalten eine harmonische Akzent-Tönung, während Kästchen, Karten und Metrik-Kacheln mit sanften Pastell-Farbverläufen und farbigen Akzent-Rahmen hervorgehoben werden.
- **Druck & PDF geschützt**: Druckbare Rechnungen und Dokument-Vorschauen bleiben für den einwandfreien Export auf sauberem reinem Weiß.
- **Einfach in den Einstellungen**: Schalter unter *Einstellungen -> Personalisierung & Farben* (standardmäßig deaktiviert, dauerhaft gespeichert).

### v24.7.2 — Praxis: Farbiger Praxis-Modus (Weniger Weiß & Mehr Farbe/Kontrast)

🚀 **Neu / What's New**:
- **Farbiger Praxis-Modus (Optional)**: Neuer Schalter unter *Einstellungen -> Personalisierung & Farben*, um den Weißanteil in der Praxis-App zu verringern und stattdessen sanfte Farbnuancen und stärkere Akzent-Rahmen um Kästchen zu aktivieren (standardmäßig deaktiviert).
- **Dauerhafte Speicherung**: Die Einstellung wird über Neustarts hinweg in `localStorage` gespeichert.

