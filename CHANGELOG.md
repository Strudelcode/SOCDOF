# 📝 Pending Updates / Changelog
<!-- 
Updates written here accumulate across versions and are broadcast to Discord on the next release or workflow run.
Once sent, this file is automatically reset so you can accumulate the next batch of updates.
Format guidelines:
- Keep it concise: what is new, what changed/improved, what was fixed.
- Avoid exhaustive UI/visual layout breakdowns.
-->

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
