# 📝 Pending Updates / Changelog
<!-- 
Updates written here accumulate across versions and are broadcast to Discord on the next release or workflow run.
Once sent, this file is automatically reset so you can accumulate the next batch of updates.
Format guidelines:
- Keep it concise: what is new, what changed/improved, what was fixed.
- Avoid exhaustive UI/visual layout breakdowns.
-->

### v23.4.2 — Kunden-Verknüpfung mit Kontakten / Customer Picker & CRM Integration in Praxis & Therapie

🚀 **Neu / What's New**:
- **Kunden aus Kontakten auswählen / Customer Picker Integration**: Beim Anlegen oder Verknüpfen von Klienten/Patienten öffnet sich nun dasselbe praktische Menü wie bei Support und Rechnungen (`CustomerPickerModal`). Kontakte aus dem Adressbuch können durchsucht, ausgewählt und automatisch in die Praxis-Akte übernommen werden.
- **Automatisches Ausfüllen / Auto-Fill**: Name, Telefon, E-Mail, Adresse und Notizen werden beim Auswählen eines CRM-Kontakts automatisch in die Klienten-Maske eingetragen.
- **Direktes Kontakt-Bearbeiten / Inline Contact Editing**: Über ein integriertes Bearbeitungsfenster (`ContactEditModal`) können Kontaktdaten (Telefon, E-Mail, Adresse, Firma) direkt aus der Klienten-Akte oder den Buchungsmasken aktualisiert werden, ohne das Praxis-Modul verlassen zu müssen.
- **CRM-Status & Verknüpfungs-Banner / CRM Connection Hub**: In der 360°-Klientenakte und im Patienten-Erstellungsdialog zeigt ein klares CRM-Banner den Verknüpfungsstatus inklusive Schnellaktionen zum Bearbeiten, Wechseln oder Lösen der Verknüpfung.
- **Kontaktauswahl in Terminen & Abrechnung / Contact Picker across Practice Records**: Bei Terminen, Sitzungen, Abrechnungen und Fahrten können Klienten direkt über das Adressbuch gesucht oder neu verknüpft werden.

### v23.4.1 — Einheitliches Praxis-Icon & Visuelle Identität / Unified Practice Icon

🔄 **Geändert / Improved**:
- **Einheitliches Praxis-Icon / Unified Practice Iconography**: Die Diskrepanz zwischen App Store (Aktenkoffer) und Windows-Desktop (Personen-Silhouette) wurde behoben. Beide Oberflächen nutzen nun das eindeutige Praxis-Symbol (`Hospital` — Haus mit medizinischem Plus-Symbol) kombiniert mit einem beruhigenden Praxis-Farbverlauf (`Teal` bis `Indigo`).
- **Konsistente System-Präsenz / System-Wide Consistency**: Das neue Icon wird synchron auf dem Desktop, im Startmenü, in der Taskleiste, im Fenstertitel, im App Store, im App Launcher sowie in der Strg+K Befehlspalette verwendet.
- **In-App Branding**: Der Kopfbereich der Praxis- & Therapie-App enthält nun dieselbe Identitäts-Kachel neben dem Titel.

### v23.4.0 — Praxis & Therapy Interconnected Client Dossier & Cross-Module Linking

🚀 **Neu / What's New**:
- **360° Klienten-Akte / 360° Client Dossier**: Clicking any client opens a complete interactive dossier consolidating their scheduled appointments, documented sessions, billing drafts, and mileage/house visits.
- **Termin in Sitzung umwandeln / Convert Appointment to Session**: Direct action to convert any scheduled or attended appointment into a documented therapy session note with prefilled client, date, and notes.
- **Sitzung als Abrechnung / Billing Draft from Session**: Instantly generate an invoice draft from a documented session with precalculated fees and service descriptions.
- **Klienten-Filter & Schnellnavigation / Client Filters & Quick Navigation**: Added client filters to Appointments, Sessions, Billing, and Mileage views, with clickable client badges jumping straight into their dossier.

🔄 **Geändert / Improved**:
- **Client Cards & Direct Actions**: Client cards in the main list now show live counts of linked appointments (with upcoming date highlight), documented sessions, and billed totals, alongside direct "+ Termin" and "+ Sitzung" shortcuts.
- **Vollständige Lokalisierung / Full Quad-Lingual Localization**: Added all new linking labels, dossier actions, and empty states in German, English, French, and Spanish (`src/lib/i18n.ts`).

### v23.3.4 — Windows 11 Centered Password Field & User Switcher Polishing

🛠️ **Behoben / Fixed**:
- **Centered Password Field / Passwortfeld-Zentrierung**: Fixed the awkward asymmetry where the text field was shifted to the left by an external white button. The submit arrow is now seamlessly embedded inside the right side of the password field, keeping the input perfectly centered underneath the profile picture and name.
- **User Switcher & Truncation / Benutzer-Auswahl & Textkürzung**: Replaced the harsh rectangular ring outline around selected user accounts with smooth acrylic glass highlights and widened the label area so "Anderer Benutzer" is no longer cut off into "Anderer Benutz...".

### v23.3.3 — Uniform Language Dialog Sizing & Layout Stabilization

🛠️ **Behoben / Fixed**:
- **Language Dialog Sizing & Jump / Sprachauswahl-Größe**: Fixed the issue where selecting another language (e.g. Deutsch) caused the dialog box to change height and trigger an unexpected scrollbar that cut off the bottom language item.
- **Uniform Card & Button Dimensions**: Established a stable, uniform dialog height (`610px`) and fixed language button heights (`68px`) across all selection states in both the onboarding/auth flow and in-app language modal.
- **Title & Subtitle Harmonization**: Replaced the long bilingual German title (`'Sprache auswählen / Choose Language'`) with clean `'Sprache auswählen'` and balanced subtitle lengths across German, English, French, and Spanish with a reserved header height.

### v23.3.2 — Profile Picture Alignment & Centering Stabilization

🛠️ **Behoben / Fixed**:
- **Profile Picture Shift / Profilbild-Ausrichtung**: Resolved the layout bug where the avatar would occasionally slip to the left edge on the lock screen. Added strict flexbox column centering and automatic horizontal margins across all lock, login, and loading surfaces.
- **Avatar Shrink & Aspect Preservation**: Prevented profile picture squeezing and distortion across the Windows 11 Start Menu, User Management Settings, and Auth screens.

### v23.3.1 — Dynamic Language Discovery, Search Filtering & Windows-Style Toast Feedback

🚀 **Neu / What's New**:
- **Dynamic Language Pack Discovery**: Custom `.json` language packs added to the `languages/` folder now appear immediately across the UI and settings.
- **Language Search Bar**: Automatically activates when more than 10 languages are available, featuring instant filtering by name, code, or subtitle.

🔄 **Geändert / Improved**:
- **Account Creation Toast Placement & Auto-Dismiss**: The green success message now appears anchored at the bottom-right corner and automatically dismisses after at most 10 seconds.
- **Quad-Lingual Coverage**: Added German, English, French, and Spanish translations for all new search and toast notifications.

### v23.3.0 — Windows 11 Personalization Center, Live Blur & Unsaved Changes Guard

🚀 **Neu / What's New**:
- **Windows 11-Style Personalization Sub-Tabs**: Added dedicated sub-categories in Settings > Personalization for Wallpaper & Blur, Start Menu, Colors & Accent, and Fonts & Zoom.
- **Interactive Live Wallpaper Preview & Blur Slider**: Real-time mockup showing desktop wallpaper with dynamic blur control (0–30 px) and curated presets.
- **Start Menu Background Customization**: Upload custom background/header images for the Windows 11 Start menu with adjustable blur filter.
- **Unsaved Changes Dialog**: Closing Settings with unsaved modifications prompts with Save, Don't Save, or Cancel.
- **Fixed Bottom-Right Save Action**: Added a persistent save button in the bottom-right corner of the Settings window, always accessible without scrolling.

🔄 **Geändert / Improved**:
- **Clean Start & Lock Screen Language Selector**: Removed superfluous country flag icons from the language selector on the start and lock screens for a cleaner, modern look.
- **Multi-Language Support**: Added full quad-lingual coverage in German, English, French, and Spanish for all new personalization controls and dialog buttons.

🛠️ **Behoben / Fixed**:
- **Settings Dirty State Tracking**: Deep object comparison between current edit state and saved company profile prevents accidental loss of configuration changes.

