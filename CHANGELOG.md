# 📝 Pending Updates / Changelog
<!-- 
Updates written here accumulate across versions and are broadcast to Discord on the next release or workflow run.
Once sent, this file is automatically reset so you can accumulate the next batch of updates.
Format guidelines:
- Keep it concise: what is new, what changed/improved, what was fixed.
- Avoid exhaustive UI/visual layout breakdowns.
-->

## 25.2.20

- 🛠️ **Geändert / Changed**: The installer language list is limited to German, English, French and Spanish.
- 🛠️ **Geändert / Changed**: The installer no longer offers a free install-folder choice; the folder is fixed by the installer.

## 25.2.19

- 🛠️ **Behoben / Fixed**: Portable start no longer crashes with `spawn powershell.exe ENOENT` when PowerShell cannot be launched.
- 🛠️ **Behoben / Fixed**: "Passwort vergessen" works for accounts whose recovery questions are stored in the newer list format.

## 25.2.18

🔧 **Geändert / Changed**
- Benutzerverwaltung: Das Kontotyp-Badge (Privat/Geschäftlich) nutzt jetzt übersetzte Texte statt zusammengesetzter Wörter.
- Der Hinweis zum Auto-Login-Schritt ist vollständig übersetzt ("Öffnen" / "Open" / "Ouvrir" / ("Öffnen" / "Open" / "Ouvrir" / "Abrir").

## 25.2.17

🚀 **Neu / What's New**
- New users: the temporary password step shows a password strength bar, like the first-time setup.

🔄 **Geändert / Improved**
- Clicking Create jumps to the step with the missing or invalid field, and that field is framed in red.

## 25.2.16

🛠️ **Behoben / Fixed**
- The "Konto wiederherstellen" screen and the other login screens follow the saved Light or Dark mode, also before login.

## 25.2.14

🛠️ **Behoben / Fixed**
- "Passwort vergessen" no longer shows a blank screen. The recovery form opens correctly.

## 25.2.13

🛠️ **Behoben / Fixed**
- Password recovery shows all security questions of the account, not only the first one.
- The admin add-user form wraps into two columns on small screens.

## 25.2.12

🛠️ **Behoben / Fixed**
- The power menu (Ein/Aus) in the start menu opens as a layer above the start menu and no longer pushes the content below it.

🔄 **Geändert / Improved**
- The multi-user merge rules for the portable / NAS version are documented in `INSTRUCTIONS.md` (section 9). The merge itself is not yet implemented.

## 25.2.11
- **Fixed:** Closing an in-app window now locks the app window controls (minimize, fullscreen, close) for 2 seconds instead of 3. In-app window controls are no longer locked.

## 25.2.10
- **Fixed:** The user-management tabs now wrap onto a second line on narrow windows instead of being cut off (e.g. "Sicherheitsrichtlinien").

## 25.2.9
- **Fixed:** The minimize, maximize and close buttons of in-app windows are locked for 3 seconds after one click, as the desktop window controls already are, to prevent accidental clicks.

## 25.2.8
- **Fixed:** The tabs of the user management overlap on small screens. The tabs now scroll horizontally instead of squeezing their labels.

## 25.2.7
- **Fixed:** The first administrator no longer has to set a new password at the first login. Existing accounts are corrected once on start.

## 25.2.6
- **Changed:** New users get a "Temporäres Passwort" field without a security question. Required fields are marked with a red asterisk and turn red when empty on "Weiter".
- **Changed:** At the first login the user sets a new password and one or more security questions. Eight preset questions are available, and a custom question can be added.

## 25.2.5
- **Fixed:** The language selection on the first start follows the system colour scheme right away instead of only after clicking "Weiter".
- **New:** The first administrator account setup shows a "Kontoeinrichtung" label in all four languages.
- **Fixed:** The first administrator is no longer asked to set a new password right after creating the account. Accounts created later by an administrator still have to change their temporary password.

## 25.2.4
- **New:** The login screen has an X button in the top right. The desktop top bar also has the X, minimize and fullscreen buttons. Closing the app asks "Möchtest du die App wirklich schließen?" first.
- **Improved:** After a window is closed, minimize and fullscreen are disabled for 3 seconds. Clicking the X during that time asks "Bist du sicher, dass du schließen möchtest?" instead of closing immediately.

## 25.2.3
- **Fixed:** The wrong-password message on the login screen appears in a reserved slot below the password field, so the buttons no longer move when it shows.

## 25.2.2
- **Improved:** The Benutzer & Konten settings are cleaner. The tab bar keeps a fixed size, the account list shows the number of current accounts, and "Neue Benutzer hinzufügen" sits at the bottom as the clear entry point for new users. Account type and role cards are aligned.

## 25.2.1
- **Improved:** The first start of the portable version shows a progress loading screen in your system language while the data folder is prepared. Later starts open directly without the splash.
