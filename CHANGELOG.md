# 📝 Pending Updates / Changelog
<!-- 
Updates written here accumulate across versions and are broadcast to Discord on the next release or workflow run.
Once sent, this file is automatically reset so you can accumulate the next batch of updates.
Format guidelines:
- Keep it concise: what is new, what changed/improved, what was fixed.
- Avoid exhaustive UI/visual layout breakdowns.
-->

### v24.10.7 — Button Navigation Box Isolation & Dev Script Sanitization

🔄 **Geändert / Improved**:
- **Bereinigung von Karten-Glow-Selektoren**: Trennlinien (`border-t`, `border-b` etc.), Divider und Formularelemente erhalten keine vollflächigen Karten-Schatten mehr, wodurch überflüssige Box-Rahmen vermieden werden.
- **Einheitliche Button-Geometrie**: Einheitliche Tastenhöhen und Radien (`px-5 py-2.5 rounded-xl`) über alle 3 Schritte des Feedback-Wizards für ein klares, aufgeräumtes Layout.

🛠️ **Behoben / Fixed**:
- **Unerwünschte Box um Navigationsbuttons**: Der Umrandungsfehler unterhalb des Feedback-Formulars (wo der Zurück- und Weiter-Bereich von einem leuchtenden Kasten umschlossen wurde) ist vollständig behoben.
- **Dev-Server Startkonflikt**: Doppelte Port- und Host-Flags im Dev-Skript wurden entfernt, wodurch der Vite-Server beim automatischen Start reibungslos anläuft.

---

### v24.10.6 — Reports & Feedback Button Alignment, Responsive Navigation & Auto-Scroll

🔄 **Geändert / Improved**:
- **Harmonische Button-Ausrichtung**: Der „Zurück“-Button und der Senden-Button (z. B. „In Offline-Warteschlange speichern“) besitzen nun identische Höhen (`py-3`), passende Eckenradien (`rounded-2xl`) und klare Ränder für ein ausgewogenes Gesamtbild.
- **Responsive Flex-Navigation**: Umbruchschutz für alle 3 Schritte des Feedback-Wizards (`flex-col-reverse sm:flex-row`), damit lange Button-Texte auch bei kleineren Fenstern sauber dargestellt werden.
- **Automatisches Hochscrollen bei Schrittwechsel**: Beim Wechsel zwischen Schritten oder Reitern scrollt der Inhalt automatisch nach oben, sodass Hinweiskarten und Titel nicht mehr abgeschnitten werden.

🛠️ **Behoben / Fixed**:
- **GUI-Fehler im Buttonbereich**: Behebung der ungleichen Buttonhöhen und unvollständigen Randdefinitionen am unteren Ende des Einreichungs-Formulars.

---

### v24.10.5 — Enhanced SOCDOF Update Center, Push Simulation & Taskbar Tray Indicator

🚀 **Neu / What's New**:
- **Interaktive Push-Nachrichten-Simulation**: Direkte Test-Buttons im Update-Center der Einstellungen zum sofortigen Ausprobieren der dezenten Push-Nachricht unten rechts sowie des interaktiven Update-Bildschirms.
- **Taskleisten-Tray Update-Indikator**: Dynamisches Update-Icon mit pulsierendem Punkt im System-Tray der Taskleiste bei anstehenden Aktualisierungen für sofortigen Ein-Klick-Zugriff.
- **Erweiterte Update-Einstellungen**: Toggles für automatische Hintergrundprüfungen beim App-Start sowie konfigurierbare Push-Benachrichtigungen.

🔄 **Geändert / Improved**:
- **Modernisiertes Update-Center**: Neu gestaltete Statuskarten mit Anzeige der letzten Prüfung, offiziellem Release-Kanal und Datensicherheits-Garantie (100% lokaler Erhalt aller Daten).
- **Bereinigte Desktop-Einstellungen**: Veraltete und doppelte GitHub-Prüfkarten aus dem Windows-Desktop-Reiter wurden restlos entfernt.
- **Vollständige 4-Sprachen-Übersetzung**: Sämtliche neuen Optionen und Simulationstexte sind in allen 4 Sprachen (`de`, `en`, `fr`, `es`) nahtlos verfügbar.

---

### v24.10.4 — Native SOCDOF Update Center, Push Notifications & Strict Secret Isolation

🚀 **Neu / What's New**:
- **Integriertes SOCDOF Update-Center**: Neuer dedizierter Bereich „Updates & System“ in den Einstellungen (`SettingsModule.tsx`) zum Prüfen auf neue Versionen, Einsehen der installierten Version (`APP_VERSION`) und Starten der Aktualisierung.
- **Transparenter Download- & Neustart-Hinweis**: Der Update-Assistent erläutert transparent die Dauer (ca. 1 Minute für den Download) und den anschließenden automatischen System-Neustart zur Installation.
- **Dezente Push-Benachrichtigungen (Unten Rechts)**: Unaufdringliche Benachrichtigungs-Toasts in der unteren rechten Bildschirmecke informieren über bereitstehende Versionen mit Sofort-Aktionen („Später“ / „Jetzt herunterladen“).

🔄 **Geändert / Improved**:
- **Vollständige 4-Sprachen-Lokalisierung**: Alle Update-Dialoge, Statusanzeigen, Buttons und Hinweistexte sind in Deutsch (`de`), Englisch (`en`), Französisch (`fr`) und Spanisch (`es`) in `src/lib/i18n.ts` hinterlegt.
- **Eigenständige Markenidentität**: In `INSTRUCTIONS.md` verankert, dass SOCDOF eine eigenständige Suite ist und Funktionen nativ gestaltet werden, ohne als bloße Drittsystem-Kopien deklariert zu werden.
- **Bereinigte Desktop-Einstellungen**: Öffentliche GitHub-Download-Links wurden aus den App-Einstellungen entfernt; die Aktualisierung erfolgt nativ und sicher über das interne Update-Center.

🛠️ **Behoben / Fixed**:
- **Entfernung des veralteten Desktop-Setup-Modals**: Das Skript- und Installer-Auswahlfenster (`WindowsDesktopManagerModal` mit .cmd, .bat, .ps1 und .EXE Releases) sowie der zugehörige Button „Windows Starter & Scripts“ in den Einstellungen wurden restlos entfernt. Die Systemaktualisierung läuft ab sofort ausschließlich transparent und nativ über das neue interne SOCDOF Update-Center.
- **Sicherheits-Fix & Entfernung von UI-Token-Buttons**: Bot-Token-Eingaben und Konfigurations-Buttons wurden vollständig aus der Benutzeroberfläche (Reports-App und Einstellungen) entfernt. Das Discord-Bot-Token wird ab sofort strikt aus der git-ignorierten `.env`-Datei (`VITE_DISCORD_BOT_TOKEN`) bezogen und kann nicht mehr im Browser oder von Endnutzern/Bauleitern eingesehen oder manipuliert werden.
- **Update-Toast Datenübergabe**: Behoben, dass beim Klick auf „Jetzt herunterladen“ in der Toast-Benachrichtigung die Update-Informationen versehentlich zurückgesetzt wurden.
- **Dark Mode Hover Kontrast & Hydration**: Bereinigung der Textkontraste (`dark:hover:text-white`), verschachtelter Buttons und HTML-Hydration-Warnungen.

---

### v24.10.2 — Obsidian Squircle Icon, Gradient Action Button & Structured Installer Layout

🚀 **Neu / What's New**:
- **Obsidian Squircle Icon mit Ambient Glow**: Das Icon wird nun als abgerundetes Squircle (20px Radius) mit dezentem Leuchteffekt und feinem Glasrahmen gerendert – keine harten 90°-Kanten mehr.
- **Moderner Gradient-Install-Button**: Der flache Button wurde durch einen edlen Farbverlauf (Blurple zu Indigo) mit oberer Glanzkante und flüssiger Hover-Aufhellung ersetzt.
- **Strukturierte Info- & Status-Karten**: Zur Vermeidung leerer Flächen enthält der Installer nun im Bereitschaftszustand 3 klare Vorteilspunkte (100% Offline, keine Adminrechte, lokale DB) und während der Installation eine 3-stufige Fortschrittskarte.

🔄 **Geändert / Improved**:
- **Professionelle Typografie-Hierarchie**: Entfernung klobiger Pillen-Badges ("DESKTOP SUITE") zugunsten von unboxed Typografie (`OFFLINE COMMERCE & ERP SUITE`) mit typografischen Trennern.
- **Erhöhte Progress Bar**: Die dünne 4px-Linie wurde durch eine 8px abgerundete Statusleiste mit Farbverlauf und präziser Prozentanzeige ersetzt.
- **Pristine NSIS Bitmaps**: Alle 4 Bitmaps wurden mit echter Alphatransparenz und Squircle-Branding neu generiert.

---

### v24.10.1 — Discord-Style Installer, Crisp High-Res Graphics & Instant Splash

🚀 **Neu / What's New**:
- **Discord-Style Installer mit Install-Aktion**: `SOCDOF-Installer.exe` öffnet direkt ein rahmenloses Dark-Mode-Fenster (`#202225`) mit gestochen scharfem SOCDOF-Logo oben und einem abgerundeten Discord-Blurple-Button ("Installieren" / "Install").
- **Präziser Lifecycle-Statusablauf**: Beim Start der Installation wechselt die Anzeige sofort zu "Wird installiert..." mit flüssiger animierter Statusleiste. Erst wenn alle Dateien vollständig eingerichtet sind und die App startet, wird "Wird gestartet..." angezeigt.

🔄 **Geändert / Improved**:
- **High-End Grafik-Asset-Generierung**: Sämtliche Installer-Bitmaps (`installerSidebar.bmp`, `installerHeader.bmp`, `uninstallerSidebar.bmp`) wurden in nativer High-Res-Qualität mit glatten Vektor-Konturen neu gerendert – frei von pixeligen Bitmap-Artefakten.
- **Schnellerer App-Start durch Vendor-Chunk-Splitting**: Große Drittanbieter-Bibliotheken (`pdfjs-dist`, `firebase`, `@google/genai`) wurden in separate Bundles aufgeteilt, wodurch der initiale JavaScript-Payload drastisch verkleinert wurde und die App spürbar schneller lädt.
- **Sofortiger App-Start ohne Ladeverzögerung**: Schriften im HTML/Vite-Frontend laden nun nicht-blockierend mit sofortigen System-Fallbacks, sodass das Splash-Fenster und der Startvorgang in Millisekunden reagieren.

🛠️ **Behoben / Fixed**:
- **Windows .EXE Build-Fehler behoben**: Beseitigung des `electron-builder`-Validierungsfehlers (`configuration.nsis should be one of these: null`), der durch eine ungültige `installerSplash`-Option im Schema ausgelöst wurde. Der GitHub Actions Workflow baut und veröffentlicht `.exe`-Dateien nun wieder zuverlässig.
- **Blauer Rand- & Titelstreifen behoben**: Beseitigung aller blauen Fensterrahmen, Header-Balken und unsauberen Schnittkanten durch nahtlose `#202225`-Farbgebung, transparente Fensterkanten und `thickFrame: false` / `hasShadow: true`-Konfiguration.
- **Gestochen scharfes Logo**: Das Logo wird nun mit hochwertiger Bicubic-Filterung und als Embedded Resource im Installer-Executable eingebunden und skaliert auf allen Monitorauflösungen ohne Treppeneffekte.
