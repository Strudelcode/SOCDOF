# SOCDOF Language Packs & Custom Translations

This directory contains standalone JSON language files for SOCDOF.

## How to customize texts or add a new language:

1. **Customize English words or phrases**:
   - Open `en.json` with any text editor (Notepad, VS Code, etc.).
   - Find the sentence or button label you want to change.
   - Edit the text on the right side of the colon (`"key": "Your Text Here"`).
   - Save the file! If SOCDOF is running on your PC, it automatically detects the change and updates the UI live.

2. **Create a new language (e.g. Italian, Polish, Dutch)**:
   - Copy `template_en.json` and rename it (e.g. `italian.json`).
   - Open it in Notepad and replace the English sentences with your translations.
   - Save the file into this folder (`%APPDATA%\socdof\languages\`).
   - In SOCDOF, go to **Settings > Language & Region** and select your new language!

## Fallback Rule:
If any key is missing from your custom translation file, SOCDOF will automatically fall back to standard English.
