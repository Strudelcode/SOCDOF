# 📝 Pending Updates / Changelog
<!-- 
Updates written here accumulate across versions and are broadcast to Discord on the next release or workflow run.
Once sent, this file is automatically reset so you can accumulate the next batch of updates.
Format guidelines:
- Keep it concise: what is new, what changed/improved, what was fixed.
- Avoid exhaustive UI/visual layout breakdowns.
-->

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

