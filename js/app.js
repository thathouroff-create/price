/**
 * Master Application Coordinator
 * Tab navigation, keyboard accessibility, theme management,
 * PWA Service Worker lifecycle, and APK download links.
 */
(function() {
  'use strict';

  var state = null;
  var swRegistration = null;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }

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

    // 3. Initialize Tabs & Touch Swipe
    setupTabs();
    setupSwipe();
    setupInstallPrompt();

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

  /* --- Tabs Management & Swipe Navigation --- */
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

  function setupSwipe() {
    var startX = 0;
    var startY = 0;
    var startTime = 0;
    var isSwiping = false;

    // Fullscreen swipe across entire document body
    document.addEventListener('touchstart', function(e) {
      if (e.touches.length !== 1) return;
      var target = e.target;
      // Ignore swipe when user interacts with inputs, selects, buttons or interactive controls
      if (target.closest('input, select, textarea, button, .pill-toggle, .delete-card-btn, .swap-btn, .clear-pct-btn, .pwa-dismiss-btn, .pwa-confirm-btn')) {
        isSwiping = false;
        return;
      }
      isSwiping = true;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startTime = Date.now();
    }, { passive: true });

    document.addEventListener('touchend', function(e) {
      if (!isSwiping || e.changedTouches.length !== 1) return;
      isSwiping = false;

      var endX = e.changedTouches[0].clientX;
      var endY = e.changedTouches[0].clientY;
      var deltaX = endX - startX;
      var deltaY = endY - startY;
      var elapsed = Date.now() - startTime;

      // Ultra-sensitive & fast gesture: min 24px, deltaX > deltaY * 1.05, within 600ms
      if (Math.abs(deltaX) >= 24 && Math.abs(deltaX) > Math.abs(deltaY) * 1.05 && elapsed <= 600) {
        if (deltaX < 0) {
          // Swipe Left: price -> percent
          if (state.tab === 'price') {
            switchTab('percent', 'slide-left');
          }
        } else {
          // Swipe Right: percent -> price
          if (state.tab === 'percent') {
            switchTab('price', 'slide-right');
          }
        }
      }
    }, { passive: true });

    document.addEventListener('touchcancel', function() {
      isSwiping = false;
    }, { passive: true });
  }

  /* --- PWA Install to Home Screen --- */
  var deferredInstallPrompt = null;

  function setupInstallPrompt() {
    var installBtn = document.getElementById('installAppBtn');
    var installBanner = document.getElementById('pwaInstallBanner');
    var confirmBtn = document.getElementById('pwaInstallConfirm');
    var dismissBtn = document.getElementById('pwaInstallDismiss');

    var isDismissed = false;
    try {
      isDismissed = localStorage.getItem('calc_install_dismissed') === '1';
    } catch (e) {}

    var isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (isStandalone) {
      if (installBtn) installBtn.style.display = 'none';
      if (installBanner) installBanner.style.display = 'none';
      return;
    }

    window.addEventListener('beforeinstallprompt', function(e) {
      e.preventDefault();
      deferredInstallPrompt = e;

      if (installBtn) {
        installBtn.style.display = 'inline-flex';
      }

      if (installBanner && !isDismissed) {
        installBanner.style.display = 'flex';
      }
    });

    var isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isIos && !isStandalone) {
      if (installBtn) {
        installBtn.style.display = 'inline-flex';
      }
      if (installBanner && !isDismissed) {
        installBanner.style.display = 'flex';
        var desc = installBanner.querySelector('.pwa-install-desc');
        if (desc) desc.textContent = 'Нажмите «Поделиться» ⎋ и «На экран Домой» ➕';
      }
    }

    function triggerInstall() {
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        deferredInstallPrompt.userChoice.then(function(choice) {
          if (choice.outcome === 'accepted') {
            if (installBtn) installBtn.style.display = 'none';
            if (installBanner) installBanner.style.display = 'none';
          }
          deferredInstallPrompt = null;
        });
      } else if (isIos) {
        alert('Чтобы добавить Calc+ на экран:\n1. Нажмите иконку «Поделиться» (⎋) внизу экрана Safari.\n2. Выберите пункт «На экран „Домой“» ➕.');
      } else {
        alert('Для установки используйте меню браузера (⋮) → «Установить приложение» или «Добавить на главный экран».');
      }
    }

    if (installBtn) {
      installBtn.addEventListener('click', triggerInstall);
    }
    if (confirmBtn) {
      confirmBtn.addEventListener('click', triggerInstall);
    }
    if (dismissBtn) {
      dismissBtn.addEventListener('click', function() {
        if (installBanner) installBanner.style.display = 'none';
        try {
          localStorage.setItem('calc_install_dismissed', '1');
        } catch (e) {}
      });
    }

    window.addEventListener('appinstalled', function() {
      if (installBtn) installBtn.style.display = 'none';
      if (installBanner) installBanner.style.display = 'none';
      deferredInstallPrompt = null;
    });
  }

  function switchTab(tabKey, direction) {
    if (tabKey !== 'price' && tabKey !== 'percent') tabKey = 'price';
    var prevTab = state.tab;
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
    var panels = [panelPrice, panelPercent];

    var animClass = direction || (tabKey === 'percent' ? 'slide-left' : 'slide-right');

    panels.forEach(function(p) {
      if (p) {
        p.classList.remove('slide-left', 'slide-right');
      }
    });

    if (panelPrice) panelPrice.classList.toggle('active', tabKey === 'price');
    if (panelPercent) panelPercent.classList.toggle('active', tabKey === 'percent');

    var activePanel = tabKey === 'price' ? panelPrice : panelPercent;
    if (activePanel && prevTab && prevTab !== tabKey) {
      activePanel.classList.add(animClass);
    }

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

  window.App = {
    init: initApp,
    switchTab: switchTab
  };

})();
