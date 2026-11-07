# Legacy baseline (measured 2026-11-07)

Reference values for the TypeScript application in `SOCDOF - TS`, used to judge the Rust rewrite.

## Source

| Metric | Value |
|---|---|
| TypeScript/TSX files | 126 |
| Lines of code (TS/TSX) | 112,790 |
| Largest files | `src/lib/i18n.ts` 13,069 · `SettingsModule.tsx` 7,302 · `DesktopWindowWorkspace.tsx` 5,388 |

## Web build (`npm run build`, Vite 6)

| Artifact | Size |
|---|---|
| `dist` total | 11 MB |
| `dist/assets/index-*.js` | 3.9 MB raw / 973 KB gzip |
| `dist/assets/vendor-pdf-*.js` | 472 KB |
| `dist/assets/vendor-firebase-*.js` | 153 KB |
| `dist/assets/vendor-icons-*.js` | 104 KB |
| `dist/assets/index-*.css` | 368 KB |

## Desktop shell

| Metric | Value |
|---|---|
| Runtime | Electron (bundled Chromium + Node) |
| Installer size | ~100–150 MB (NSIS / portable, not measured in this environment) |
| Build dependencies | `pdfjs-dist`, `firebase`, `lucide-react`, `motion`, `nspell`, `dictionary-de`, `jszip`, `qrcode`, `jsqr`, `canvas-confetti`, `@google/genai`, `dexie` |

## How to reproduce

```bash
cd "SOCDOF - TS"
bun install --frozen-lockfile
npm run build
du -sh dist dist/assets
find src \( -name '*.tsx' -o -name '*.ts' \) -print0 | xargs -0 wc -l | tail -1
```

RAM, cold start and installer size must be measured on Windows before Phase 9 and appended here.
