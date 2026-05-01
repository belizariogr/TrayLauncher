'use strict';
const {
  app, BrowserWindow, Tray, nativeImage,
  screen, ipcMain, shell, nativeTheme, dialog,
} = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { createLauncherIconPNG } = require('./utils/createIcon');
const { extractAndSaveIcons, deleteIcons } = require('./utils/extractIcon');

const CONFIG_PATH = path.join(app.getPath('userData'), 'tray-launcher.json');
const ICONS_DIR   = path.join(app.getPath('userData'), 'icons');

let tray = null;
let launcherWin = null;
let settingsWin = null;

// ─── Config ─────────────────────────────────────────────────────────────────

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH))
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  } catch {}
  return { items: [], viewMode: 'icon' };
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

// ─── Launcher window ─────────────────────────────────────────────────────────

const LAUNCHER_W = 244;
const LAUNCHER_H = 332;

function createLauncherWin() {
  launcherWin = new BrowserWindow({
    width: LAUNCHER_W,
    height: LAUNCHER_H,
    show: false,
    frame: false,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    transparent: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Acrylic blur on Windows 11 (graceful fallback)
  try { launcherWin.setBackgroundMaterial('acrylic'); } catch {}

  launcherWin.loadFile(path.join(__dirname, 'renderer', 'launcher.html'));

  launcherWin.on('blur', () => {
    // Small delay so a settings-window click doesn't immediately hide launcher
    setTimeout(() => {
      if (launcherWin && !launcherWin.isDestroyed() && !launcherWin.isFocused()) {
        launcherWin.hide();
      }
    }, 80);
  });
}

function showLauncher() {
  if (!launcherWin || launcherWin.isDestroyed()) createLauncherWin();

  const { workArea } = screen.getPrimaryDisplay();
  const x = workArea.x + workArea.width - LAUNCHER_W - 8;
  const y = workArea.y + workArea.height - LAUNCHER_H - 8;

  launcherWin.setPosition(x, y);
  launcherWin.show();
  launcherWin.focus();
}

// ─── Settings window ─────────────────────────────────────────────────────────

function openSettings() {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.focus();
    return;
  }

  settingsWin = new BrowserWindow({
    width: 480,
    height: 580,
    title: 'TrayLauncher — Configurações',
    resizable: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  settingsWin.loadFile(path.join(__dirname, 'renderer', 'settings.html'));
  settingsWin.on('closed', () => { settingsWin = null; });
}

// ─── App init ────────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  app.setAppUserModelId('com.traylauncher.app');

  const isDark = nativeTheme.shouldUseDarkColors;
  const iconBuf = createLauncherIconPNG(isDark);          // light dots on dark bg
  const trayIcon = nativeImage.createFromBuffer(iconBuf).resize({ width: 16, height: 16 });

  tray = new Tray(trayIcon);
  tray.setToolTip('TrayLauncher');

  tray.on('click', () => {
    if (launcherWin && !launcherWin.isDestroyed() && launcherWin.isVisible()) {
      launcherWin.hide();
    } else {
      showLauncher();
    }
  });

  // Update tray icon when OS theme changes
  nativeTheme.on('updated', () => {
    const buf = createLauncherIconPNG(nativeTheme.shouldUseDarkColors);
    tray.setImage(nativeImage.createFromBuffer(buf).resize({ width: 16, height: 16 }));
    // Notify open windows
    [launcherWin, settingsWin].forEach(w => {
      if (w && !w.isDestroyed()) w.webContents.send('theme-changed');
    });
  });

  createLauncherWin();
});

// Keep app alive in tray when all windows are closed
app.on('window-all-closed', () => {});

// ─── Icon helpers ────────────────────────────────────────────────────────────

function itemId(filePath) {
  return crypto.createHash('md5').update(filePath).digest('hex').slice(0, 12);
}

/** Reads the best available icon PNG and returns as data URL, or null. */
function readIconDataUrl(id) {
  for (const size of [144, 96, 72, 48]) {
    const p = path.join(ICONS_DIR, `${id}-${size}.png`);
    try {
      if (fs.existsSync(p))
        return 'data:image/png;base64,' + fs.readFileSync(p).toString('base64');
    } catch {}
  }
  return null;
}

// ─── IPC handlers ────────────────────────────────────────────────────────────

ipcMain.handle('get-config', () => {
  const config = loadConfig();
  config.items = config.items.map(item => ({
    ...item,
    iconDataUrl: item.id ? readIconDataUrl(item.id) : null,
  }));
  return config;
});

ipcMain.handle('save-config', (_, config) => {
  const old = loadConfig();
  // Delete icons for removed items
  const newIds = new Set(config.items.map(i => i.id).filter(Boolean));
  for (const item of old.items) {
    if (item.id && !newIds.has(item.id)) deleteIcons(item.id, ICONS_DIR);
  }
  // Strip transient iconDataUrl before persisting
  const toSave = { ...config, items: config.items.map(({ iconDataUrl, ...rest }) => rest) };
  saveConfig(toSave);
  if (launcherWin && !launcherWin.isDestroyed()) {
    launcherWin.webContents.send('refresh');
  }
});

ipcMain.handle('get-theme', () => ({ dark: nativeTheme.shouldUseDarkColors }));

ipcMain.handle('add-item', async (_, filePath) => {
  const id   = itemId(filePath);
  const base = path.basename(filePath);
  const ext  = path.extname(base);
  const name = ext ? base.slice(0, -ext.length) : base;

  await extractAndSaveIcons(filePath, id, ICONS_DIR);

  const config = loadConfig();
  // Avoid duplicates
  if (!config.items.find(i => i.id === id)) {
    config.items.push({ id, name, path: filePath });
    saveConfig(config);
  }
  if (launcherWin && !launcherWin.isDestroyed()) {
    launcherWin.webContents.send('refresh');
  }
  return { id, name, path: filePath, iconDataUrl: readIconDataUrl(id) };
});

ipcMain.handle('launch-item', async (_, itemPath) => {
  const err = await shell.openPath(itemPath);
  if (err) console.error('launch error:', err);
});

ipcMain.handle('launcher-hide', () => {
  if (launcherWin && !launcherWin.isDestroyed()) launcherWin.hide();
});

ipcMain.handle('open-settings', () => {
  if (launcherWin && !launcherWin.isDestroyed()) launcherWin.hide();
  openSettings();
});

ipcMain.handle('quit-app', async () => {
  const { response } = await dialog.showMessageBox({
    type: 'question',
    buttons: ['Sim', 'Não'],
    defaultId: 1,
    cancelId: 1,
    title: 'TrayLauncher',
    message: 'Fechar o TrayLauncher?',
    detail: 'O aplicativo será removido da barra de tarefas.',
  });
  if (response === 0) app.quit();
});

ipcMain.handle('select-path', async (_, type) => {
  const isFolder = type === 'folder';
  const result = await dialog.showOpenDialog({
    properties: isFolder ? ['openDirectory'] : ['openFile'],
    filters: isFolder ? [] : [
      { name: 'Executáveis e Atalhos', extensions: ['exe', 'bat', 'cmd', 'lnk'] },
      { name: 'Todos os Arquivos', extensions: ['*'] },
    ],
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('get-basename', (_, filePath) => {
  const base = path.basename(filePath);
  // Strip extension for display, but keep for folders
  const ext = path.extname(base);
  return ext ? base.slice(0, -ext.length) : base;
});
