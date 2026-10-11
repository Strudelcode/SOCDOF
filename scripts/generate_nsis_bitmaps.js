import fs from 'fs';
import path from 'path';

const buildDir = path.resolve('build');
const publicDir = path.resolve('public');

if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

console.log('Writing custom NSIS installer & uninstaller graphics (Pure Node.js - Zero external dependencies)...');

const assetsJsonPath = path.resolve('scripts/nsis_assets_base64.json');
let assets = null;

if (fs.existsSync(assetsJsonPath)) {
  try {
    assets = JSON.parse(fs.readFileSync(assetsJsonPath, 'utf8'));
  } catch (e) {
    console.warn('Could not parse scripts/nsis_assets_base64.json, will check existing files:', e.message);
  }
}

const files = [
  { name: 'installerHeader.bmp', b64Key: 'installerHeader' },
  { name: 'installerSidebar.bmp', b64Key: 'installerSidebar' },
  { name: 'uninstallerSidebar.bmp', b64Key: 'uninstallerSidebar' }
];

for (const item of files) {
  const publicPath = path.join(publicDir, item.name);
  const buildPath = path.join(buildDir, item.name);

  if (assets && assets[item.b64Key]) {
    const buf = Buffer.from(assets[item.b64Key], 'base64');
    fs.writeFileSync(publicPath, buf);
    fs.writeFileSync(buildPath, buf);
    console.log(`✓ Wrote ${item.name} (${buf.length} bytes) to both public/ and build/`);
  } else if (fs.existsSync(publicPath)) {
    fs.copyFileSync(publicPath, buildPath);
    console.log(`✓ Synchronized ${item.name} from public/ to build/`);
  } else if (fs.existsSync(buildPath)) {
    fs.copyFileSync(buildPath, publicPath);
    console.log(`✓ Synchronized ${item.name} from build/ to public/`);
  } else {
    console.warn(`Warning: Could not find or generate ${item.name}`);
  }
}

console.log('NSIS graphics preparation completed.');
