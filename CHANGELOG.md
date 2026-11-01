# 📝 Pending Updates / Changelog
<!-- 
Updates written here accumulate across versions and are broadcast to Discord on the next release or workflow run.
Once sent, this file is automatically reset so you can accumulate the next batch of updates.
Format guidelines:
- Keep it concise: what is new, what changed/improved, what was fixed.
- Avoid exhaustive UI/visual layout breakdowns.
-->

## 25.2.22

- 🛠️ **Behoben / Fixed**: The update download fails cleanly instead of hanging when the connection drops, stalls for 60 seconds, redirects too often or delivers an incomplete file. A partial installer is never started.

## 25.2.21

- 🛠️ **Geändert / Changed**: The update download shows a remaining-time estimate based on the smoothed measured download speed, instead of a fixed guess. Until enough data is measured it shows "Calculating remaining time...".
- 🛠️ **Behoben / Fixed**: If `powershell.exe` cannot start during an update, the installer is opened directly instead of the update silently failing.

## 25.2.20

- 🛠️ **Geändert / Changed**: The installer language list is limited to German, English, French and Spanish.
- 🛠️ **Geändert / Changed**: The installer no longer offers a free install-folder choice; the folder is fixed by the installer.

