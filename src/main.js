'use strict';
const {
  app, BrowserWindow, Tray, nativeImage,
  screen, ipcMain, shell, nativeTheme, dialog,
} = require('electron');
const path = require('path');
const fs = require('fs');
const { createLauncherIconPNG } = require('./utils/createIcon');

const CONFIG_PATH = path.join(app.getPath('userData'), 'tray-launcher.json');

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

// ─── IPC handlers ────────────────────────────────────────────────────────────

ipcMain.handle('get-config', () => loadConfig());

ipcMain.handle('save-config', (_, config) => {
  saveConfig(config);
  // Refresh launcher if it's open
  if (launcherWin && !launcherWin.isDestroyed()) {
    launcherWin.webContents.send('refresh');
  }
});

ipcMain.handle('get-theme', () => ({ dark: nativeTheme.shouldUseDarkColors }));

ipcMain.handle('get-icon', async (_, filePath) => {
  try {
    const icon = await app.getFileIcon(filePath, { size: 'large' });
    return icon.toDataURL();
  } catch {
    return null;
  }
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
