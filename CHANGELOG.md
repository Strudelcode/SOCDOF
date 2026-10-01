# 📝 Pending Updates / Changelog
<!-- 
Updates written here accumulate across versions and are broadcast to Discord on the next release or workflow run.
Once sent, this file is automatically reset so you can accumulate the next batch of updates.
Format guidelines:
- Keep it concise: what is new, what changed/improved, what was fixed.
- Avoid exhaustive UI/visual layout breakdowns.
-->

### v24.2.0
- 🚀 **Neu / What's New**:
  - **Beratungs-Timer im Klienten-Dossier / Consultation Timer**: Start/Stop-Timer pro Klient in der Praxis & Therapie-Ansicht – läuft bei Fensterwechsel und App-Neustart zuverlässig weiter (lokale Persistenz) und zeigt die Laufzeit live an.
  - **Schnell-Sitzungsnotiz als Bottom Sheet / Quick Session Note**: Nach dem Stoppen des Timers öffnet sich ein mobiles Erfassungsformular für Intervention & Verlaufsnotiz – die Sitzungsdauer wird automatisch aus dem Timer übernommen und in den Sitzungsverlauf gebucht.
  - **Live-Fensteranpassung / Window Auto-Fit**: Werden Fenster oder Bildschirm schmaler als Smartphone-Breite, maximieren sich alle offenen Fenster sofort auf die volle Breite statt abgeschnitten zu werden. Beim Verbreitern kehren sie in ihre zuletzt genutzte Größe zurück.
- 🛠️ **Behoben / Fixed**:
  - **Doppelte Tagesansicht im Kalender behoben / Duplicate Day View Fix**: Auf schmalen Fenstern wurde die Desktop-Tagesliste zusätzlich zur neuen mobilen Stunden-Agenda angezeigt – nun rendert nur noch die passende Ansicht.
- 🔄 **Geändert / Improved**:
  - **Durchgängige 4-Sprachigkeit / Full Quad-Language Coverage**: Alle neuen Praxis-, Timer- und Notiz-Oberflächen sind vollständig auf Deutsch, Englisch, Französisch und Spanisch lokalisiert.
  - **Web-Vorschau-Parität / Web Preview Parity**: Einstellungen zeigt im Browser einen Hinweis-Banner zu den Oberflächen, die nur in der Windows-App anders funktionieren – Update-Installation und Backup-Ordner-Auswahl haben bereits vollwertige Web-Fallbacks, sodass die App 1:1 im Browser getestet werden kann.

  - **Dynamisches Dashboard mit Anti-Clash-Farben / Dynamic Dashboard & Anti-Clash Colors**: KPI-Karten, Filter und Listen-Akzente im Dashboard folgen live der gewählten Akzentfarbe; Sekundärkennzahlen (Kassenumsatz, Lagerwert) nutzen bewusst die Kontrast-Begleitfarbe. Neu: Kassenumsatz-KPI und ein Schnell-Startcenter mit 1-Tap-Aktionen (Rechnung, Kassenverkauf, Kontakt, Lagerbuchung) – vollständig viersprachig.

### v24.1.0
- 🚀 **Neu / What's New**:
  - **Mobile Tagesagenda mit Stundenmarkern / Mobile Day Agenda**: Die Tagesansicht des Kalenders zeigt auf schmalen Fenstern und Smartphones eine Stundenleiste (07:00 – 22:00) mit einspaltiger Agenda. Leere Zeitslots sind direkte Schnell-Anlege-Ziele: ein Tap öffnet das neue Termin-Bottom-Sheet mit vorausgefülltem Datum und Uhrzeit.
  - **Schnell-Termin-Erstellung als Bottom Sheet / Quick Appointment Creation**: Mobiles Erstellformular als Bottom Sheet mit Touch-optimierten Eingabefeldern (min. 44px), Dauer-Schnellwahl (15m–2h, Ganztägig), Kategorien und Zielspeicher-Auswahl (Google Kalender oder lokale Datenbank) – alles direkt aus der Agenda heraus.
  - **Floating Quick-Add Button & Nächster-Termin-Leiste**: Immer erreichbarer runder "+"-Button sowie eine kompakte Karte mit dem nächsten anstehenden Termin direkt in der mobilen Tagesansicht.
  - **Mobile Zeiterfassungs-Widget & Ticket-Karten / Time-Tracking Widget & Ticket Cards**: Das Support-Modul zeigt auf kompakten Fenstern ein dunkles Live-Zeiterfassungs-Widget (inkl. laufendem Timer mit Pulsdarstellung) und ersetzt die Desktop-Tabelle durch touchfreundliche Ticket-Karten mit Status-Badges, Kundenzuordnung, erfassten Stunden und Direktaktionen.
- 🔄 **Geändert / Improved**:
  - **Responsive Support-Kopfleiste**: Primäre Aktionen (Neues Ticket, Mobile Sync) schrumpfen auf schmalen Fenstern automatisch zu platzsparenden Icon-Buttons.

### v24.0.0
- 🚀 **Neu / What's New**:
  - **Handy- & Kompaktfenster-Layout / Mobile-Window Responsive System**: Zieht man ein Fenster in SOCDOF auf eine schmale Smartphone-Breite oder nutzt die App auf Touchscreens, schaltet das Layout automatisch auf ein optimiertes Handy-Layout um.
  - **Mobiles Login & Sperrbildschirm / Mobile-Optimized Auth & Lock Screen**: Der Windows 11 Sperrbildschirm, die Benutzer-Auswahl und der Anmeldedialog passen sich nahtlos an schmale Bildschirme und Handys an – mit optimierter Uhr-Typografie, One-Touch-Wischgeste nach oben und responsiven Touch-Schaltflächen (mind. 44px).
  - **Mobile Kartenansicht für Rechnungen, Produkte, Einkauf & Kontakte**: In schmalen Fenstern schalten Daten-Tabellen automatisch auf übersichtliche Touch-Karten mit Direktaktionen (PDF Drucken, Bezahlen, Buchen, Anrufen, E-Mail) um.
  - **Mobile POS-Kassenansicht mit Express-Checkout-Leiste**: Ermöglicht schnelles Umschalten zwischen Produktkatalog und Warenkorb sowie eine 1-Tap Kassenabwicklung auf kompakten Bildschirmen.
- 🛠️ **Behoben / Fixed**:
  - **React Render-Cycle Synchronisation behoben / Clean Effect State Updates**: Behebt eine Warnung (`Cannot update a component while rendering a different component`), indem Appearance- und Sprach-Initialisierungen (`setLanguage`, `applyAccentColor`) in `AccountScopedWorkspace` strikt in `useEffect`-Hooks ausgeführt werden und redundante Listener-Trigger vermieden werden.
  - **Kollision mit virtueller Bildschirmtastatur auf Smartphones behoben / Mobile Keyboard Collision Fix**: Wenn auf Handys das Passwort-Eingabefeld angetippt wird und die Bildschirmtastatur hochklappt, überlappt der „Passwort vergessen?“-Link nicht mehr mit der Benutzerleiste. Das gesamte Anmeldefenster nutzt ein flexibles `min-h-[100dvh]`-Layout mit sanftem Scrollbereich.
  - **Keine horizontale Überbreite mehr auf Mobilgeräten / Mobile Viewport Auto-Fit**: Beim Öffnen von Fenstern auf Smartphones und schmalen Bildschirmen (< 768px) passen sich Fenster automatisch auf 100% Bildschirmbreite und -höhe an, anstatt auf 920px Desktopbreite zu klemmen.
- 🔄 **Geändert / Improved**:
  - **Touch-Freundlichkeit & Formular-Skalierung**: Sämtliche Authentifizierungs- und Eingabefelder im Sperrbildschirm skalieren ohne horizontales Abschneiden auf 100% Breite mit verbesserter Tastaturbedienung.

### v23.19.1
- 🚀 **Neu / What's New**:
  - **Intelligente Kontrast-Begleitfarbe für Diagramme & Doppelbalken / Smart Anti-Clash Companion Colors**: Wenn zwei Vergleichsdaten nebeneinander dargestellt werden (z. B. Umsatz vs. Sitzungen in Praxis & Therapie oder bezahlt vs. offen im Dashboard), berechnet das System automatisch eine harmonische, kontrastierende Begleitfarbe (`--accent-companion`). Wählt der Nutzer z. B. Grün/Smaragd als Akzentfarbe, wechselt die zweite Serie automatisch zu einem eleganten Indigo-Violett statt ebenfalls grün zu sein. Bei Orange/Gold wechselt sie zu Cyan/Türkis. Zwei Datenreihen sehen dadurch niemals mehr gleich aus.
  - **Dezenter Akzentfarben-Glow auf Karten & Umrandungen / Subtle Ambient Accent Glow**: Alle Apps und Module (Praxis & Therapie, Rechnungen, POS Kasse, Kundenbuch, Lager, BWA, Kalender etc.) besitzen nun auf allen Karten, Containern und Umrandungen einen dezenten, edlen Schimmer in der in den Einstellungen gewählten Akzentfarbe. Beim Hovern hebt sich der Glow sanft an, und fokussierte Formularfelder leuchten in einem passenden Akzentring – DIN-Ausdrucke bleiben garantiert unbeeinflusst.
  - **Unabhängig scrollbare Einstellungsleiste & Inhaltsbereich / Independent Dual-Scroll Layout**: Die linke Navigationsleiste der Einstellungen und der rechte Inhaltsbereich besitzen nun jeweils eigene, unabhängige Scrollbereiche (`overflow-y-auto`). Beim Durchscrollen umfangreicher Einstellungsseiten bleibt die linke Menüleiste stets sichtbar und kann separat bedient werden, ohne dass die andere Seite mitverschoben wird.
  - **Tastenkombinationen & Kürzel-Tab in den Einstellungen / Keyboard Shortcuts Hub**: Neuer Bereich in den Einstellungen (*System & Personalisierung*), der alle globalen Shortcuts der App übersichtlich und kategorisiert anzeigt (Feedback, Systemnavigation, Taskleiste, virtuelle Desktops, Sicherheit) – inklusive Echtzeit-Tastatursuche und interaktiver „Jetzt testen“-Schaltflächen.
  - **Sofortige Melde-Hotkeys für Feedback / Global Reporting Hotkeys**:
    - `Alt + B`: Öffnet sofort das Bug-Meldefenster mit vorbefüllten Diagnosedaten von überall in der App.
    - `Alt + I`: Öffnet direkt das Eingabefenster für Feature-Ideen und Vorschläge.
    - `Alt + R`: Direkter Aufruf des Feedback- und Ticket-Verlaufs.
  - **Dynamische Akzentfarben-Harmonie & Desktop-Aura / Dynamic Accent Color Aura**: Die in den Einstellungen gewählte Akzentfarbe (z. B. Indigo, Aubergine, Cyber Blue, Smaragdgrün, Sunset Gold oder benutzerdefinierte Picasso-Farbe) wird nun lebendig und geschmackvoll im gesamten Desktop integriert: aktive Fenster mit 2,5px oberer Akzentlinie, dezentem Titelbalken-Verlauf, Icon-Ringen, Aero-Snap-Docks, Spotlight-Auswahl und sanfter Mica-Desktop-Aura.
  - **Live-Vorschaukarte in der Personalisierung / Live Accent Preview**: Interaktive Miniatur-Vorschaukarte in den Farbeinstellungen, die Fensterleiste, Primäraktionen und Badges in der gewählten Akzentfarbe in Echtzeit demonstriert.
- 🛠️ **Behoben / Fixed**:
  - **Entfernung des unscharfen Farbnebels am oberen Fensterrand / Clean Header & Titlebar Clarity**: Der störende radiale Farbverlauf oberhalb der Navigationsleiste sowie Titelbalken-Farbverläufe wurden vollständig entfernt. Der Fenster-Header und die Navigationsleiste sind nun kristallklar, sauber und blendfrei – der Akzentfarben-Glow wirkt präzise und elegant ausschließlich auf den tatsächlichen Kanten und Karten.
  - **Dauerhafte Speicherung der Schriftgröße / Persistent Font Scaling**: Änderungen am Schriftgrößen-Regler (90% bis 130%) und 100%-Reset werden nun sofort und dauerhaft im lokalen Speicher (`localStorage`) sowie in der Datenbank gesichert. Auch nach einem Neustart oder Schließen des Fensters bleibt die gewählte Skalierung verlässlich erhalten – ohne Flackern beim Laden.
- 🔄 **Geändert / Improved**:
  - **Augenfreundliche Arbeitsfläche / Ergonomic Surface Warmth**: Ablösung von grellem Reinweiß durch sanfte, ruhige Oberflächenkontraste (`#f6f8fb`), die die Augen bei langen Arbeitstagen schonen.
  - **Kollisionsfreie Tastenerkennung / Safe Key Isolation**: Globale Tastenkombinationen sind sauber gegen AltGr-Tastenbelegungen isoliert, sodass Texteingaben in Formularen ungestört bleiben.

### v23.18.13
- 🛠️ **Behoben / Fixed**:
  - **Direkte Windows-Übertragung ohne Localhost-Abhängigkeit / Direct Windows HTTPS Dispatch**: In der Windows-Desktop-App (`.exe`) werden Berichte nun über den Electron-Hauptprozess direkt per nativem HTTPS an `api.botghost.com` gesendet – völlig unabhängig von lokalen Webservern, Ports oder Localhost-Diensten.
  - **Echte Sendebestätigung für Tickets / Verified Delivery Status**: Ein Ticket wird in der Ticketliste nur dann als „Erfolgreich gesendet“ markiert, wenn BotGhost den Empfang mit `HTTP 200` bestätigt hat. Bei Netzwerkfehlern oder Serverausfall wird der Bericht sicher in der Warteschlange abgelegt und transparent als offline gekennzeichnet.
- 🚀 **Neu / What's New**:
  - **BotGhost Projekt- & Kategorie-Filtervariablen / BotGhost Filter Variables**: Jeder Bericht übermittelt nun automatisch `{webhook.project}` (`SOCDOF`) sowie `{webhook.report_category}` (`bug` bzw. `idea`), womit Berichte in BotGhost präzise in die passenden Kanäle sortiert werden können.

### v23.18.12
- 🛠️ **Behoben / Fixed**:
  - **Echte Discord-Übertragung & Fehlerdiagnose / Verified Discord Bot Transmission**: Fehlerberichte und Feedback aus der App werden nun über den integrierten Localhost-Proxy und die offizielle Discord-Bot-API direkt als Forum-Threads im Discord-Server erstellt.
  - **Keine Scheinerfolgsmeldungen mehr / Zero False Positives**: Ein Ticket meldet nun nur dann „Erfolgreich gesendet“, wenn Discord den Thread mit HTTP 200/201 bestätigt hat. Bei fehlendem Token oder Offline-Zustand wird der Grund transparent angezeigt und das Ticket lokal als Warteschlange markiert.
- 🚀 **Neu / What's New**:
  - **Bot-Token Konfigurationsleiste / In-App Discord Bot Setup**: Im Kopfbereich des Bug-Report-Fensters kann der Discord-Bot-Token direkt hinterlegt und auf Gültigkeit geprüft werden.

### v23.18.11
- 🛠️ **Behoben / Fixed**:
  - **Scroll-Blockade im Handbuch behoben / Handbuch Smooth Scrolling**: Das Dokumentationsportal reagiert nun wieder einwandfrei auf Mausrad und Scrollleisten. Die innere Flexbox-Höhe wurde korrigiert (`h-full min-h-0`), sodass keine Inhalte mehr unterhalb des Fensterrands festhängen.
  - **Deplatzierte Karte „Praxis & Therapie“ entfernt / Removed Misplaced Header Card**: Die versehentlich oberhalb der Titelleiste platzierte Einzelkarte wurde entfernt. Das Portal startet nun wieder sauber mit der Standard-Kopfzeile und Version.
- 🚀 **Neu / What's New**:
  - **Saubere Modul-Integration für Praxis & Therapie / Proper Module Chapter & Showcase**: Das Modul „Praxis & Therapie“ ist nun als eigenständiges Handbuch-Kapitel mit Workflow-Anleitung sowie als Modul-Kachel in der Showcase-Übersicht ordentlich integriert.

### v23.18.10
- 🔄 **Geändert / Improved**:
  - **Exklusiver Release-Broadcast über Discord-Bot / Exclusive Discord Bot Release Broadcast**: Die alten Webhooks wurden vollständig aus den GitHub-Actions entfernt und deaktiviert. Release-Changelogs werden nun verlässlich und direkt über die offizielle Discord-Bot-API in den definierten Forum-Post übertragen.
  - **Fehlerbehandlung bei fehlenden Secrets / Fail-Fast Configuration Validation**: Fehlen `DISCORD_BOT_TOKEN` oder `DISCORD_THREAD_ID` in den GitHub-Secrets, bricht das Skript kontrolliert mit einer klaren Fehlerdiagnose ab, anstatt unerwünschte Webhooks aufzurufen.

### v23.18.9
- 🚀 **Neu / What's New**:
  - **Adaptives Bildschirm-Layout für Rechnungsvorlagen / Adaptive Screen Layout**: Auf kompakten Bildschirmen (< 1280px) ermöglicht eine schlanke Umschaltleiste den nahtlosen Wechsel zwischen „Layout-Editor“ und „Dokument-Vorschau“. Auf großen Bildschirmen (>= 1280px) werden beide Bereiche übersichtlich nebeneinander dargestellt, während die Leiste automatisch ausgeblendet wird.
  - **Zoom-Steuerung für Beleg-Vorschau / Preview Zoom Controls**: Interaktives Stufen-Zooming (60% bis 130%) mit 100%-Reset für eine optimale Dokumentenansicht auf jeder Bildschirmauflösung.
- 🔄 **Geändert / Improved**:
  - **Discord-Bot-Unterstützung für Forum-Posts / Discord Bot Forum Posts**: Die Release-GitHub-Actions unterstützen nun das automatische Posten direkt in einen spezifischen Discord-Forum-Thread über einen Discord-Bot-Token inklusive automatischem Reaktivieren (Unarchive) archivierter Threads.
- 🛠️ **Behoben / Fixed**:
  - **Dark-Mode-Korrekturen im Auswahlmenü / Selection Menu Dark Mode Fixes**: Austausch nativer Browser-Dropdowns durch stilvolle, themengerechte Auswahlelemente mit Lucide-Icons. Dadurch werden unlesbare hellblaue Optionsmenüs mit weißer Schrift in dunklen Designs vollständig verhindert.
  - **Originalgetreue DIN A4 Papier-Vorschau / Protected Paper Sheet**: Verhinderung von ungewollten Farb-Invertierungen des Belegbogens im Dark Mode für ein realistisches, druckgetreues Erscheinungsbild.

### v23.18.8
- 🚀 **Neu / What's New**:
  - **Präsenter Lade-Indikator beim Senden / Prominent Transmission Banner**: Beim Klick auf „Senden“ erscheint sofort ein animierter Lade-Statusbalken („Wird an Discord gesendet... Bitte warten“) mit Spinner, während alle Eingaben gesperrt werden, um doppeltes Senden zu verhindern.
- 🛠️ **Behoben / Fixed**:
  - **Echte Discord-Erfolgsbestätigung / Verified Live Delivery**: Erst wenn der Beitrag tatsächlich und nachweislich auf Discord veröffentlicht wurde, erscheint die grüne „Gesendet!“-Erfolgsmeldung. Bei Verbindungsabbrüchen wird transparent über die Offline-Warteschlange informiert und bei Fehlern eine detaillierte Fehlermeldung angezeigt.

### v23.18.7
- 🔄 **Geändert / Improved**:
  - **Wiederherstellung des alten Webhooks / Restored Previous Webhook**: Rücksetzung der BotGhost Webhook-URL und Standard-Token-Einstellungen auf den vorherigen Zustand (`t5dcd2k8x1n8i53932gf`).

### v23.18.6
- 🚀 **Neu / What's New**:
  - **Neuer BotGhost Webhook & API Token / Updated Webhook URL & Token**: Aktualisierung der BotGhost Webhook-URL (`9mvtuh5aaf65v4ipqlilqu`) und des BG API-Tokens (`17450aaada2fde267b22f9f917094d13e38c8ba7b51a4df047719f0fd1877089`) für reibungslose und authentifizierte Discord-Berichte.

### v23.18.5
- 🛠️ **Behoben / Fixed**:
  - **Senden von Reports in der Desktop-App (Electron) / Desktop App Report Dispatch**: Berichte aus der Windows-Desktop-App heraus schlugen fehl, da Electron-Renderer-Anfragen an externe Webhooks blockiert wurden.
  - **Node.js HTTPS Webhook IPC Bridge & net.fetch / Electron IPC Webhook Bridge**: Hinzufügen des IPC-Handlers `socdof:discord-webhook` in `electron/main.cjs` mittels `net.fetch` und nativem Node.js `https`-Modul (inklusive automatischem Redirect-Handling). Damit senden Bug- und Feature-Reports aus der installierten Desktop-App heraus zuverlässig und ohne Blockaden an Discord.
