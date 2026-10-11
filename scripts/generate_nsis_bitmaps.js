import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const buildDir = path.resolve('build');
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

console.log('Generating custom NSIS installer and uninstaller bitmaps (164x314 & 150x57)...');

// 1. Uninstaller Sidebar BMP (164x314)
execSync(`convert -size 164x314 gradient:'#080B16'-'#16122E' \\
  \\( public/socdof_icon.png -resize 54x54 \\) -gravity north -geometry +0+35 -composite \\
  -fill white -font Helvetica-Bold -pointsize 18 -gravity north -annotate +0+105 "SOCDOF" \\
  -fill '#1E1B4B' -stroke '#4338CA' -strokewidth 1 -draw 'roundrectangle 26,128 138,148 5,5' \\
  -fill '#C7D2FE' -stroke none -font Helvetica-Bold -pointsize 9 -gravity north -annotate +0+134 "DEINSTALLATION" \\
  -fill '#94A3B8' -font Helvetica -pointsize 9 -gravity north -annotate +0+160 "Saubere Bereinigung" \\
  -fill '#0F172A' -stroke '#1E293B' -strokewidth 1 -draw 'roundrectangle 14,185 150,260 8,8' \\
  -fill '#10B981' -stroke none -font Helvetica-Bold -pointsize 9 -gravity north -annotate +0+198 "Datensicherheit" \\
  -fill '#CBD5E1' -font Helvetica -pointsize 8 -gravity north -annotate +0+215 "Ihre Datenbanken & Backups" \\
  -fill '#93C5FD' -font Helvetica -pointsize 8 -gravity north -annotate +0+232 "bleiben sicher erhalten." \\
  -stroke '#1E293B' -strokewidth 1 -draw 'line 20,278 144,278' \\
  -fill '#64748B' -stroke none -font Helvetica-Bold -pointsize 8.5 -gravity north -annotate +0+288 "Strudelcode" \\
  -type truecolor BMP3:build/uninstallerSidebar.bmp`);

// 2. Installer Sidebar BMP (164x314)
execSync(`convert -size 164x314 gradient:'#070A14'-'#151336' \\
  \\( public/socdof_icon.png -resize 54x54 \\) -gravity north -geometry +0+35 -composite \\
  -fill white -font Helvetica-Bold -pointsize 18 -gravity north -annotate +0+105 "SOCDOF" \\
  -fill '#1E1B4B' -stroke '#4338CA' -strokewidth 1 -draw 'roundrectangle 30,128 134,148 5,5' \\
  -fill '#C7D2FE' -stroke none -font Helvetica-Bold -pointsize 9 -gravity north -annotate +0+134 "DESKTOP SUITE" \\
  -fill '#94A3B8' -font Helvetica -pointsize 9 -gravity north -annotate +0+160 "Offline-First Flow" \\
  -fill '#0F172A' -stroke '#1E293B' -strokewidth 1 -draw 'roundrectangle 14,185 150,260 8,8' \\
  -fill '#10B981' -stroke none -font Helvetica-Bold -pointsize 9 -gravity north -annotate +0+198 "100% Offline-faehig" \\
  -fill '#CBD5E1' -font Helvetica -pointsize 8 -gravity north -annotate +0+215 "DSGVO & GoBD konform" \\
  -fill '#93C5FD' -font Helvetica -pointsize 8 -gravity north -annotate +0+232 "Lokale Datenspeicherung" \\
  -stroke '#1E293B' -strokewidth 1 -draw 'line 20,278 144,278' \\
  -fill '#64748B' -stroke none -font Helvetica-Bold -pointsize 8.5 -gravity north -annotate +0+288 "Strudelcode" \\
  -type truecolor BMP3:build/installerSidebar.bmp`);

// 3. Installer Header BMP (150x57)
execSync(`convert -size 150x57 gradient:'#080A14'-'#1B1744' \\
  \\( public/socdof_icon.png -resize 36x36 \\) -gravity east -geometry +12+0 -composite \\
  -fill white -font Helvetica-Bold -pointsize 13 -gravity west -annotate +14-7 "SOCDOF" \\
  -fill '#A5B4FC' -font Helvetica -pointsize 8.5 -gravity west -annotate +14+11 "Windows Desktop" \\
  -type truecolor BMP3:build/installerHeader.bmp`);

// Generate PNG copies for easy inspection
execSync(`convert build/installerSidebar.bmp build/installerSidebar.png`);
execSync(`convert build/uninstallerSidebar.bmp build/uninstallerSidebar.png`);
execSync(`convert build/installerHeader.bmp build/installerHeader.png`);

console.log('NSIS graphics successfully generated:');
console.log(execSync('ls -lh build/*.bmp').toString());
