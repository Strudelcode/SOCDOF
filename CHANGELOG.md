# 📝 Pending Updates / Changelog
<!-- 
Updates written here accumulate across versions and are broadcast to Discord on the next release or workflow run.
Once sent, this file is automatically reset so you can accumulate the next batch of updates.
Format guidelines:
- Keep it concise: what is new, what changed/improved, what was fixed.
- Avoid exhaustive UI/visual layout breakdowns.
-->

### v24.10.1 — Discord-Style Installer, Crisp High-Res Graphics & Instant Splash

🚀 **Neu / What's New**:
- **Discord-Style Installer mit Install-Aktion**: `SOCDOF-Installer.exe` zeigt direkt nach dem Download ein rahmenloses Dark-Mode-Fenster mit dem hochauflösenden SOCDOF-Logo oben und einem eleganten "Installieren"-Button unten.
- **Präziser Statusablauf**: Während des Setups wird klar und deutlich "Wird installiert..." angezeigt. Erst nach erfolgreicher Fertigstellung wechselt der Status zu "Wird gestartet..." und öffnet die Desktop-App nahtlos.

🔄 **Geändert / Improved**:
- **High-End Grafik-Asset-Generierung**: Sämtliche Installer-Grafiken (`installerSplash.bmp`, `installerSidebar.bmp`, `installerHeader.bmp`) wurden in nativer High-Res-Qualität mit glatten Vektor-Konturen neu gerendert – keine pixeligen Bitmap-Fragmente mehr.
- **Sofortiger App-Start ohne Ladeverzögerung**: Schriften im HTML/Vite-Frontend laden nun nicht-blockierend mit sofortigen System-Fallbacks, sodass das Splash-Fenster und der Startvorgang in Millisekunden reagieren.

🛠️ **Behoben / Fixed**:
- **Blauer Rand- & Titelstreifen behoben**: Beseitigung aller blauen Fensterrahmen, Header-Balken und unsauberen Schnittkanten durch nahtlose `#202225`-Farbgebung und `thickFrame: false` / `titleBarStyle: 'hidden'`-Konfiguration.
- **Gestochen scharfes Logo**: Das Logo wird nun direkt als Embedded Resource im Installer-Executable eingebunden und skaliert auf allen Monitorauflösungen gestochen scharf.
