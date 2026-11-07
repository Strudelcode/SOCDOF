const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const publicDir = path.resolve('public');
const buildDir = path.resolve('build');
if (!fs.existsSync(buildDir)) fs.mkdirSync(buildDir, { recursive: true });

console.log('Generating ultra-sleek, professional NSIS & Bootstrapper assets...');

// Generate 96x96 rounded squircle icon with true alpha transparency
execSync(`convert public/socdof_icon.png -resize 96x96 \\
  \\( -size 96x96 xc:black -fill white -draw "roundrectangle 0,0 95,95 20,20" \\) \\
  -alpha Off -compose CopyOpacity -composite /tmp/sq96.png`, { stdio: 'inherit' });

// Generate 64x64 rounded squircle icon
execSync(`convert public/socdof_icon.png -resize 64x64 \\
  \\( -size 64x64 xc:black -fill white -draw "roundrectangle 0,0 63,63 14,14" \\) \\
  -alpha Off -compose CopyOpacity -composite /tmp/sq64.png`, { stdio: 'inherit' });

// Generate 42x42 rounded squircle icon
execSync(`convert public/socdof_icon.png -resize 42x42 \\
  \\( -size 42x42 xc:black -fill white -draw "roundrectangle 0,0 41,41 9,9" \\) \\
  -alpha Off -compose CopyOpacity -composite /tmp/sq42.png`, { stdio: 'inherit' });

// 1. installerSplash (340x420)
const splashCmd = `convert -size 340x420 xc:'#1e2025' \\
  /tmp/sq96.png -gravity North -geometry +0+36 -composite \\
  -font Liberation-Sans-Bold -pointsize 22 -fill '#ffffff' -gravity North -annotate +0+144 'SOCDOF' \\
  -pointsize 8.5 -fill '#8e9aff' -annotate +0+176 'OFFLINE COMMERCE & ERP SUITE' \\
  -font Liberation-Sans -pointsize 10 -fill '#9da5b4' -annotate +0+204 '⚡ 100% Offline   ·   🔒 Lokale DB   ·   🪟 Win 64-Bit' \\
  -font Liberation-Sans-Bold -pointsize 13 -fill '#f5f6f8' -annotate +0+238 'Wird installiert...' \\
  \\( -size 240x8 xc:'#2b2d31' -fill '#5865f2' -draw 'roundrectangle 0,0 120,7 3,3' \\) -gravity North -geometry +0+266 -composite \\
  -font Liberation-Sans -pointsize 9.5 -fill '#8b929e' -annotate +0+284 'Dateien werden eingerichtet... (50%%)' \\
  \\( -size 290x56 xc:'#26282e' -fill '#c5c9d4' -font Liberation-Sans -pointsize 9 -annotate +14+20 '✓ 100%% Offline – Funktioniert ohne Cloud' -annotate +14+40 '✓ Schnelleinrichtung im Benutzerverzeichnis' \\) -gravity North -geometry +0+314 -composite \\
  -font Liberation-Sans -pointsize 8.5 -fill '#72767d' -gravity South -annotate +0+14 'Strudelcode   ·   Version 24.10.2   ·   Sicher & Privat' \\
  public/installerSplash.png`;

execSync(splashCmd, { stdio: 'inherit' });
execSync('convert public/installerSplash.png BMP3:public/installerSplash.bmp', { stdio: 'inherit' });
fs.copyFileSync(path.join(publicDir, 'installerSplash.bmp'), path.join(buildDir, 'installerSplash.bmp'));

// 2. installerSidebar (164x314)
const sidebarCmd = `convert -size 164x314 xc:'#1e2025' \\
  /tmp/sq64.png -gravity North -geometry +0+32 -composite \\
  -font Liberation-Sans-Bold -pointsize 16 -fill '#f5f6f8' -gravity North -annotate +0+106 'SOCDOF' \\
  -pointsize 7.5 -fill '#8e9aff' -annotate +0+130 'OFFLINE SUITE' \\
  \\( -size 140x92 xc:'#26282e' -fill '#22c55e' -font Liberation-Sans-Bold -pointsize 9.5 -annotate +12+22 '✓ 100%% Offline' -fill '#dbdee1' -font Liberation-Sans -pointsize 9 -annotate +12+46 'Lokale SQLite DB' -fill '#949ba4' -pointsize 8.5 -annotate +12+68 'Windows 64-Bit' \\) -gravity North -geometry +0+154 -composite \\
  -font Liberation-Sans -pointsize 8.5 -fill '#72767d' -gravity South -annotate +0+18 'Strudelcode' \\
  public/installerSidebar.png`;

execSync(sidebarCmd, { stdio: 'inherit' });
execSync('convert public/installerSidebar.png BMP3:public/installerSidebar.bmp', { stdio: 'inherit' });
fs.copyFileSync(path.join(publicDir, 'installerSidebar.bmp'), path.join(buildDir, 'installerSidebar.bmp'));

// 3. installerHeader (150x57)
const headerCmd = `convert -size 150x57 xc:'#1e2025' \\
  /tmp/sq42.png -gravity East -geometry +8+0 -composite \\
  -font Liberation-Sans-Bold -pointsize 13 -fill '#f5f6f8' -gravity NorthWest -annotate +12+10 'SOCDOF' \\
  -font Liberation-Sans -pointsize 9 -fill '#949ba4' -annotate +12+30 'Desktop Setup' \\
  public/installerHeader.png`;

execSync(headerCmd, { stdio: 'inherit' });
execSync('convert public/installerHeader.png BMP3:public/installerHeader.bmp', { stdio: 'inherit' });
fs.copyFileSync(path.join(publicDir, 'installerHeader.bmp'), path.join(buildDir, 'installerHeader.bmp'));

// 4. uninstallerSidebar (164x314)
const uninstCmd = `convert -size 164x314 xc:'#1e2025' \\
  /tmp/sq64.png -gravity North -geometry +0+32 -composite \\
  -font Liberation-Sans-Bold -pointsize 16 -fill '#f5f6f8' -gravity North -annotate +0+106 'SOCDOF' \\
  -pointsize 7.5 -fill '#f87171' -annotate +0+130 'DEINSTALLATION' \\
  \\( -size 140x92 xc:'#26282e' -fill '#dbdee1' -font Liberation-Sans -pointsize 9.5 -annotate +12+26 'SOCDOF Suite' -fill '#949ba4' -pointsize 8.5 -annotate +12+54 'Saubere Entfernung' \\) -gravity North -geometry +0+154 -composite \\
  -font Liberation-Sans -pointsize 8.5 -fill '#72767d' -gravity South -annotate +0+18 'Strudelcode' \\
  public/uninstallerSidebar.png`;

execSync(uninstCmd, { stdio: 'inherit' });
execSync('convert public/uninstallerSidebar.png BMP3:public/uninstallerSidebar.bmp', { stdio: 'inherit' });
fs.copyFileSync(path.join(publicDir, 'uninstallerSidebar.bmp'), path.join(buildDir, 'uninstallerSidebar.bmp'));

// Update base64 map in scripts/nsis_assets_base64.json
const base64Map = {
  installerSplash: fs.readFileSync(path.join(publicDir, 'installerSplash.bmp')).toString('base64'),
  installerSidebar: fs.readFileSync(path.join(publicDir, 'installerSidebar.bmp')).toString('base64'),
  installerHeader: fs.readFileSync(path.join(publicDir, 'installerHeader.bmp')).toString('base64'),
  uninstallerSidebar: fs.readFileSync(path.join(publicDir, 'uninstallerSidebar.bmp')).toString('base64')
};
fs.writeFileSync(path.resolve('scripts/nsis_assets_base64.json'), JSON.stringify(base64Map, null, 2));

console.log('✓ All 4 NSIS bitmaps generated and base64 synchronized successfully with pristine squircle styling.');
