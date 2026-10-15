# 📝 Pending Updates / Changelog
<!-- 
Updates written here accumulate across versions and are broadcast to Discord on the next release or workflow run.
Once sent, this file is automatically reset so you can accumulate the next batch of updates.
Format guidelines:
- Keep it concise: what is new, what changed/improved, what was fixed.
- Avoid exhaustive UI/visual layout breakdowns.
-->

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
