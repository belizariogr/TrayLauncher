'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getConfig:    ()           => ipcRenderer.invoke('get-config'),
  saveConfig:   (cfg)        => ipcRenderer.invoke('save-config', cfg),
  getTheme:     ()           => ipcRenderer.invoke('get-theme'),
  getIcon:      (p)          => ipcRenderer.invoke('get-icon', p),
  launchItem:   (p)          => ipcRenderer.invoke('launch-item', p),
  launcherHide: ()           => ipcRenderer.invoke('launcher-hide'),
  openSettings: ()           => ipcRenderer.invoke('open-settings'),
  quitApp:      ()           => ipcRenderer.invoke('quit-app'),
  selectPath:   (type)       => ipcRenderer.invoke('select-path', type),
  getBasename:  (p)          => ipcRenderer.invoke('get-basename', p),
  onRefresh:    (cb)         => ipcRenderer.on('refresh', cb),
  onThemeChange:(cb)         => ipcRenderer.on('theme-changed', cb),
});
