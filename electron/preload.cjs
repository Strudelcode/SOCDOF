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
  onMobileSyncReceived: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('socdof:mobile-sync-received', listener);
    return () => ipcRenderer.removeListener('socdof:mobile-sync-received', listener);
  }
});
