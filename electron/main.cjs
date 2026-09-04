const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const os = require('os');
const { spawn } = require('child_process');

let mainWindow;
let mobileSyncHttpServer = null;
const mobileSyncStore = new Map();

function getLocalIpAddresses() {
  const networkInterfaces = os.networkInterfaces();
  const validIps = [];

  for (const iface of Object.values(networkInterfaces)) {
    if (iface) {
      for (const config of iface) {
        if (config.family === 'IPv4' && !config.internal) {
          const ip = config.address;
          // Filter out APIPA (169.254.x.x) autoconfig addresses
          if (!ip.startsWith('169.254.')) {
            validIps.push(ip);
          }
        }
      }
    }
  }

  // Sort LAN IPs: 192.168.* first, then 10.*, then 172.*
  validIps.sort((a, b) => {
    const score = (ip) => {
      if (ip.startsWith('192.168.')) return 1;
      if (ip.startsWith('10.')) return 2;
      if (ip.startsWith('172.')) return 3;
      return 4;
    };
    return score(a) - score(b);
  });

  return validIps;
}

// Background lightweight HTTP sync server for Mobile Companion in packaged Electron
function startMobileSyncServer(preferredPort = 3000) {
  if (mobileSyncHttpServer) return;

  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-App-Source, X-App-Version, X-Device-Id, X-Export-Timestamp');

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    if (parsedUrl.pathname === '/api/mobile-sync/info' && req.method === 'GET') {
      const ips = getLocalIpAddresses();
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        status: 'ok',
        ips,
        port: preferredPort,
        primaryIp: ips[0] || '127.0.0.1'
      }));
      return;
    }

    if (parsedUrl.pathname === '/api/mobile-sync' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body);
          const token = parsedUrl.searchParams.get('token') || payload.token || payload.session_id || 'default';
          
          mobileSyncStore.set(token, { payload, timestamp: Date.now() });
          mobileSyncStore.set('latest', { payload, timestamp: Date.now() });

          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('socdof:mobile-sync-received', payload);
          }

          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            message: 'Synchronisation erfolgreich!',
            receivedSessions: payload.sessions?.length || payload.tickets?.length || 0,
            timestamp: new Date().toISOString()
          }));
        } catch (err) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }

    if (parsedUrl.pathname === '/api/mobile-sync' && req.method === 'GET') {
      const token = parsedUrl.searchParams.get('token') || 'latest';
      const session = mobileSyncStore.get(token) || mobileSyncStore.get('latest');

      res.setHeader('Content-Type', 'application/json');
      if (session && Date.now() - session.timestamp < 1000 * 60 * 15) {
        if (parsedUrl.searchParams.get('consume') === 'true') {
          mobileSyncStore.delete(token);
          mobileSyncStore.delete('latest');
        }
        res.end(JSON.stringify({ ready: true, timestamp: session.timestamp, payload: session.payload }));
      } else {
        res.end(JSON.stringify({ ready: false, message: 'Waiting...' }));
      }
      return;
    }

    res.statusCode = 404;
    res.end('Not found');
  });

  server.on('error', (err) => {
    console.error('Mobile sync server error:', err);
    if (err.code === 'EADDRINUSE' && preferredPort === 3000) {
      startMobileSyncServer(3001);
    }
  });

  server.listen(preferredPort, '0.0.0.0', () => {
    console.log(`[SOCDOF Electron] Background Mobile Sync server running on port ${preferredPort}`);
  });

  mobileSyncHttpServer = server;
}

// Disable default top menu bar (File, Edit, View, Window)
Menu.setApplicationMenu(null);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'SOCDOF - Strudel\'s Organization, Commerce & Documentation Offline Flow',
    icon: process.platform === 'win32'
      ? path.join(__dirname, '../public/socdof_icon.ico')
      : path.join(__dirname, '../public/socdof_icon.png'),
    backgroundColor: '#0b0f19',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });

  // Ensure menu bar remains hidden
  mainWindow.setMenuBarVisibility(false);

  // Load the compiled Vite app
  const indexPath = path.join(__dirname, '../dist/index.html');
  mainWindow.loadFile(indexPath);

  // Open external links in default OS browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Download file following redirects (e.g. GitHub Releases CDN)
function downloadFileWithProgress(fileUrl, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    const client = fileUrl.startsWith('https') ? https : http;
    
    client.get(fileUrl, { headers: { 'User-Agent': 'SOCDOF-AutoUpdater' } }, (res) => {
      // Handle redirects
      if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
        if (res.headers.location) {
          return downloadFileWithProgress(res.headers.location, destPath, onProgress).then(resolve).catch(reject);
        }
      }

      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to download file. HTTP status: ${res.statusCode}`));
      }

      const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
      let downloadedBytes = 0;
      const fileStream = fs.createWriteStream(destPath);

      res.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        if (totalBytes > 0 && onProgress) {
          const percent = Math.min(100, Math.round((downloadedBytes / totalBytes) * 100));
          onProgress({ percent, downloadedBytes, totalBytes });
        }
      });

      res.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close(() => resolve(destPath));
      });

      fileStream.on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

// Register IPC handlers
ipcMain.handle('socdof:get-platform', () => {
  return {
    isElectron: true,
    platform: process.platform,
    version: app.getVersion()
  };
});

ipcMain.handle('socdof:get-network-ips', () => {
  const ips = getLocalIpAddresses();
  return {
    ips,
    port: 3000,
    primaryIp: ips[0] || '127.0.0.1'
  };
});

ipcMain.handle('socdof:quit-app', () => {
  app.quit();
});

// Languages directory manager
function getLanguagesDirectory() {
  const langDir = path.join(app.getPath('userData'), 'languages');
  if (!fs.existsSync(langDir)) {
    try {
      fs.mkdirSync(langDir, { recursive: true });
    } catch {}
  }
  return langDir;
}

function getFlagsDirectory() {
  const flagsDir = path.join(getLanguagesDirectory(), 'flags');
  if (!fs.existsSync(flagsDir)) {
    try {
      fs.mkdirSync(flagsDir, { recursive: true });
    } catch {}
  }
  return flagsDir;
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.svg': return 'image/svg+xml';
    case '.webp': return 'image/webp';
    case '.gif': return 'image/gif';
    default: return 'application/octet-stream';
  }
}

function getAllFlagImages() {
  const flagsDir = getFlagsDirectory();
  const flagMap = {};
  try {
    const files = fs.readdirSync(flagsDir);
    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (!['.png', '.jpg', '.jpeg', '.svg', '.webp', '.gif'].includes(ext)) continue;
      const key = path.basename(file, ext).toLowerCase();
      const fullPath = path.join(flagsDir, file);
      try {
        const fileData = fs.readFileSync(fullPath);
        const mime = getMimeType(fullPath);
        flagMap[key] = `data:${mime};base64,${fileData.toString('base64')}`;
      } catch {}
    }
  } catch {}
  return flagMap;
}

function ensureDefaultLanguageFiles() {
  const langDir = getLanguagesDirectory();
  const flagsDir = getFlagsDirectory();

  const candidateSources = [
    path.join(__dirname, '..', 'languages'),
    path.join(__dirname, '..', 'public', 'languages'),
    path.join(process.resourcesPath || '', 'languages'),
    path.join(process.resourcesPath || '', 'public', 'languages'),
  ];

  let sourceDir = null;
  for (const candidate of candidateSources) {
    if (fs.existsSync(candidate) && fs.existsSync(path.join(candidate, 'en.json'))) {
      sourceDir = candidate;
      break;
    }
  }

  const filesToSeed = ['template_en.json', 'en.json', 'de.json', 'fr.json', 'es.json', 'README.md'];
  for (const filename of filesToSeed) {
    const targetFile = path.join(langDir, filename);
    if (!fs.existsSync(targetFile) && sourceDir) {
      const srcFile = path.join(sourceDir, filename);
      if (fs.existsSync(srcFile)) {
        try {
          fs.copyFileSync(srcFile, targetFile);
        } catch (e) {
          console.warn(`Could not seed ${filename}:`, e);
        }
      }
    }
  }

  // Also copy any sample flags from source flags directory if available
  if (sourceDir) {
    const srcFlagsDir = path.join(sourceDir, 'flags');
    if (fs.existsSync(srcFlagsDir)) {
      try {
        const flagFiles = fs.readdirSync(srcFlagsDir);
        for (const ff of flagFiles) {
          const targetFlag = path.join(flagsDir, ff);
          if (!fs.existsSync(targetFlag)) {
            try {
              fs.copyFileSync(path.join(srcFlagsDir, ff), targetFlag);
            } catch {}
          }
        }
      } catch {}
    }
  }

  // Ensure flags/README.txt is present
  const flagReadme = path.join(flagsDir, 'README.txt');
  if (!fs.existsSync(flagReadme)) {
    try {
      fs.writeFileSync(flagReadme, `SOCDOF Custom Flags Directory
==============================
Directory: ${flagsDir}

Place custom flag images here (e.g. en.png, de.png, it.png, or any custom_language_id.png).
Formats supported: .png, .jpg, .svg, .webp.

Fallback: If no image is provided, SOCDOF uses crisp flag emojis or a default black flag with a question mark (?).
`, 'utf8');
    } catch {}
  }

  // Also ensure an informative README.txt is always present in %APPDATA%/socdof/languages/
  const readmePath = path.join(langDir, 'README.txt');
  if (!fs.existsSync(readmePath)) {
    try {
      fs.writeFileSync(readmePath, `SOCDOF Desktop Languages Directory
====================================
Directory: ${langDir}

1. How to customize words, button labels or sentences in English:
   - Open 'en.json' with Notepad or any text editor.
   - Find the key you want to change (e.g. "app.name" or "action.save").
   - Change the text on the right side of the colon.
   - Save the file (Ctrl+S). SOCDOF immediately detects changes and reloads the UI!

2. How to add a new language (e.g. Italian, Polish, Dutch):
   - Copy 'template_en.json' and rename it (e.g. 'italian.json').
   - Open it in Notepad and translate the strings.
   - Save the file in this folder.
   - In SOCDOF, go to Settings -> Language & Region and select your new language!

3. Custom Flags:
   - Place flag pictures in the 'flags' subfolder (e.g. italian.png, en.png).
`, 'utf8');
    } catch {}
  }
}

let languageFolderWatcher = null;
let flagsFolderWatcher = null;
function setupLanguagesFolderWatcher() {
  if (languageFolderWatcher) return;
  const langDir = getLanguagesDirectory();
  const flagsDir = getFlagsDirectory();

  const notifyChange = (subPath, eventType, filename) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('socdof:languages-folder-changed', {
        eventType,
        filename: filename ? String(filename) : undefined,
        subPath,
        timestamp: Date.now()
      });
    }
  };

  try {
    let debounceTimer = null;
    languageFolderWatcher = fs.watch(langDir, (eventType, filename) => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        notifyChange('languages', eventType, filename);
      }, 300);
    });
  } catch (err) {
    console.warn('Could not initialize languages directory watcher:', err);
  }

  try {
    let flagDebounceTimer = null;
    flagsFolderWatcher = fs.watch(flagsDir, (eventType, filename) => {
      if (flagDebounceTimer) clearTimeout(flagDebounceTimer);
      flagDebounceTimer = setTimeout(() => {
        notifyChange('flags', eventType, filename);
      }, 300);
    });
  } catch (err) {
    console.warn('Could not initialize flags directory watcher:', err);
  }
}

function readAllLanguageFiles() {
  const langDir = getLanguagesDirectory();
  ensureDefaultLanguageFiles();

  const results = [];
  const flagsMap = getAllFlagImages();
  try {
    const files = fs.readdirSync(langDir);
    for (const file of files) {
      if (!file.toLowerCase().endsWith('.json')) continue;
      const fullPath = path.join(langDir, file);
      try {
        const stats = fs.statSync(fullPath);
        if (!stats.isFile()) continue;
        const rawContent = fs.readFileSync(fullPath, 'utf8');
        const parsed = JSON.parse(rawContent);

        let dict = {};
        if (parsed.translations && typeof parsed.translations === 'object') {
          dict = parsed.translations;
        } else if (typeof parsed === 'object') {
          dict = parsed;
        }

        const metadata = parsed._metadata || {};
        const cleanTranslations = {};
        for (const [k, v] of Object.entries(dict)) {
          if (!k.startsWith('_') && typeof v === 'string') {
            cleanTranslations[k] = v;
          }
        }

        const baseId = file.replace(/\.json$/i, '');
        const flagKey = (metadata.language_code || baseId).toLowerCase();
        const flagImg = flagsMap[flagKey] || flagsMap[baseId.toLowerCase()] || null;

        results.push({
          filename: file,
          id: baseId,
          title: metadata.title || metadata.language_name || baseId,
          language_name: metadata.language_name || baseId,
          language_code: metadata.language_code || baseId,
          emoji: metadata.emoji || metadata.flag || null,
          flagImage: flagImg,
          count: Object.keys(cleanTranslations).length,
          lastModified: stats.mtimeMs,
          translations: cleanTranslations,
          isBuiltInOverride: ['en', 'de', 'fr', 'es'].includes(baseId.toLowerCase())
        });
      } catch (fileErr) {
        console.warn(`Error reading language file ${file}:`, fileErr);
      }
    }
  } catch (dirErr) {
    console.warn('Error reading languages directory:', dirErr);
  }
  return results;
}

ipcMain.handle('socdof:get-languages-folder-path', () => {
  return getLanguagesDirectory();
});

ipcMain.handle('socdof:get-flags-folder-path', () => {
  return getFlagsDirectory();
});

ipcMain.handle('socdof:open-flags-folder', async () => {
  const flagsDir = getFlagsDirectory();
  await shell.openPath(flagsDir);
  return { success: true, path: flagsDir };
});

ipcMain.handle('socdof:get-available-flags', () => {
  return getAllFlagImages();
});

ipcMain.handle('socdof:open-languages-folder', async () => {
  const langDir = getLanguagesDirectory();
  ensureDefaultLanguageFiles();
  setupLanguagesFolderWatcher();
  await shell.openPath(langDir);
  return { success: true, path: langDir };
});

ipcMain.handle('socdof:read-local-languages', () => {
  return readAllLanguageFiles();
});

ipcMain.handle('socdof:save-local-language-file', async (_event, payload) => {
  try {
    const { filename, content } = payload || {};
    if (!filename || typeof filename !== 'string') {
      throw new Error('Invalid filename');
    }
    const cleanFilename = path.basename(filename).replace(/[^a-zA-Z0-9_\-\.]/g, '');
    if (!cleanFilename.toLowerCase().endsWith('.json')) {
      throw new Error('Filename must end with .json');
    }

    const langDir = getLanguagesDirectory();
    const destPath = path.join(langDir, cleanFilename);
    fs.writeFileSync(destPath, typeof content === 'string' ? content : JSON.stringify(content, null, 2), 'utf8');
    return { success: true, path: destPath };
  } catch (err) {
    console.error('Failed to save language file:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('socdof:download-and-install-update', async (_event, payload) => {
  try {
    const { downloadUrl, version } = payload || {};
    if (!downloadUrl) {
      throw new Error('No download URL provided');
    }

    const tempDir = app.getPath('temp');
    const safeVersion = version || 'update';
    const installerFilename = `SOCDOF-Setup-${safeVersion}-${Date.now()}.exe`;
    const installerPath = path.join(tempDir, installerFilename);

    // Download update file
    await downloadFileWithProgress(downloadUrl, installerPath, (progress) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('socdof:update-download-progress', progress);
      }
    });

    // Notify ready to install
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('socdof:update-download-progress', { percent: 100, isFinished: true });
    }

    // Launch installer detached with silent in-place update flags (/S --force-run)
    // This updates the existing installation directory without prompting for paths and relaunches the app automatically
    setTimeout(() => {
      try {
        const child = spawn(installerPath, ['/S', '--force-run'], {
          detached: true,
          stdio: 'ignore'
        });
        child.unref();
      } catch (spawnErr) {
        console.error('Failed to spawn installer, opening with shell:', spawnErr);
        shell.openPath(installerPath);
      }

      // Exit app cleanly to allow the installer to overwrite files
      app.exit(0);
    }, 1200);

    return { success: true };
  } catch (err) {
    console.error('Update download & execution failed:', err);
    return { success: false, error: err.message };
  }
});

app.whenReady().then(() => {
  createWindow();
  ensureDefaultLanguageFiles();
  setupLanguagesFolderWatcher();
  startMobileSyncServer(3000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

