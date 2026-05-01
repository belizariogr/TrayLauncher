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

  config.items.forEach((item, i) => list.appendChild(buildRow(item, i, item.iconDataUrl)));
}

let dragSrcIndex = null;

function buildRow(item, index, iconSrc) {
  const row = document.createElement('div');
  row.className = 'item-row';
  row.draggable = true;
  row.dataset.index = index;

  // Drag handle
  const handle = document.createElement('span');
  handle.className = 'drag-handle';
  handle.innerHTML = '&#8942;&#8942;'; // ⋮⋮
  handle.title = 'Arrastar para reordenar';

  // Events — only start drag from handle
  handle.addEventListener('mousedown', () => { row.draggable = true; });
  row.addEventListener('dragstart', (e) => {
    dragSrcIndex = index;
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => row.classList.add('dragging'), 0);
  });
  row.addEventListener('dragend', () => {
    row.classList.remove('dragging');
    document.querySelectorAll('.item-row').forEach(r => r.classList.remove('drag-over'));
  });
  row.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    document.querySelectorAll('.item-row').forEach(r => r.classList.remove('drag-over'));
    row.classList.add('drag-over');
  });
  row.addEventListener('drop', (e) => {
    e.preventDefault();
    const targetIndex = parseInt(row.dataset.index);
    if (dragSrcIndex === null || dragSrcIndex === targetIndex) return;
    const [moved] = config.items.splice(dragSrcIndex, 1);
    config.items.splice(targetIndex, 0, moved);
    dragSrcIndex = null;
    save();
    renderItems();
  });

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

  row.appendChild(handle);
  row.appendChild(img);
  row.appendChild(info);
  row.appendChild(btnRemove);
  return row;
}

async function addItem(type) {
  const filePath = await api.selectPath(type);
  if (!filePath) return;

  await api.addItem(filePath);
  config = await api.getConfig();
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
