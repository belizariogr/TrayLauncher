'use strict';
/* global api */

let config = { items: [], viewMode: 'icon' };

async function init() {
  await window.loadTranslations();

  const { dark } = await api.getTheme();
  document.body.classList.toggle('dark', dark);

  // Set language selector to current locale
  const locale = await api.getLocale();
  document.getElementById('select-language').value = locale;
  document.getElementById('select-language').addEventListener('change', async (e) => {
    await api.setLocale(e.target.value);
  });

  config = await api.getConfig();
  applyViewMode();
  await renderItems();

  document.getElementById('btn-icons').addEventListener('click', () => setViewMode('icon'));
  document.getElementById('btn-list').addEventListener('click', () => setViewMode('list'));
  document.getElementById('btn-add-file').addEventListener('click', () => addItem('file'));
  document.getElementById('btn-add-folder').addEventListener('click', () => addItem('folder'));
  document.getElementById('btn-add-separator').addEventListener('click', addSeparator);

  // ── Icon picker modal wiring ──────────────────────────────────────────────
  document.getElementById('modal-close') .addEventListener('click', closeIconModal);
  document.getElementById('modal-cancel').addEventListener('click', closeIconModal);
  document.getElementById('modal-pick-file').addEventListener('click', pickIconFile);
  document.getElementById('modal-apply').addEventListener('click', applySelectedIcon);
  document.getElementById('icon-modal').addEventListener('click', (e) => {
    if (e.target.id === 'icon-modal') closeIconModal();
  });

  // ── About modal wiring ────────────────────────────────────────────────────
  document.getElementById('btn-about').addEventListener('click', openAboutModal);
  document.getElementById('about-modal-close').addEventListener('click', closeAboutModal);
  document.getElementById('about-close').addEventListener('click', closeAboutModal);
  document.getElementById('about-modal').addEventListener('click', (e) => {
    if (e.target.id === 'about-modal') closeAboutModal();
  });
  document.getElementById('about-email-btn').addEventListener('click', () => {
    api.openExternal('mailto:belizariogr@gmail.com');
  });

  api.onThemeChange(async () => {
    const { dark: d } = await api.getTheme();
    document.body.classList.toggle('dark', d);
  });

  api.onLocaleChange(async () => {
    await window.loadTranslations();
    const newLocale = await api.getLocale();
    document.getElementById('select-language').value = newLocale;
    await renderItems();
  });
}

async function openAboutModal() {
  const version = await api.getAppVersion();
  document.getElementById('about-version').textContent = `v${version}`;
  document.getElementById('about-modal').classList.remove('hidden');
}

function closeAboutModal() {
  document.getElementById('about-modal').classList.add('hidden');
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
    list.innerHTML = `<p class="empty-hint">${t('emptyHint')}</p>`;
    return;
  }

  config.items.forEach((item, i) => list.appendChild(buildRow(item, i, item.iconDataUrl)));
}

let dragSrcIndex = null;

function buildRow(item, index, iconSrc) {
  // ── Separator row ──────────────────────────────────────────────────────────
  if (item.type === 'separator') {
    const row = document.createElement('div');
    row.className = 'item-row item-row-separator';
    row.draggable = true;
    row.dataset.index = index;

    const handle = document.createElement('span');
    handle.className = 'drag-handle';
    handle.innerHTML = '&#8942;&#8942;';
    handle.title = t('dragHandle');

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

    const line = document.createElement('div');
    line.className = 'separator-line';

    const label = document.createElement('span');
    label.className = 'separator-label';
    label.textContent = t('separatorLabel');

    const btnRemove = document.createElement('button');
    btnRemove.className = 'btn-remove';
    btnRemove.title = t('remove');
    btnRemove.textContent = '✕';
    btnRemove.addEventListener('click', () => {
      config.items.splice(index, 1);
      save();
      renderItems();
    });

    row.appendChild(handle);
    row.appendChild(line);
    row.appendChild(label);
    row.appendChild(btnRemove);
    return row;
  }

  // ── Regular item row ───────────────────────────────────────────────────────
  const row = document.createElement('div');
  row.className = 'item-row';
  row.draggable = true;
  row.dataset.index = index;

  // Drag handle
  const handle = document.createElement('span');
  handle.className = 'drag-handle';
  handle.innerHTML = '&#8942;&#8942;'; // ⋮⋮
    handle.title = t('dragHandle');
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
  img.src   = iconSrc || fallbackSvg();
  img.alt   = '';
  img.className = 'item-icon';
  img.title = t('changeIcon');
  img.addEventListener('click', () => openIconModal(item, index));

  const info = document.createElement('div');
  info.className = 'item-info';

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'editable';
  nameInput.value = item.name;
  nameInput.title = t('rename');
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
  btnRemove.title = t('remove');
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

function addSeparator() {
  config.items.push({ type: 'separator' });
  save();
  renderItems();
}

function save() {
  return api.saveConfig(config);
}

function fallbackSvg() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
    stroke="gray" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

// ─── Icon picker modal ────────────────────────────────────────────────────────

let iconModalState = { itemId: null, itemIndex: null, selectedDataUrl: null, svgContent: null };

function openIconModal(item, index) {
  iconModalState = { itemId: item.id, itemIndex: index, selectedDataUrl: null, svgContent: null };
  document.getElementById('icon-modal').classList.remove('hidden');
  document.getElementById('icon-grid').innerHTML      = '';
  document.getElementById('modal-file-label').textContent = '';
  document.getElementById('modal-loading').classList.add('hidden');
  document.getElementById('modal-empty').classList.add('hidden');
  document.getElementById('modal-apply').disabled = true;
}

function closeIconModal() {
  document.getElementById('icon-modal').classList.add('hidden');
  iconModalState = { itemId: null, itemIndex: null, selectedDataUrl: null, svgContent: null };
}

async function pickIconFile() {
  const filePath = await api.openIconPicker();
  if (!filePath) return;

  const fileName = filePath.replace(/.*[/\\]/, '');
  document.getElementById('modal-file-label').textContent = fileName;
  document.getElementById('modal-loading').classList.remove('hidden');
  document.getElementById('modal-empty').classList.add('hidden');
  document.getElementById('icon-grid').innerHTML = '';
  document.getElementById('modal-apply').disabled = true;
  iconModalState.selectedDataUrl = null;
  iconModalState.svgContent      = null;

  const icons = await api.extractFileIcons(filePath);
  document.getElementById('modal-loading').classList.add('hidden');

  if (!icons || icons.length === 0) {
    document.getElementById('modal-empty').classList.remove('hidden');
    return;
  }
  renderIconGrid(icons);
}

function renderIconGrid(icons) {
  const grid = document.getElementById('icon-grid');
  grid.innerHTML = '';

  for (const icon of icons) {
    const cell = document.createElement('div');
    cell.className = 'icon-cell';

    const img = document.createElement('img');
    img.alt = '';

    if (icon.type === 'svg') {
      const encoded = btoa(unescape(encodeURIComponent(icon.content)));
      img.src = `data:image/svg+xml;base64,${encoded}`;
      cell.addEventListener('click', () => {
        grid.querySelectorAll('.icon-cell').forEach(c => c.classList.remove('selected'));
        cell.classList.add('selected');
        iconModalState.selectedDataUrl = null;
        iconModalState.svgContent      = icon.content;
        document.getElementById('modal-apply').disabled = false;
      });
    } else {
      img.src = icon.dataUrl;
      cell.addEventListener('click', () => {
        grid.querySelectorAll('.icon-cell').forEach(c => c.classList.remove('selected'));
        cell.classList.add('selected');
        iconModalState.selectedDataUrl = icon.dataUrl;
        iconModalState.svgContent      = null;
        document.getElementById('modal-apply').disabled = false;
      });
    }

    cell.appendChild(img);
    grid.appendChild(cell);
  }
}

async function applySelectedIcon() {
  const { itemId, itemIndex, selectedDataUrl, svgContent } = iconModalState;
  if (!itemId) return;

  let pngDataUrl = selectedDataUrl;

  if (svgContent) {
    pngDataUrl = await renderSvgToCanvas(svgContent, 256);
    if (!pngDataUrl) return;
  }

  if (!pngDataUrl) return;

  const newDataUrl = await api.applyItemIcon({ itemId, pngDataUrl });
  if (newDataUrl && itemIndex !== null) {
    const rows = document.querySelectorAll('.item-row');
    if (rows[itemIndex]) {
      const imgEl = rows[itemIndex].querySelector('img.item-icon');
      if (imgEl) imgEl.src = newDataUrl;
    }
    config.items[itemIndex].iconDataUrl = newDataUrl;
  }

  closeIconModal();
}

function renderSvgToCanvas(svgContent, size) {
  return new Promise((resolve) => {
    const img     = new Image();
    const encoded = btoa(unescape(encodeURIComponent(svgContent)));
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width  = size;
      canvas.height = size;
      canvas.getContext('2d').drawImage(img, 0, 0, size, size);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(null);
    img.src = `data:image/svg+xml;base64,${encoded}`;
  });
}

init();
