const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  getPlatformInfo: () => ipcRenderer.invoke('socdof:get-platform'),
  quitApp: () => ipcRenderer.invoke('socdof:quit-app'),
  downloadAndInstallUpdate: (payload) => ipcRenderer.invoke('socdof:download-and-install-update', payload),
  onUpdateDownloadProgress: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('socdof:update-download-progress', listener);
    return () => ipcRenderer.removeListener('socdof:update-download-progress', listener);
  },
  getNetworkIps: () => ipcRenderer.invoke('socdof:get-network-ips'),
  getLanguagesFolderPath: () => ipcRenderer.invoke('socdof:get-languages-folder-path'),
  openLanguagesFolder: () => ipcRenderer.invoke('socdof:open-languages-folder'),
  getFlagsFolderPath: () => ipcRenderer.invoke('socdof:get-flags-folder-path'),
  openFlagsFolder: () => ipcRenderer.invoke('socdof:open-flags-folder'),
  getAvailableFlags: () => ipcRenderer.invoke('socdof:get-available-flags'),
  readLocalLanguages: () => ipcRenderer.invoke('socdof:read-local-languages'),
  saveLocalLanguageFile: (payload) => ipcRenderer.invoke('socdof:save-local-language-file', payload),
  onLanguagesFolderChanged: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('socdof:languages-folder-changed', listener);
    return () => ipcRenderer.removeListener('socdof:languages-folder-changed', listener);
  },
  onMobileSyncReceived: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('socdof:mobile-sync-received', listener);
    return () => ipcRenderer.removeListener('socdof:mobile-sync-received', listener);
  },
  getBackupFolderPath: () => ipcRenderer.invoke('socdof:get-backup-folder-path'),
  selectBackupFolder: () => ipcRenderer.invoke('socdof:select-backup-folder'),
  openBackupFolder: (targetPath) => ipcRenderer.invoke('socdof:open-backup-folder', targetPath),
  saveBackupFileToDisk: (payload) => ipcRenderer.invoke('socdof:save-backup-file-to-disk', payload),
  toggleFullscreen: () => ipcRenderer.invoke('socdof:toggle-fullscreen'),
  isFullscreen: () => ipcRenderer.invoke('socdof:is-fullscreen'),
  getPreferences: () => ipcRenderer.invoke('socdof:get-preferences'),
  savePreferences: (prefs) => ipcRenderer.invoke('socdof:save-preferences', prefs)
});
