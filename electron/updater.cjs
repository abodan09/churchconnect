'use strict';
const { autoUpdater } = require('electron-updater');
const { ipcMain } = require('electron');
const log = require('electron-log');

autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

// Explicitly set the feed URL so the embedded app-update.yml is never the source of truth.
autoUpdater.setFeedURL({
  provider: 'github',
  owner: 'abodan09',
  repo: 'churchconnect',
});

function setupUpdater(mainWindow) {
  autoUpdater.on('checking-for-update', () => {
    mainWindow.webContents.send('update-checking');
  });

  autoUpdater.on('update-available', (info) => {
    mainWindow.webContents.send('update-available', {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes,
    });
  });

  autoUpdater.on('update-not-available', () => {
    mainWindow.webContents.send('update-not-available');
  });

  autoUpdater.on('download-progress', (progress) => {
    mainWindow.webContents.send('download-progress', {
      percent: Math.round(progress.percent),
      transferred: progress.transferred,
      total: progress.total,
    });
  });

  autoUpdater.on('update-downloaded', () => {
    mainWindow.webContents.send('update-downloaded');
  });

  autoUpdater.on('error', (err) => {
    mainWindow.webContents.send('update-error', err.message);
  });

  // IPC: renderer triggers manual check
  ipcMain.on('check-for-updates', () => {
    autoUpdater.checkForUpdates().catch(() => {});
  });

  // IPC: renderer confirms install
  ipcMain.on('install-update', () => {
    autoUpdater.quitAndInstall(false, true);
  });

  // Auto-check 10 seconds after launch (gives the window time to load)
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, 10000);

  // Re-check every 4 hours
  setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, 4 * 60 * 60 * 1000);
}

module.exports = { setupUpdater };
