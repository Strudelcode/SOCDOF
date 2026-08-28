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

    // Launch installer detached and quit current instance
    setTimeout(() => {
      try {
        const child = spawn(installerPath, [], {
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

