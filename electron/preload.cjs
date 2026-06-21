'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  apiBase: 'http://localhost:14747',

  // Update management
  checkForUpdates: () => ipcRenderer.send('check-for-updates'),
  installUpdate: () => ipcRenderer.send('install-update'),
  getVersion: () => ipcRenderer.invoke('get-version'),
  getMode: () => ipcRenderer.invoke('get-mode'),
  setMode: (mode) => ipcRenderer.invoke('set-mode', mode),

  // Update event listeners
  onUpdateChecking:      (cb) => { ipcRenderer.on('update-checking',     () => cb());       return () => ipcRenderer.removeAllListeners('update-checking'); },
  onUpdateAvailable:     (cb) => { ipcRenderer.on('update-available',    (_, i) => cb(i));  return () => ipcRenderer.removeAllListeners('update-available'); },
  onUpdateNotAvailable:  (cb) => { ipcRenderer.on('update-not-available',() => cb());       return () => ipcRenderer.removeAllListeners('update-not-available'); },
  onDownloadProgress:    (cb) => { ipcRenderer.on('download-progress',   (_, p) => cb(p));  return () => ipcRenderer.removeAllListeners('download-progress'); },
  onUpdateDownloaded:    (cb) => { ipcRenderer.on('update-downloaded',   () => cb());       return () => ipcRenderer.removeAllListeners('update-downloaded'); },
  onUpdateError:         (cb) => { ipcRenderer.on('update-error',        (_, e) => cb(e));  return () => ipcRenderer.removeAllListeners('update-error'); },
});
