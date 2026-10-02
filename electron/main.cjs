const { app, BrowserWindow, Menu, shell, ipcMain, dialog, screen, net } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const os = require('os');
const { spawn } = require('child_process');

// Single-instance lock: Enforce single process to prevent profile lock deadlocks and frozen windows
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  console.log('[SOCDOF Electron] Another instance is already running. Exiting smoothly.');
  app.quit();
  process.exit(0);
}

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

// Background lightweight HTTP sync server for Mobile Companion & Discord Localhost Proxy in packaged Electron
function getElectronDiscordBotToken() {
  if (process.env.DISCORD_BOT_TOKEN) return process.env.DISCORD_BOT_TOKEN;
  if (process.env.VITE_DISCORD_BOT_TOKEN) return process.env.VITE_DISCORD_BOT_TOKEN;
  try {
    const configPath = path.join(app.getPath('userData'), 'discord_config.json');
    if (fs.existsSync(configPath)) {
      const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (cfg.botToken) return cfg.botToken;
    }
  } catch {}
  return '';
}

function saveElectronDiscordBotToken(token) {
  try {
    const configPath = path.join(app.getPath('userData'), 'discord_config.json');
    fs.writeFileSync(configPath, JSON.stringify({ botToken: (token || '').trim(), updatedAt: new Date().toISOString() }), 'utf8');
    return true;
  } catch (err) {
    console.warn('[SOCDOF Electron] Failed to save Discord bot token:', err);
    return false;
  }
}

function executeDiscordHttpsRequest(endpoint, method = 'GET', body = null, explicitToken = '') {
  return new Promise((resolve) => {
    const botToken = (explicitToken || '').trim() || getElectronDiscordBotToken();
    if (!botToken) {
      resolve({ status: 401, ok: false, error: 'Kein Discord Bot Token konfiguriert' });
      return;
    }

    try {
      const targetUrl = endpoint.startsWith('http') ? endpoint : `https://discord.com/api/v10${endpoint}`;
      const urlObj = new URL(targetUrl);
      const postData = body ? JSON.stringify(body) : null;

      const reqOptions = {
        hostname: urlObj.hostname,
        port: 443,
        path: urlObj.pathname + urlObj.search,
        method: method,
        headers: {
          'Authorization': `Bot ${botToken}`,
          'Content-Type': 'application/json',
          'User-Agent': 'SOCDOF-Desktop-App (https://github.com/Strudelcode/SOCDOF, 1.0)'
        },
        timeout: 15000
      };

      if (postData) {
        reqOptions.headers['Content-Length'] = Buffer.byteLength(postData);
      }

      const req = https.request(reqOptions, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            const json = data ? JSON.parse(data) : {};
            resolve({ status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 300, data: json });
          } catch {
            resolve({ status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 300, data: { raw: data } });
          }
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ status: 408, ok: false, error: 'Discord API Timeout (15s)' });
      });

      req.on('error', (err) => {
        resolve({ status: 500, ok: false, error: err.message });
      });

      if (postData) {
        req.write(postData);
      }
      req.end();
    } catch (err) {
      resolve({ status: 500, ok: false, error: err.message });
    }
  });
}

function executeBotghostWebhook(targetUrl, payload, apiKey = '17450aaada2fde267b22f9f917094d13e38c8ba7b51a4df047719f0fd1877089') {
  return new Promise((resolve) => {
    try {
      const urlObj = new URL(targetUrl);
      const postData = JSON.stringify(payload);
      const key = apiKey || '17450aaada2fde267b22f9f917094d13e38c8ba7b51a4df047719f0fd1877089';
      const reqOptions = {
        hostname: urlObj.hostname,
        port: 443,
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'Authorization': key,
          'x-api-key': key,
          'User-Agent': 'SOCDOF-Desktop-App/1.0'
        },
        timeout: 12000
      };

      const req = https.request(reqOptions, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          let parsed = data;
          try { parsed = JSON.parse(data); } catch {}
          console.log(`[SOCDOF Electron] BotGhost Webhook Response: HTTP ${res.statusCode}`);
          resolve({ status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 300, data: parsed });
        });
      });

      req.on('timeout', () => {
        req.destroy();
        console.warn('[SOCDOF Electron] BotGhost Webhook Timeout (12s)');
        resolve({ status: 408, ok: false, error: 'BotGhost Webhook Timeout (12s)' });
      });

      req.on('error', (err) => {
        console.error('[SOCDOF Electron] BotGhost Webhook Network Error:', err.message);
        resolve({ status: 500, ok: false, error: err.message });
      });

      req.write(postData);
      req.end();
    } catch (err) {
      console.error('[SOCDOF Electron] BotGhost Webhook Exception:', err.message);
      resolve({ status: 500, ok: false, error: err.message });
    }
  });
}

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
    const pathname = parsedUrl.pathname.replace(/\/+$/, '') || '/';

    // Discord API Proxy: /api/discord/bot-status
    if (pathname === '/api/discord/bot-status' && (req.method === 'GET' || req.method === 'POST')) {
      const token = getElectronDiscordBotToken();
      if (!token) {
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 200;
        res.end(JSON.stringify({ online: false, error: 'No Discord bot token configured in Electron' }));
        return;
      }
      executeDiscordHttpsRequest('/users/@me', 'GET', null, token).then(result => {
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 200;
        if (result.ok && result.data && result.data.id) {
          const d = result.data;
          const avatarUrl = d.avatar
            ? `https://cdn.discordapp.com/avatars/${d.id}/${d.avatar}.png?size=128`
            : `https://cdn.discordapp.com/embed/avatars/${(parseInt(d.id || '0', 10) || 0) % 5}.png`;
          res.end(JSON.stringify({ online: true, botId: d.id, botName: d.username, botAvatar: d.avatar, avatarUrl }));
        } else {
          res.end(JSON.stringify({ online: false, error: result.error || 'Bot unreachable' }));
        }
      });
      return;
    }

    // Discord API Proxy: /api/discord/channel-tags
    if (pathname === '/api/discord/channel-tags' && (req.method === 'GET' || req.method === 'POST')) {
      const channelId = parsedUrl.searchParams.get('channelId') || '1535709136363462757';
      executeDiscordHttpsRequest(`/channels/${channelId}`, 'GET').then(result => {
        res.setHeader('Content-Type', 'application/json');
        if (result.ok && result.data && Array.isArray(result.data.available_tags)) {
          const tags = result.data.available_tags.map(t => ({
            id: t.id,
            name: t.name,
            emojiName: t.emoji_name,
            emojiId: t.emoji_id,
            moderated: !!t.moderated
          }));
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, tags }));
        } else {
          res.statusCode = 200;
          res.end(JSON.stringify({ success: false, tags: [], error: result.error }));
        }
      });
      return;
    }

    // Discord API Proxy: /api/discord/botghost-webhook (Forward webhook to BotGhost)
    if ((pathname === '/api/discord/botghost-webhook' || pathname === '/api/botghost/webhook') && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          const targetUrl = parsed.webhookUrl || 'https://api.botghost.com/webhook/1498764033518735441/t5dcd2k8x1n8i53932gf';
          const payload = parsed.payload || parsed;
          const apiKey = parsed.apiKey || '17450aaada2fde267b22f9f917094d13e38c8ba7b51a4df047719f0fd1877089';

          executeBotghostWebhook(targetUrl, payload, apiKey).then(result => {
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = result.ok ? 200 : (result.status || 500);
            res.end(JSON.stringify({ success: result.ok, status: result.status, data: result.data, error: result.error }));
          });
        } catch (err) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }

    // Discord API Proxy: /api/discord/thread (Create forum post via Bot)
    if (pathname === '/api/discord/thread' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          const channelId = parsed.channelId || '1535709136363462757';
          const threadData = parsed.threadData || parsed;
          const explicitToken = parsed.botToken || '';

          executeDiscordHttpsRequest(`/channels/${channelId}/threads`, 'POST', threadData, explicitToken).then(result => {
            res.setHeader('Content-Type', 'application/json');
            if (result.ok && result.data && result.data.id) {
              const threadId = result.data.id;
              const threadUrl = `https://discord.com/channels/1517532430095876266/${channelId}/${threadId}`;
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true, threadId, threadUrl, data: result.data }));
            } else {
              res.statusCode = result.status || 500;
              res.end(JSON.stringify({ success: false, error: result.error || result.data?.message || 'Failed to create thread', details: result.data }));
            }
          });
        } catch (err) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }

    // Discord API Proxy: /api/discord/sync-threads
    if ((pathname === '/api/discord/sync-threads' || pathname === '/api/discord/threads-status') && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const parsed = JSON.parse(body);
          const threadIds = Array.isArray(parsed.threadIds) ? parsed.threadIds.slice(0, 25) : [];
          const threadsMap = {};

          for (const tid of threadIds) {
            const resData = await executeDiscordHttpsRequest(`/channels/${tid}`, 'GET');
            if (resData.ok && resData.data) {
              threadsMap[tid] = {
                id: tid,
                name: resData.data.name,
                appliedTags: (resData.data.applied_tags || []).map(id => ({ id, name: id })),
                isArchived: !!resData.data.thread_metadata?.archived,
                isLocked: !!resData.data.thread_metadata?.locked,
                messageCount: resData.data.total_message_sent ?? resData.data.message_count ?? 1,
                lastSyncedAt: new Date().toISOString()
              };
            }
          }

          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, threads: threadsMap }));
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }

    // Mobile Companion: /api/mobile-sync/info
    if (pathname === '/api/mobile-sync/info' && req.method === 'GET') {
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

    // Mobile Companion: /api/mobile-sync POST
    if (pathname === '/api/mobile-sync' && req.method === 'POST') {
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

    // Mobile Companion: /api/mobile-sync GET
    if (pathname === '/api/mobile-sync' && req.method === 'GET') {
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
    console.log(`[SOCDOF Electron] Background Mobile Sync & Discord API server running on port ${preferredPort}`);
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
    show: false, // Prevents white/black flashing and unresponsive initial frame detection
    fullscreen: true, // Default to true fullscreen edge-to-edge covering Windows taskbar
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

  // Reveal window once first paint is completed and DOM is ready
  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.setFullScreen(true);
      mainWindow.show();
    }
  });

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

ipcMain.handle('socdof:toggle-fullscreen', () => {
  if (mainWindow) {
    const isNowFullscreen = !mainWindow.isFullScreen();
    mainWindow.setFullScreen(isNowFullscreen);
    return isNowFullscreen;
  }
  return false;
});

ipcMain.handle('socdof:set-fullscreen', (event, flag) => {
  if (mainWindow) {
    mainWindow.setFullScreen(!!flag);
    return mainWindow.isFullScreen();
  }
  return false;
});

ipcMain.handle('socdof:is-fullscreen', () => {
  if (mainWindow) {
    return mainWindow.isFullScreen();
  }
  return false;
});

ipcMain.handle('socdof:minimize-window', () => {
  if (mainWindow) {
    mainWindow.minimize();
    return true;
  }
  return false;
});

ipcMain.handle('socdof:maximize-window', () => {
  if (mainWindow) {
    if (mainWindow.isFullScreen()) {
      mainWindow.setFullScreen(false);
    }
    mainWindow.maximize();
    return true;
  }
  return false;
});

ipcMain.handle('socdof:unmaximize-window', () => {
  if (mainWindow) {
    if (mainWindow.isFullScreen()) {
      mainWindow.setFullScreen(false);
    }
    mainWindow.unmaximize();
    return true;
  }
  return false;
});

ipcMain.handle('socdof:is-maximized', () => {
  if (mainWindow) {
    return mainWindow.isMaximized();
  }
  return false;
});

// Multi-Monitor & Display Management IPC
ipcMain.handle('socdof:get-displays', () => {
  try {
    const primaryId = screen.getPrimaryDisplay().id;
    const displays = screen.getAllDisplays().map((d, index) => ({
      id: d.id,
      index: index + 1,
      label: `Display ${index + 1}${d.id === primaryId ? ' (Hauptanzeige)' : ''}`,
      bounds: d.bounds,
      workArea: d.workArea,
      scaleFactor: d.scaleFactor,
      rotation: d.rotation,
      isPrimary: d.id === primaryId,
      internal: d.internal || false
    }));
    return {
      success: true,
      displays,
      primaryId
    };
  } catch (err) {
    return { success: false, error: err.message, displays: [] };
  }
});

ipcMain.handle('socdof:move-window-to-display', (event, { displayId, maximize }) => {
  try {
    if (!mainWindow) return { success: false, error: 'Main window unavailable' };
    const displays = screen.getAllDisplays();
    const target = displays.find(d => d.id === displayId);
    if (!target) return { success: false, error: 'Display not found' };
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    }
    mainWindow.setPosition(target.workArea.x + 50, target.workArea.y + 50);
    if (maximize) {
      mainWindow.maximize();
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

const secondaryDetachedWindows = new Map();

ipcMain.handle('socdof:popout-window', (event, { windowId, module, title, displayId, url }) => {
  try {
    const displays = screen.getAllDisplays();
    const targetDisplay = (displayId && displays.find(d => d.id === displayId)) || (displays.length > 1 ? displays[1] : screen.getPrimaryDisplay());
    
    const existing = secondaryDetachedWindows.get(windowId);
    if (existing && !existing.isDestroyed()) {
      existing.focus();
      return { success: true, alreadyOpen: true };
    }

    const popWin = new BrowserWindow({
      x: targetDisplay.workArea.x + 60,
      y: targetDisplay.workArea.y + 60,
      width: Math.min(1280, targetDisplay.workArea.width - 120),
      height: Math.min(850, targetDisplay.workArea.height - 120),
      title: title || 'SOCDOF Secondary Workspace',
      icon: path.join(__dirname, '../public/favicon.ico'),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.cjs')
      }
    });

    secondaryDetachedWindows.set(windowId, popWin);

    popWin.on('closed', () => {
      secondaryDetachedWindows.delete(windowId);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('socdof:window-popped-in', { windowId });
      }
    });

    const targetUrl = url || (mainWindow ? `${mainWindow.webContents.getURL().split('?')[0]}?popout=${windowId}&module=${module}` : 'http://localhost:3000');
    popWin.loadURL(targetUrl);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Languages directory manager - dynamically resolves path based on installation & execution context
function getLanguagesDirectory() {
  // 1. Check custom environment variable
  if (process.env.SOCDOF_LANGUAGES_DIR && fs.existsSync(process.env.SOCDOF_LANGUAGES_DIR)) {
    return process.env.SOCDOF_LANGUAGES_DIR;
  }

  // 2. Check next to executable (portable installation or custom install folder)
  try {
    const exeDir = path.dirname(process.execPath);
    const exeLangDir = path.join(exeDir, 'languages');
    if (fs.existsSync(exeLangDir)) {
      return exeLangDir;
    }
  } catch {}

  // 3. Check current working directory safely (ignore system or root directories)
  try {
    const cwd = process.cwd();
    if (cwd && !cwd.toLowerCase().includes('system32') && cwd.length > 3) {
      const cwdLangDir = path.join(cwd, 'languages');
      if (fs.existsSync(cwdLangDir)) {
        return cwdLangDir;
      }
    }
  } catch {}

  // 4. Default persistent AppData / UserData folder
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
      if (file.toLowerCase().startsWith('template')) continue;
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

// Templates directory manager (%APPDATA%/socdof/templates or local folder)
function getTemplatesDirectory() {
  if (process.env.SOCDOF_TEMPLATES_DIR && fs.existsSync(process.env.SOCDOF_TEMPLATES_DIR)) {
    return process.env.SOCDOF_TEMPLATES_DIR;
  }
  try {
    const exeDir = path.dirname(process.execPath);
    const exeTplDir = path.join(exeDir, 'templates');
    if (fs.existsSync(exeTplDir)) return exeTplDir;
  } catch {}
  try {
    const cwd = process.cwd();
    if (cwd && !cwd.toLowerCase().includes('system32') && cwd.length > 3) {
      const cwdTplDir = path.join(cwd, 'templates');
      if (fs.existsSync(cwdTplDir)) return cwdTplDir;
    }
  } catch {}
  const tplDir = path.join(app.getPath('userData'), 'templates');
  if (!fs.existsSync(tplDir)) {
    try {
      fs.mkdirSync(tplDir, { recursive: true });
    } catch {}
  }
  return tplDir;
}

function ensureTemplatesReadme() {
  const tplDir = getTemplatesDirectory();
  const readmePath = path.join(tplDir, 'README.txt');
  if (!fs.existsSync(readmePath)) {
    try {
      fs.writeFileSync(readmePath, `SOCDOF External Invoice & Document Templates Directory
======================================================
Directory: ${tplDir}

Place external Office templates, letterheads or background PDFs here:
- Microsoft Word Document (.docx / .doc)
- Adobe PDF Background Stationery (.pdf)
- JSON Invoice Templates (.json)
- HTML Template Layouts (.html)

SOCDOF automatically watches this folder and synchronizes all files into your template library.
`, 'utf8');
    } catch {}
  }
}

let templatesWatcher = null;
function setupTemplatesWatcher() {
  try {
    const tplDir = getTemplatesDirectory();
    ensureTemplatesReadme();
    if (templatesWatcher) {
      try { templatesWatcher.close(); } catch {}
    }
    templatesWatcher = fs.watch(tplDir, { persistent: false }, (eventType, filename) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('socdof:templates-folder-changed', { eventType, filename });
      }
    });
  } catch (err) {
    console.warn('Could not setup templates watcher:', err);
  }
}

ipcMain.handle('socdof:get-templates-folder-path', () => {
  return getTemplatesDirectory();
});

ipcMain.handle('socdof:open-templates-folder', async () => {
  const tplDir = getTemplatesDirectory();
  ensureTemplatesReadme();
  setupTemplatesWatcher();
  await shell.openPath(tplDir);
  return { success: true, path: tplDir };
});

ipcMain.handle('socdof:list-external-templates', async () => {
  try {
    const tplDir = getTemplatesDirectory();
    ensureTemplatesReadme();
    if (!fs.existsSync(tplDir)) return { success: true, templates: [] };

    const files = fs.readdirSync(tplDir);
    const validExtensions = ['.docx', '.doc', '.pdf', '.json', '.html', '.htm'];
    const results = [];

    for (const f of files) {
      if (f.toLowerCase() === 'readme.txt') continue;
      const ext = path.extname(f).toLowerCase();
      if (!validExtensions.includes(ext)) continue;

      const fullPath = path.join(tplDir, f);
      try {
        const stats = fs.statSync(fullPath);
        if (stats.isFile()) {
          results.push({
            filename: f,
            path: fullPath,
            size: stats.size,
            updatedAt: stats.mtime.toISOString(),
            ext: ext.replace('.', '')
          });
        }
      } catch {}
    }

    return { success: true, path: tplDir, templates: results };
  } catch (err) {
    console.error('Failed to list external templates:', err);
    return { success: false, error: err.message, templates: [] };
  }
});

ipcMain.handle('socdof:read-external-template-file', async (_event, filename) => {
  try {
    const tplDir = getTemplatesDirectory();
    const cleanFilename = path.basename(filename);
    const fullPath = path.join(tplDir, cleanFilename);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${cleanFilename}`);
    }
    const buffer = fs.readFileSync(fullPath);
    const base64 = buffer.toString('base64');
    return {
      success: true,
      filename: cleanFilename,
      path: fullPath,
      size: buffer.length,
      base64,
      ext: path.extname(cleanFilename).toLowerCase().replace('.', '')
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Persistent Desktop Preferences (%APPDATA%/socdof/preferences.json)
function getPreferencesFilePath() {
  const userDataDir = app.getPath('userData');
  if (!fs.existsSync(userDataDir)) {
    try { fs.mkdirSync(userDataDir, { recursive: true }); } catch {}
  }
  return path.join(userDataDir, 'preferences.json');
}

function readDesktopPreferences() {
  try {
    const p = getPreferencesFilePath();
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, 'utf8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('[SOCDOF Electron] Could not read preferences:', err);
  }
  return {};
}

function saveDesktopPreferences(prefs) {
  try {
    const p = getPreferencesFilePath();
    const current = readDesktopPreferences();
    const updated = { ...current, ...(prefs || {}) };
    fs.writeFileSync(p, JSON.stringify(updated, null, 2), 'utf8');
    return { success: true, preferences: updated };
  } catch (err) {
    console.error('[SOCDOF Electron] Failed to save preferences:', err);
    return { success: false, error: err.message };
  }
}

ipcMain.handle('socdof:get-preferences', () => {
  return readDesktopPreferences();
});

ipcMain.handle('socdof:save-preferences', (_event, prefs) => {
  return saveDesktopPreferences(prefs);
});

// Renderer-backed pre-update persistence.
// The installer replaces application files, not Electron userData, but we create
// a fresh database/localStorage snapshot first so an update can never depend on
// the installer touching user data. The update is aborted if the snapshot fails.
let pendingUpdateBackup = null;

ipcMain.on('socdof:update-backup-ready', (_event, requestId, result) => {
  if (pendingUpdateBackup && pendingUpdateBackup.requestId === requestId) {
    const pending = pendingUpdateBackup;
    pendingUpdateBackup = null;
    pending.resolve(result);
  }
});

function requestPreUpdateBackup() {
  return new Promise((resolve) => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      resolve({ success: false, error: 'SOCDOF window is not available.' });
      return;
    }

    const requestId = `update-backup-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const timeout = setTimeout(() => {
      if (pendingUpdateBackup && pendingUpdateBackup.requestId === requestId) {
        pendingUpdateBackup = null;
        resolve({ success: false, error: 'Pre-update backup timed out.' });
      }
    }, 20000);

    pendingUpdateBackup = {
      requestId,
      resolve: (result) => {
        clearTimeout(timeout);
        resolve(result);
      }
    };

    mainWindow.webContents.send('socdof:prepare-for-update', { requestId });
  });
}

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

    // Create a fresh renderer-side data snapshot before downloading/installing.
    // This includes the current IndexedDB database and relevant localStorage state.
    const backupResult = await requestPreUpdateBackup();
    if (!backupResult?.success) {
      throw new Error(`Update abgebrochen: Datensicherung vor dem Update fehlgeschlagen. ${backupResult?.error || ''}`.trim());
    }

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

// Backup directory manager - ensures Documents/SOCDOF/backups is pre-created and ready
function getBackupDirectory() {
  let documentsDir;
  try {
    documentsDir = app.getPath('documents');
  } catch {
    documentsDir = app.getPath('userData');
  }

  const socdofDir = path.join(documentsDir, 'SOCDOF');
  const backupDir = path.join(socdofDir, 'backups');

  try {
    if (!fs.existsSync(socdofDir)) {
      fs.mkdirSync(socdofDir, { recursive: true });
    }
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
  } catch (err) {
    console.warn('[SOCDOF Electron] Error preparing backup directories:', err);
  }

  return {
    socdofDir,
    backupDir
  };
}

ipcMain.handle('socdof:get-backup-folder-path', () => {
  return getBackupDirectory();
});

ipcMain.handle('socdof:select-backup-folder', async () => {
  const { socdofDir, backupDir } = getBackupDirectory();
  try {
    if (!fs.existsSync(socdofDir)) fs.mkdirSync(socdofDir, { recursive: true });
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

    const win = mainWindow && !mainWindow.isDestroyed() ? mainWindow : BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(win, {
      title: 'SOCDOF - Sicherungsordner auswählen',
      defaultPath: socdofDir, // Opens directly inside SOCDOF where "backups" is immediately visible!
      properties: ['openDirectory', 'createDirectory']
    });

    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return { canceled: true };
    }

    return { canceled: false, folderPath: result.filePaths[0] };
  } catch (err) {
    console.error('[SOCDOF Electron] Folder picker error:', err);
    return { canceled: false, folderPath: backupDir, error: err.message };
  }
});

ipcMain.handle('socdof:open-backup-folder', async (_event, customPath) => {
  const { backupDir } = getBackupDirectory();
  const target = customPath && fs.existsSync(customPath) ? customPath : backupDir;
  try {
    await shell.openPath(target);
    return { success: true, path: target };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('socdof:save-backup-file-to-disk', async (_event, payload) => {
  try {
    const { folderPath, fileName, content } = payload || {};
    const { backupDir } = getBackupDirectory();
    const targetDir = folderPath && fs.existsSync(folderPath) ? folderPath : backupDir;
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const fullPath = path.join(targetDir, fileName);
    fs.writeFileSync(fullPath, content, 'utf8');
    return { success: true, fullPath };
  } catch (err) {
    console.warn('[SOCDOF Electron] saveBackupFileToDisk error:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('socdof:get-discord-token', async () => {
  return getElectronDiscordBotToken();
});

ipcMain.handle('socdof:save-discord-token', async (_event, token) => {
  return saveElectronDiscordBotToken(token);
});

ipcMain.handle('socdof:send-discord-thread', async (_event, { channelId, threadData, botToken }) => {
  const targetChannelId = channelId || '1535709136363462757';
  const result = await executeDiscordHttpsRequest(`/channels/${targetChannelId}/threads`, 'POST', threadData, botToken);
  if (result.ok && result.data && result.data.id) {
    const threadId = result.data.id;
    const threadUrl = `https://discord.com/channels/1517532430095876266/${targetChannelId}/${threadId}`;
    return { success: true, threadId, threadUrl, data: result.data };
  }
  return { success: false, error: result.error || result.data?.message || 'Discord API Request Failed', status: result.status, details: result.data };
});

ipcMain.handle('socdof:trigger-botghost-webhook', async (_event, { url, payload, apiKey }) => {
  const targetUrl = url || 'https://api.botghost.com/webhook/1498764033518735441/t5dcd2k8x1n8i53932gf';
  const result = await executeBotghostWebhook(targetUrl, payload, apiKey);
  return { success: result.ok, status: result.status, data: result.data, error: result.error };
});

ipcMain.handle('socdof:discord-request', async (_event, { endpoint, method = 'GET', body, botToken }) => {
  return executeDiscordHttpsRequest(endpoint, method, body, botToken);
});

app.on('second-instance', () => {
  // If user tries to run a second instance (e.g. from installer or shortcut), focus existing window
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    if (!mainWindow.isVisible()) mainWindow.show();
    mainWindow.focus();
  }
});

app.whenReady().then(() => {
  createWindow();

  // Defer background language seed & backup folder readiness so the UI thread renders immediately
  setImmediate(() => {
    try {
      getBackupDirectory();
      ensureDefaultLanguageFiles();
      setupLanguagesFolderWatcher();
      setupTemplatesWatcher();
    } catch (e) {
      console.warn('Background init error:', e);
    }
  });

  // Defer mobile sync background HTTP server to avoid firewall / socket stalls during startup
  setTimeout(() => {
    try {
      startMobileSyncServer(3000);
    } catch (e) {
      console.warn('Mobile sync background server init error:', e);
    }
  }, 1200);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

