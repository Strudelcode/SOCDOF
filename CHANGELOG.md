# 📝 Pending Updates / Changelog
<!-- 
Updates written here accumulate across versions and are broadcast to Discord on the next release or workflow run.
Once sent, this file is automatically reset so you can accumulate the next batch of updates.
Format guidelines:
- Keep it concise: what is new, what changed/improved, what was fixed.
- Avoid exhaustive UI/visual layout breakdowns.

### v24.10.0 — Frameless Discord-Style Windows Installer & Branded Startup Splash

🚀 **Neu / What's New**:
- **Frameless Discord-Style Installer**: `SOCDOF-Installer.exe` öffnet sich direkt als minimalistisches, rahmenloses Dark-Mode-Fenster (310×380 px, 18px abgerundete Ecken) wie bei Discord – zentriertes SOCDOF-Logo, dezenter Status ("Wird installiert...") und feiner 3px Micro-Ladebalken ohne Fensterleiste oder störende Bedienelemente.
- **Nahtlose automatische Bereitstellung & Sofortstart**: Installiert leise im Hintergrund nach `%LocalAppData%\Programs\SOCDOF` und startet die Desktop-App unmittelbar nach Abschluss automatisch.
- **Discord-Style Startup-Splash**: Auch beim regulären Start von `SOCDOF.exe` erscheint das identisch gestaltete, schlanke Splash-Fenster ("Wird gestartet...") bis der Arbeitsbereich vollständig geladen ist.

🔄 **Geändert / Improved**:
- **Kompletter Verzicht auf störende Menüleisten**: Alle traditionellen Fenstertitel, Rahmen, Pfadauswahl-Boxen und Buttons wurden entfernt – exakt wie im Discord-Vorbild.
- **DPI-optimierte Darstellung & Drag-Unterstützung**: Das Installer- und Splash-Fenster lässt sich per Klick an jeder beliebigen Stelle auf dem Desktop verschieben.
