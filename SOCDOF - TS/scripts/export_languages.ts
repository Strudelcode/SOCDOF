import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { translations, exportLanguageTemplate, exportLanguagePack } from '../src/lib/i18n.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const languagesDir = path.join(rootDir, 'languages');
const publicLanguagesDir = path.join(rootDir, 'public', 'languages');

// Ensure directories exist
if (!fs.existsSync(languagesDir)) {
  fs.mkdirSync(languagesDir, { recursive: true });
}
if (!fs.existsSync(publicLanguagesDir)) {
  fs.mkdirSync(publicLanguagesDir, { recursive: true });
}

// 1. Template EN
const templateEn = exportLanguageTemplate();
fs.writeFileSync(path.join(languagesDir, 'template_en.json'), templateEn, 'utf8');
fs.writeFileSync(path.join(publicLanguagesDir, 'template_en.json'), templateEn, 'utf8');

// 2. Full English pack
const fullEn = exportLanguagePack('en');
fs.writeFileSync(path.join(languagesDir, 'en.json'), fullEn, 'utf8');
fs.writeFileSync(path.join(publicLanguagesDir, 'en.json'), fullEn, 'utf8');

// 3. German pack
const fullDe = exportLanguagePack('de');
fs.writeFileSync(path.join(languagesDir, 'de.json'), fullDe, 'utf8');
fs.writeFileSync(path.join(publicLanguagesDir, 'de.json'), fullDe, 'utf8');

// 4. French pack
const fullFr = exportLanguagePack('fr');
fs.writeFileSync(path.join(languagesDir, 'fr.json'), fullFr, 'utf8');
fs.writeFileSync(path.join(publicLanguagesDir, 'fr.json'), fullFr, 'utf8');

// 5. Spanish pack
const fullEs = exportLanguagePack('es');
fs.writeFileSync(path.join(languagesDir, 'es.json'), fullEs, 'utf8');
fs.writeFileSync(path.join(publicLanguagesDir, 'es.json'), fullEs, 'utf8');

// 6. Documentation / Instructions for end users
const readmeContent = `# SOCDOF Language Packs & Custom Translations

This directory contains standalone JSON language files for SOCDOF.

## How to customize texts or add a new language:

1. **Customize English words or phrases**:
   - Open \`en.json\` with any text editor (Notepad, VS Code, etc.).
   - Find the sentence or button label you want to change.
   - Edit the text on the right side of the colon (\`"key": "Your Text Here"\`).
   - Save the file! If SOCDOF is running on your PC, it automatically detects the change and updates the UI live.

2. **Create a new language (e.g. Italian, Polish, Dutch)**:
   - Copy \`template_en.json\` and rename it (e.g. \`italian.json\`).
   - Open it in Notepad and replace the English sentences with your translations.
   - Save the file into this folder (\`%APPDATA%\\socdof\\languages\\\`).
   - In SOCDOF, go to **Settings > Language & Region** and select your new language!

## Fallback Rule:
If any key is missing from your custom translation file, SOCDOF will automatically fall back to standard English.
`;

fs.writeFileSync(path.join(languagesDir, 'README.md'), readmeContent, 'utf8');
fs.writeFileSync(path.join(publicLanguagesDir, 'README.txt'), readmeContent, 'utf8');

console.log('Successfully generated standalone language JSON files in /languages and /public/languages:');
console.log('- template_en.json');
console.log('- en.json');
console.log('- de.json');
console.log('- fr.json');
console.log('- es.json');
console.log('- README.md / README.txt');
