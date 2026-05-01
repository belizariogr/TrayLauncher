'use strict';
/* global api */

let config = { items: [], viewMode: 'icon' };

async function applyTheme() {
  const { dark } = await api.getTheme();
  document.body.classList.toggle('light', !dark);
}

async function renderItems() {
  const grid = document.getElementById('grid');
  grid.innerHTML = '';
  grid.className = config.viewMode === 'list' ? 'list-mode' : 'icon-mode';

  if (!config.items.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <span>Nenhum item adicionado.</span>
        <span>Clique em ⚙ para configurar.</span>
      </div>`;
    return;
  }

  // Load all icons in parallel, then render in order
  const icons = await Promise.all(config.items.map(item => api.getIcon(item.path)));

  config.items.forEach((item, i) => {
    const el = buildItem(item, icons[i]);
    grid.appendChild(el);
  });
}

function buildItem(item, iconSrc) {
  const isIcon = config.viewMode === 'icon';
  const el = document.createElement('div');
  el.className = isIcon ? 'item-icon' : 'item-list';

  const img = document.createElement('img');
  img.src = iconSrc || fallbackSvg();
  img.alt = item.name;
  img.width = isIcon ? 48 : 24;
  img.height = isIcon ? 48 : 24;

  const name = document.createElement('span');
  name.className = 'item-name';
  name.textContent = item.name;

  el.appendChild(img);
  el.appendChild(name);

  el.addEventListener('click', () => {
    api.launchItem(item.path);
    api.launcherHide();
  });

  return el;
}

function fallbackSvg() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
    stroke="gray" stroke-width="2">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
  </svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

async function init() {
  await applyTheme();
  config = await api.getConfig();
  await renderItems();

  document.getElementById('btn-settings').addEventListener('click', () => api.openSettings());
  document.getElementById('btn-quit').addEventListener('click', () => api.quitApp());

  api.onRefresh(async () => {
    config = await api.getConfig();
    await renderItems();
  });

  api.onThemeChange(async () => {
    await applyTheme();
  });
}

init();
