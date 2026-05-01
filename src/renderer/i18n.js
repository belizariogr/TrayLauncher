'use strict';
/* global api */

window._i18n = {};

window.t = function (key) {
  return window._i18n[key] || key;
};

window.loadTranslations = async function () {
  window._i18n = await api.getTranslations();
  _applyDomTranslations();
};

function _applyDomTranslations() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = window.t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => {
    el.title = window.t(el.dataset.i18nTitle);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.placeholder = window.t(el.dataset.i18nPlaceholder);
  });
}
