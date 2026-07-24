'use strict';
const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
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

  // Keep the sync engine pointed at the live window (macOS reopen recreates it).
  try { require('./sync.cjs').setWindow(mainWindow); } catch { /* sync module optional */ }

  buildMenu();
}

function buildMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        { role: 'quit', label: 'Exit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' }, { role: 'forceReload' },
        { type: 'separator' },
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' }, { role: 'zoom' }, { role: 'close' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About ChurchConnect',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About ChurchConnect',
              message: `ChurchConnect  v${app.getVersion()}`,
              detail: 'A complete church management platform for the modern church.\n\nDeveloped by FrozenBit\nadmin@frozenbit.eu\nchurchconnect.frozenbit.eu',
              buttons: ['OK'],
            });
          },
        },
        { type: 'separator' },
        {
          label: 'Help & Documentation',
          click: () => shell.openExternal('https://github.com/abodan09/churchconnect/releases'),
        },
        {
          label: 'FAQ',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Frequently Asked Questions',
              message: 'ChurchConnect FAQ',
              detail: [
                'Q: Where is my data stored?\nA: In Offline mode, all data is stored locally on your computer under AppData\\Roaming\\ChurchConnect.',
                '',
                'Q: Can I switch between Offline and Cloud mode?\nA: Yes — use the mode toggle in the app sidebar.',
                '',
                'Q: How do I back up my data?\nA: Copy the churchconnect.db file from AppData\\Roaming\\ChurchConnect to a safe location.',
                '',
                'Q: Is an internet connection required?\nA: No. Offline mode works entirely without internet.',
                '',
                'Q: How do I add more users in Offline mode?\nA: Currently one local admin account is supported. Multi-user offline support is planned.',
              ].join('\n'),
              buttons: ['Close'],
            });
          },
        },
        { type: 'separator' },
        {
          label: 'Register Product',
          enabled: false,
          toolTip: 'Product registration will be available in a future update',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Register Product',
              message: 'Product Registration',
              detail: 'Product registration is not required in this version.\n\nThis feature will be available in a future update.',
              buttons: ['OK'],
            });
          },
        },
        { type: 'separator' },
        {
          label: 'Check for Updates…',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('menu-check-for-updates');
          },
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// Per-device signing key for the local JWTs — generated once and persisted in
// userData, so packaged builds never fall back to the shared hardcoded secret
// (which would let a low-privileged local user forge an admin token).
function ensureLocalJwtSecret() {
  try {
    const p = path.join(app.getPath('userData'), 'device-secret');
    if (fs.existsSync(p)) { const s = fs.readFileSync(p, 'utf8').trim(); if (s) return s; }
    const s = require('crypto').randomBytes(32).toString('hex');
    fs.writeFileSync(p, s, { mode: 0o600 });
    return s;
  } catch { return null; }
}

async function startLocalServer() {
  const userDataPath = app.getPath('userData');
  const secret = ensureLocalJwtSecret();
  if (secret) process.env.LOCAL_JWT_SECRET = secret;
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

  // Background cloud sync — local/offline mode only (cloud mode loads the live site).
  if (settings.mode !== 'cloud') {
    try {
      const sync = require('./sync.cjs');
      sync.init(mainWindow, { cloudUrl: process.env.CHURCHCONNECT_CLOUD_URL || 'https://church.frozenbit.eu' });
      ipcMain.handle('sync:get-status', () => sync.getStatus());
      ipcMain.on('sync:run-now', () => sync.runSync({ reason: 'manual' }));
      ipcMain.handle('sync:enable', (_, args) => sync.enableSync(args || {}));
      ipcMain.handle('sync:disable', () => sync.disableSync());
      sync.start();
    } catch (err) {
      console.warn('Sync not available:', err.message);
    }
  }

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
