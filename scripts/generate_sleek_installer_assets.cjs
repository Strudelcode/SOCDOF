const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const publicDir = path.resolve('public');
const buildDir = path.resolve('build');
if (!fs.existsSync(buildDir)) fs.mkdirSync(buildDir, { recursive: true });

console.log('Generating high-resolution Discord-style NSIS & Bootstrapper assets with ImageMagick...');

// 1. installerSplash (340x400)
// Clean dark Discord #202225 background, centered icon, white bold SOCDOF, blurple badge,
// "Wird installiert..." status, blurple progress bar, zero outer blue border lines!
const splashCmd = `convert -size 340x400 xc:'#202225' \\
  \\( public/socdof_icon.png -resize 96x96 \\) -gravity North -geometry +0+48 -composite \\
  \\( -background transparent -fill '#f2f3f5' -font Liberation-Sans-Bold -pointsize 24 label:'SOCDOF' \\) -gravity North -geometry +0+158 -composite \\
  \\( -size 124x22 xc:transparent -fill '#2b2d31' -draw 'roundrectangle 0,0 123,21 5,5' \\
     \\( -background transparent -fill '#8590f7' -font Liberation-Sans-Bold -pointsize 10 label:'DESKTOP SUITE' \\) -gravity center -composite \\) -gravity North -geometry +0+196 -composite \\
  \\( -background transparent -fill '#dbdee1' -font Liberation-Sans -pointsize 13 label:'Wird installiert...' \\) -gravity North -geometry +0+242 -composite \\
  -fill '#35373c' -draw 'roundrectangle 70,268 270,272 2,2' \\
  -fill '#5865f2' -draw 'roundrectangle 70,268 190,272 2,2' \\
  \\( -background transparent -fill '#949ba4' -font Liberation-Sans -pointsize 10 label:'100% Offline • Strudelcode' \\) -gravity North -geometry +0+342 -composite \\
  public/installerSplash.png`;

execSync(splashCmd, { stdio: 'inherit' });
execSync('convert public/installerSplash.png BMP3:public/installerSplash.bmp', { stdio: 'inherit' });
fs.copyFileSync(path.join(publicDir, 'installerSplash.bmp'), path.join(buildDir, 'installerSplash.bmp'));

// 2. installerSidebar (164x314)
const sidebarCmd = `convert -size 164x314 gradient:'#202225-#18191c' \\
  \\( public/socdof_icon.png -resize 64x64 \\) -gravity North -geometry +0+36 -composite \\
  \\( -background transparent -fill '#f2f3f5' -font Liberation-Sans-Bold -pointsize 16 label:'SOCDOF' \\) -gravity North -geometry +0+112 -composite \\
  \\( -size 110x18 xc:transparent -fill '#2b2d31' -draw 'roundrectangle 0,0 109,17 4,4' \\
     \\( -background transparent -fill '#8590f7' -font Liberation-Sans-Bold -pointsize 8.5 label:'DESKTOP SUITE' \\) -gravity center -composite \\) -gravity North -geometry +0+138 -composite \\
  \\( -size 140x80 xc:transparent -fill '#282b30' -draw 'roundrectangle 0,0 139,79 6,6' \\
     \\( -background transparent -fill '#22c55e' -font Liberation-Sans-Bold -pointsize 10 label:'100% Offline ERP' \\) -gravity North -geometry +0+12 -composite \\
     \\( -background transparent -fill '#dbdee1' -font Liberation-Sans -pointsize 9.5 label:'Lokale Datenbank' \\) -gravity North -geometry +0+32 -composite \\
     \\( -background transparent -fill '#949ba4' -font Liberation-Sans -pointsize 9 label:'Windows 64-Bit' \\) -gravity North -geometry +0+52 -composite \\) -gravity North -geometry +0+172 -composite \\
  \\( -background transparent -fill '#72767d' -font Liberation-Sans -pointsize 9.5 label:'Strudelcode' \\) -gravity South -geometry +0+22 -composite \\
  public/installerSidebar.png`;

execSync(sidebarCmd, { stdio: 'inherit' });
execSync('convert public/installerSidebar.png BMP3:public/installerSidebar.bmp', { stdio: 'inherit' });
fs.copyFileSync(path.join(publicDir, 'installerSidebar.bmp'), path.join(buildDir, 'installerSidebar.bmp'));

// 3. installerHeader (150x57)
const headerCmd = `convert -size 150x57 xc:'#202225' \\
  \\( public/socdof_icon.png -resize 44x44 \\) -gravity East -geometry +10+0 -composite \\
  \\( -background transparent -fill '#f2f3f5' -font Liberation-Sans-Bold -pointsize 14 label:'SOCDOF' \\) -gravity NorthWest -geometry +12+12 -composite \\
  \\( -background transparent -fill '#949ba4' -font Liberation-Sans -pointsize 10 label:'Desktop Setup' \\) -gravity NorthWest -geometry +12+32 -composite \\
  public/installerHeader.png`;

execSync(headerCmd, { stdio: 'inherit' });
execSync('convert public/installerHeader.png BMP3:public/installerHeader.bmp', { stdio: 'inherit' });
fs.copyFileSync(path.join(publicDir, 'installerHeader.bmp'), path.join(buildDir, 'installerHeader.bmp'));

// 4. uninstallerSidebar (164x314)
const uninstCmd = `convert -size 164x314 gradient:'#202225-#18191c' \\
  \\( public/socdof_icon.png -resize 64x64 \\) -gravity North -geometry +0+36 -composite \\
  \\( -background transparent -fill '#f2f3f5' -font Liberation-Sans-Bold -pointsize 16 label:'SOCDOF' \\) -gravity North -geometry +0+112 -composite \\
  \\( -size 116x18 xc:transparent -fill '#2b2d31' -draw 'roundrectangle 0,0 115,17 4,4' \\
     \\( -background transparent -fill '#f87171' -font Liberation-Sans-Bold -pointsize 8 label:'DEINSTALLATION' \\) -gravity center -composite \\) -gravity North -geometry +0+138 -composite \\
  \\( -size 140x80 xc:transparent -fill '#282b30' -draw 'roundrectangle 0,0 139,79 6,6' \\
     \\( -background transparent -fill '#dbdee1' -font Liberation-Sans -pointsize 10 label:'SOCDOF Suite' \\) -gravity North -geometry +0+16 -composite \\
     \\( -background transparent -fill '#949ba4' -font Liberation-Sans -pointsize 9.5 label:'Saubere Entfernung' \\) -gravity North -geometry +0+40 -composite \\) -gravity North -geometry +0+172 -composite \\
  \\( -background transparent -fill '#72767d' -font Liberation-Sans -pointsize 9.5 label:'Strudelcode' \\) -gravity South -geometry +0+22 -composite \\
  public/uninstallerSidebar.png`;

execSync(uninstCmd, { stdio: 'inherit' });
execSync('convert public/uninstallerSidebar.png BMP3:public/uninstallerSidebar.bmp', { stdio: 'inherit' });
fs.copyFileSync(path.join(publicDir, 'uninstallerSidebar.bmp'), path.join(buildDir, 'uninstallerSidebar.bmp'));

// Update base64 map
const base64Map = {
  installerSplash: fs.readFileSync(path.join(publicDir, 'installerSplash.bmp')).toString('base64'),
  installerSidebar: fs.readFileSync(path.join(publicDir, 'installerSidebar.bmp')).toString('base64'),
  installerHeader: fs.readFileSync(path.join(publicDir, 'installerHeader.bmp')).toString('base64'),
  uninstallerSidebar: fs.readFileSync(path.join(publicDir, 'uninstallerSidebar.bmp')).toString('base64')
};
fs.writeFileSync(path.resolve('scripts/nsis_assets_base64.json'), JSON.stringify(base64Map, null, 2));

console.log('✓ All 4 NSIS bitmaps generated and base64 synchronized successfully.');
