# 📝 Pending Updates / Changelog
<!-- 
Updates written here accumulate across versions and are broadcast to Discord on the next release or workflow run.
Once sent, this file is automatically reset so you can accumulate the next batch of updates.
Format guidelines:
- Keep it concise: what is new, what changed/improved, what was fixed.
- Avoid exhaustive UI/visual layout breakdowns.
-->
### v24.9.1 — Intelligente Homescreen-Download-Logik & Versions-Prüfung

🚀 **Neu / What's New**:
- **Intelligente Download-Anzeige**: Das "Herunterladen"-Banner auf dem Homescreen/Startmenü blendet sich automatisch aus, wenn die App bereits heruntergeladen oder installiert wurde.
- **Versions-abhängige Update-Erkennung**: Das Banner erscheint nur dann wieder, wenn auf GitHub tatsächlich eine neuere oder höhere Version (`vX.X.X`) verfügbar ist – dann direkt als praktischer Update-Hinweis ("Neues Update verfügbar").
- **1-Klick-Status & "Bereits installiert"-Häkchen**: Im Download-Fenster und direkt im Startmenü kann der Status mit einem Klick auf "Bereits installiert" gesetzt oder zurückgesetzt werden.

🔄 **Geändert / Improved**:
- **Dauerhafte Statusspeicherung**: Der Download- und Installationsstatus wird bei jedem Download-Klick automatisch gespeichert und sitzungsübergreifend synchronisiert.
- **Taskleisten- & Benachrichtigungs-Optimierung**: Erinnerungs-Toasts und Taskleisten-Tooltips passen sich an und nerven nicht mehr, wenn die Desktop-App bereits vorhanden ist.

---

### v24.9.0 — Echter One-Click Installer & Frameless Startup-Splash (wie bei Discord)

🚀 **Neu / What's New**:
- **Echtes frameless One-Click Setup**: Das weiße Windows-Setup-Fenster mit dem grünen Balken und der Titelleiste wurde vollständig entfernt (`SetSilent silent`). Stattdessen erscheint ein rahmenloses Dark-Mode-Splash-Fenster mit SOCDOF-Logo und Statusanzeige ("Wird installiert..."), genau wie bei Discord und Claude.
- **Sofortiger In-DOM Startup-Splash (0 ms Latenz)**: Beim Starten von SOCDOF wird der Start-Screen direkt in `index.html` gerendert. Kein schwarzer Blitz, kein zweites Fenster, kein 15-sekündiges Hängen mehr.
- **Mehrsprachige BotGhost-Webhook-Übermittlung**: Automatische Übersetzung und Textveredelung in Deutsch (`german_...`) und Englisch (`english_...`) bei vollständigem Erhalt des Originaltextes (`original_...`), geschützt vor HTTP 429 Rate-Limits durch Batch-Bündelung.
