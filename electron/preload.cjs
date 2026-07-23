'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  apiBase: 'http://localhost:14747',

  // Update management
  checkForUpdates: () => ipcRenderer.send('check-for-updates'),
  downloadUpdate: () => ipcRenderer.send('download-update'),
  installUpdate: () => ipcRenderer.send('install-update'),
  getVersion: () => ipcRenderer.invoke('get-version'),
  getMode: () => ipcRenderer.invoke('get-mode'),
  setMode: (mode) => ipcRenderer.invoke('set-mode', mode),

  // Cloud sync
  getSyncStatus: () => ipcRenderer.invoke('sync:get-status'),
  syncNow: () => ipcRenderer.send('sync:run-now'),
  enableSync: (email, password) => ipcRenderer.invoke('sync:enable', { email, password }),
  disableSync: () => ipcRenderer.invoke('sync:disable'),
  onSyncStatus: (cb) => { const h = (_, s) => cb(s); ipcRenderer.on('sync:status', h); return () => ipcRenderer.removeListener('sync:status', h); },

  // Update event listeners
  onUpdateChecking:      (cb) => { ipcRenderer.on('update-checking',     () => cb());       return () => ipcRenderer.removeAllListeners('update-checking'); },
  onUpdateAvailable:     (cb) => { ipcRenderer.on('update-available',    (_, i) => cb(i));  return () => ipcRenderer.removeAllListeners('update-available'); },
  onUpdateNotAvailable:  (cb) => { ipcRenderer.on('update-not-available',() => cb());       return () => ipcRenderer.removeAllListeners('update-not-available'); },
  onDownloadProgress:    (cb) => { ipcRenderer.on('download-progress',   (_, p) => cb(p));  return () => ipcRenderer.removeAllListeners('download-progress'); },
  onUpdateDownloaded:    (cb) => { ipcRenderer.on('update-downloaded',   () => cb());       return () => ipcRenderer.removeAllListeners('update-downloaded'); },
  onUpdateError:         (cb) => { ipcRenderer.on('update-error',        (_, e) => cb(e));  return () => ipcRenderer.removeAllListeners('update-error'); },
  onMenuCheckForUpdates: (cb) => { ipcRenderer.on('menu-check-for-updates', () => cb());   return () => ipcRenderer.removeAllListeners('menu-check-for-updates'); },
});
