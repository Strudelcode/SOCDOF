const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { spawn } = require('child_process');

let mainWindow;

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

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

