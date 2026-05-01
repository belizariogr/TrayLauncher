'use strict';
/* global api */

let config = { items: [], viewMode: 'icon' };

async function init() {
  const { dark } = await api.getTheme();
  document.body.classList.toggle('dark', dark);

  config = await api.getConfig();
  applyViewMode();
  await renderItems();

  document.getElementById('btn-icons').addEventListener('click', () => setViewMode('icon'));
  document.getElementById('btn-list').addEventListener('click', () => setViewMode('list'));
  document.getElementById('btn-add-file').addEventListener('click', () => addItem('file'));
  document.getElementById('btn-add-folder').addEventListener('click', () => addItem('folder'));

  api.onThemeChange(async () => {
    const { dark: d } = await api.getTheme();
    document.body.classList.toggle('dark', d);
  });
}

function setViewMode(mode) {
  config.viewMode = mode;
  applyViewMode();
  save();
}

function applyViewMode() {
  document.getElementById('btn-icons').classList.toggle('active', config.viewMode === 'icon');
  document.getElementById('btn-list').classList.toggle('active', config.viewMode === 'list');
}

async function renderItems() {
  const list = document.getElementById('items-list');
  list.innerHTML = '';

  if (!config.items.length) {
    list.innerHTML = '<p class="empty-hint">Nenhum item. Clique em "+ Adicionar".</p>';
    return;
  }

  const icons = await Promise.all(config.items.map(item => api.getIcon(item.path)));

  config.items.forEach((item, i) => {
    list.appendChild(buildRow(item, i, icons[i]));
  });
}

function buildRow(item, index, iconSrc) {
  const row = document.createElement('div');
  row.className = 'item-row';

  const img = document.createElement('img');
  img.src = iconSrc || fallbackSvg();
  img.alt = '';

  const info = document.createElement('div');
  info.className = 'item-info';

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'editable';
  nameInput.value = item.name;
  nameInput.title = 'Clique para renomear';
  nameInput.addEventListener('change', () => {
    config.items[index].name = nameInput.value.trim() || item.name;
    save();
  });

  const pathSpan = document.createElement('span');
  pathSpan.className = 'item-path';
  pathSpan.textContent = item.path;
  pathSpan.title = item.path;

  info.appendChild(nameInput);
  info.appendChild(pathSpan);

  const btnRemove = document.createElement('button');
  btnRemove.className = 'btn-remove';
  btnRemove.title = 'Remover';
  btnRemove.textContent = '✕';
  btnRemove.addEventListener('click', () => {
    config.items.splice(index, 1);
    save();
    renderItems();
  });

  row.appendChild(img);
  row.appendChild(info);
  row.appendChild(btnRemove);
  return row;
}

async function addItem(type) {
  const filePath = await api.selectPath(type);
  if (!filePath) return;

  const name = await api.getBasename(filePath);
  config.items.push({ name, path: filePath });
  await save();
  await renderItems();
}

function save() {
  return api.saveConfig(config);
}

function fallbackSvg() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
    stroke="gray" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

init();
