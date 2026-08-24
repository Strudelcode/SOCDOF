const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');

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
    icon: path.join(__dirname, '../public/socdof_icon.svg'),
    backgroundColor: '#0b0f19',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
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
