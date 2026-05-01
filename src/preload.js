'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getConfig:       ()      => ipcRenderer.invoke('get-config'),
  saveConfig:      (cfg)   => ipcRenderer.invoke('save-config', cfg),
  getTheme:        ()      => ipcRenderer.invoke('get-theme'),
  getIconsBatch:   (paths) => ipcRenderer.invoke('get-icons-batch', paths),
  addItem:         (p)     => ipcRenderer.invoke('add-item', p),
  launchItem:      (p)     => ipcRenderer.invoke('launch-item', p),
  launcherHide:    ()      => ipcRenderer.invoke('launcher-hide'),
  openSettings:    ()      => ipcRenderer.invoke('open-settings'),
  quitApp:         ()      => ipcRenderer.invoke('quit-app'),
  selectPath:      (type)  => ipcRenderer.invoke('select-path', type),
  getBasename:     (p)     => ipcRenderer.invoke('get-basename', p),
  openIconPicker:  ()      => ipcRenderer.invoke('open-icon-picker'),
  extractFileIcons:(p)     => ipcRenderer.invoke('extract-file-icons', p),
  applyItemIcon:   (d)     => ipcRenderer.invoke('apply-item-icon', d),
  getLocale:       ()      => ipcRenderer.invoke('get-locale'),
  setLocale:       (l)     => ipcRenderer.invoke('set-locale', l),
  getTranslations: ()      => ipcRenderer.invoke('get-translations'),
  onRefresh:       (cb)    => ipcRenderer.on('refresh', cb),
  onThemeChange:   (cb)    => ipcRenderer.on('theme-changed', cb),
  onLocaleChange:  (cb)    => ipcRenderer.on('locale-changed', cb),
});
