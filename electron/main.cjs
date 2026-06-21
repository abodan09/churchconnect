'use strict';
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { createServer } = require('./server.cjs');
const { initDb } = require('./db.cjs');

const LOCAL_PORT = 14747;
const SETTINGS_FILE = () => path.join(app.getPath('userData'), 'settings.json');

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE())) return JSON.parse(fs.readFileSync(SETTINGS_FILE(), 'utf8'));
  } catch {}
  return { mode: 'local' };
}

function saveSettings(settings) {
  try { fs.writeFileSync(SETTINGS_FILE(), JSON.stringify(settings, null, 2)); } catch {}
}

let mainWindow = null;

function createWindow(mode) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'ChurchConnect',
    icon: path.join(__dirname, '..', 'public', 'logo.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const url = mode === 'cloud'
    ? 'https://church.frozenbit.eu'
    : `http://localhost:${LOCAL_PORT}`;

  mainWindow.loadURL(url);

  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.on('closed', () => { mainWindow = null; });
}

async function startLocalServer() {
  const userDataPath = app.getPath('userData');
  initDb(userDataPath);

  const expressApp = createServer(userDataPath);

  return new Promise((resolve, reject) => {
    const server = expressApp.listen(LOCAL_PORT, '127.0.0.1', () => {
      console.log(`[ChurchConnect] Local server running on port ${LOCAL_PORT}`);
      resolve(server);
    });
    server.on('error', reject);
  });
}

app.whenReady().then(async () => {
  const settings = loadSettings();

  try {
    if (settings.mode !== 'cloud') {
      await startLocalServer();
    }
  } catch (err) {
    dialog.showErrorBox('Server Error', `Failed to start local server:\n${err.message}`);
    app.quit();
    return;
  }

  createWindow(settings.mode);

  // IPC handlers
  ipcMain.handle('get-version', () => app.getVersion());

  ipcMain.handle('get-mode', () => settings.mode);

  ipcMain.handle('set-mode', (_, mode) => {
    settings.mode = mode;
    saveSettings(settings);
    mainWindow?.loadURL(
      mode === 'cloud' ? 'https://church.frozenbit.eu' : `http://localhost:${LOCAL_PORT}`
    );
    return { ok: true };
  });

  // Set up auto-updater only in packaged app
  if (app.isPackaged) {
    try {
      const { setupUpdater } = require('./updater.cjs');
      setupUpdater(mainWindow);
    } catch (err) {
      console.warn('Updater not available:', err.message);
    }
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (!mainWindow) {
    const settings = loadSettings();
    createWindow(settings.mode);
  }
});
