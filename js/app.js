/**
 * Master Application Coordinator
 * Tab navigation, keyboard accessibility, theme management,
 * PWA Service Worker lifecycle, and APK download links.
 */
(function() {
  'use strict';

  var state = null;
  var swRegistration = null;

  document.addEventListener('DOMContentLoaded', initApp);

  function initApp() {
    // 1. Load State
    if (window.StorageManager) {
      state = window.StorageManager.loadState();
    } else {
      state = { tab: 'price', theme: 'dark', products: [], percent: {} };
    }

    // 2. Setup Theme
    applyTheme(state.theme);
    setupThemeToggle();

    // 3. Initialize Tabs
    setupTabs();

    // 5. Initialize Sub-modules
    var pricePanel = document.getElementById('panelPrice');
    var percentPanel = document.getElementById('panelPercent');

    if (window.UiPrice && pricePanel) {
      window.UiPrice.init(pricePanel, state, saveState);
    }
    if (window.UiPercent && percentPanel) {
      window.UiPercent.init(percentPanel, state, saveState);
    }

    // 6. Handle URL Hash
    handleHashNavigation();
    window.addEventListener('hashchange', handleHashNavigation);

    // 7. Register Service Worker
    setupServiceWorker();
  }

  function saveState() {
    if (window.StorageManager && state) {
      window.StorageManager.saveState(state);
    }
  }

  /* --- Tabs Management --- */
  function setupTabs() {
    var tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(function(btn) {
      btn.addEventListener('click', function() {
        var targetTab = btn.dataset.tab;
        switchTab(targetTab);
      });

      // Keyboard accessibility (ArrowLeft, ArrowRight, Home, End)
      btn.addEventListener('keydown', function(e) {
        var tabList = Array.from(tabs);
        var idx = tabList.indexOf(btn);
        var nextIdx = -1;

        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          nextIdx = (idx + 1) % tabList.length;
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          nextIdx = (idx - 1 + tabList.length) % tabList.length;
        } else if (e.key === 'Home') {
          nextIdx = 0;
        } else if (e.key === 'End') {
          nextIdx = tabList.length - 1;
        }

        if (nextIdx !== -1) {
          e.preventDefault();
          tabList[nextIdx].focus();
          switchTab(tabList[nextIdx].dataset.tab);
        }
      });
    });
  }

  function switchTab(tabKey) {
    if (tabKey !== 'price' && tabKey !== 'percent') tabKey = 'price';
    state.tab = tabKey;
    saveState();

    if (navigator.vibrate) {
      try { navigator.vibrate(10); } catch (e) {}
    }

    var tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(function(btn) {
      var isActive = btn.dataset.tab === tabKey;
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
      btn.setAttribute('tabindex', isActive ? '0' : '-1');
    });

    var panelPrice = document.getElementById('panelPrice');
    var panelPercent = document.getElementById('panelPercent');

    if (panelPrice) panelPrice.classList.toggle('active', tabKey === 'price');
    if (panelPercent) panelPercent.classList.toggle('active', tabKey === 'percent');

    // Update location hash without jumping
    if (history.replaceState) {
      history.replaceState(null, '', '#' + tabKey);
    }
  }

  function handleHashNavigation() {
    var hash = window.location.hash.replace('#', '').toLowerCase();
    if (hash === 'percent' || hash === 'price') {
      switchTab(hash);
    } else {
      switchTab(state.tab || 'price');
    }
  }

  /* --- Theme Management --- */
  var THEMES = ['dark', 'light', 'indigo', 'auto'];

  function setupThemeToggle() {
    var themeBtn = document.getElementById('themeToggleBtn');
    if (!themeBtn) return;

    themeBtn.addEventListener('click', function() {
      var currentIdx = THEMES.indexOf(state.theme);
      var nextTheme = THEMES[(currentIdx + 1) % THEMES.length];
      state.theme = nextTheme;
      saveState();
      applyTheme(nextTheme);
    });
  }

  function applyTheme(theme) {
    var root = document.documentElement;
    var themeBtn = document.getElementById('themeToggleBtn');

    if (theme === 'auto') {
      var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
      if (themeBtn) themeBtn.textContent = '🌓 Авто';
    } else {
      root.setAttribute('data-theme', theme);
      if (themeBtn) {
        if (theme === 'dark') themeBtn.textContent = '🌙 Тёмная';
        else if (theme === 'light') themeBtn.textContent = '☀️ Светлая';
        else if (theme === 'indigo') themeBtn.textContent = '🔮 Индиго';
      }
    }
  }

  /* --- Service Worker & Update Lifecycle --- */
  function setupServiceWorker() {
    if (!('serviceWorker' in navigator) || location.protocol !== 'https:' && location.hostname !== 'localhost') {
      return;
    }

    navigator.serviceWorker.register('./sw.js').then(function(reg) {
      swRegistration = reg;

      // Check for updates
      reg.addEventListener('updatefound', function() {
        var newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', function() {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateToast(newWorker);
          }
        });
      });
    }).catch(function(err) {
      console.warn('[SW] Registration failed:', err);
    });

    var refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', function() {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  }

  function showUpdateToast(worker) {
    var toast = document.getElementById('globalToast');
    if (!toast) return;

    var textEl = toast.querySelector('.toast-text');
    var actionEl = toast.querySelector('.toast-action-btn');

    if (textEl) textEl.textContent = 'Доступно обновление приложения';
    if (actionEl) {
      actionEl.style.display = 'inline-block';
      actionEl.textContent = 'Обновить';
      actionEl.onclick = function() {
        worker.postMessage({ type: 'SKIP_WAITING' });
      };
    }
    toast.classList.add('show');
  }

})();
