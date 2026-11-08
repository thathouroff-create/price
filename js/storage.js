/**
 * Storage & State Manager for Price & Percent Calculator
 * Enforces namespacing, schema validation, legacy v1 migration, and quota protection.
 */
(function(root) {
  'use strict';

  var STORAGE_KEY = 'price.v2.state';
  var HISTORY_KEY = 'price.v2.history';
  var MAX_ITEMS = 30;
  var MAX_NAME_LEN = 60;
  var MAX_HISTORY = 10;

  var DEFAULT_STATE = {
    version: 2,
    tab: 'price',
    theme: 'dark',
    products: [
      { id: 1, name: '', price: '', qty: '', unit: 'kg', packCount: 1, promoType: 'none', promoVal: '' },
      { id: 2, name: '', price: '', qty: '', unit: 'kg', packCount: 1, promoType: 'none', promoVal: '' }
    ],
    percent: {
      op: '1',
      v1: '',
      v2: '',
      round: 2,
      ndsMode: 1
    }
  };

  var StorageManager = {};

  /**
   * Safe JSON parse with fallback
   */
  function safeJsonParse(str, fallback) {
    if (!str) return fallback;
    try {
      var parsed = JSON.parse(str);
      return parsed && typeof parsed === 'object' ? parsed : fallback;
    } catch (e) {
      console.warn('[Storage] JSON parse error, using fallback', e);
      return fallback;
    }
  }

  /**
   * Migrates legacy v1 localStorage keys if present
   */
  function migrateFromV1() {
    try {
      var legacyTab = localStorage.getItem('activeTab');
      var legacyMode = localStorage.getItem('priceMode') || 'unit';
      var legacyProductsStr = localStorage.getItem('priceProducts');

      var legacyUnitMap = {
        'kg': 'kg',
        'liter': 'l',
        'unit': 'unit'
      };
      var targetUnit = legacyUnitMap[legacyMode] || 'unit';

      var products = [];
      if (legacyProductsStr) {
        var rawList = safeJsonParse(legacyProductsStr, []);
        if (Array.isArray(rawList)) {
          products = rawList.map(function(item, idx) {
            return {
              id: Number.isSafeInteger(item.id) ? item.id : Date.now() + idx,
              name: typeof item.name === 'string' ? item.name.slice(0, MAX_NAME_LEN) : '',
              price: item.p !== undefined ? String(item.p).slice(0, 20) : '',
              qty: item.q !== undefined ? String(item.q).slice(0, 20) : '',
              unit: targetUnit,
              packCount: 1,
              promoType: 'none',
              promoVal: ''
            };
          });
        }
      }

      if (products.length < 2) {
        products = [
          { id: 1, name: '', price: '', qty: '', unit: targetUnit, packCount: 1, promoType: 'none', promoVal: '' },
          { id: 2, name: '', price: '', qty: '', unit: targetUnit, packCount: 1, promoType: 'none', promoVal: '' }
        ];
      }

      var migrated = {
        version: 2,
        tab: legacyTab === 'percent' ? 'percent' : 'price',
        theme: 'dark',
        products: products.slice(0, MAX_ITEMS),
        percent: DEFAULT_STATE.percent
      };

      StorageManager.saveState(migrated);
      return migrated;
    } catch (e) {
      console.warn('[Storage] Migration failed', e);
      return DEFAULT_STATE;
    }
  }

  /**
   * Validates & sanitizes incoming state object
   */
  function validateState(state) {
    if (!state || typeof state !== 'object') return DEFAULT_STATE;

    var validTab = state.tab === 'percent' ? 'percent' : 'price';
    var validTheme = ['dark', 'light', 'indigo', 'auto'].indexOf(state.theme) !== -1 ? state.theme : 'dark';

    var rawProds = Array.isArray(state.products) ? state.products : DEFAULT_STATE.products;
    var validProds = rawProds.slice(0, MAX_ITEMS).map(function(p, i) {
      return {
        id: Number.isSafeInteger(p.id) ? p.id : Date.now() + i,
        name: typeof p.name === 'string' ? p.name.trim().slice(0, MAX_NAME_LEN) : '',
        price: typeof p.price === 'string' || typeof p.price === 'number' ? String(p.price).slice(0, 20) : '',
        qty: typeof p.qty === 'string' || typeof p.qty === 'number' ? String(p.qty).slice(0, 20) : '',
        unit: ['g', 'kg', 'ml', 'l', 'unit', 'pack'].indexOf(p.unit) !== -1 ? p.unit : 'kg',
        packCount: Math.max(1, Math.min(100, parseInt(p.packCount, 10) || 1)),
        promoType: ['none', 'percent', 'card', 'two_for_one', 'three_for_two'].indexOf(p.promoType) !== -1 ? p.promoType : 'none',
        promoVal: typeof p.promoVal === 'string' || typeof p.promoVal === 'number' ? String(p.promoVal).slice(0, 20) : ''
      };
    });

    if (validProds.length < 2) {
      validProds = DEFAULT_STATE.products;
    }

    var rawPct = state.percent || {};
    var validPct = {
      op: String(rawPct.op || '1'),
      v1: typeof rawPct.v1 === 'string' ? rawPct.v1.slice(0, 20) : '',
      v2: typeof rawPct.v2 === 'string' ? rawPct.v2.slice(0, 20) : '',
      round: Math.max(0, Math.min(4, parseInt(rawPct.round, 10) || 2)),
      ndsMode: rawPct.ndsMode === 2 ? 2 : 1
    };

    return {
      version: 2,
      tab: validTab,
      theme: validTheme,
      products: validProds,
      percent: validPct
    };
  }

  /**
   * Loads state from storage
   */
  StorageManager.loadState = function() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return migrateFromV1();
      }
      var parsed = safeJsonParse(raw, null);
      if (!parsed) return DEFAULT_STATE;
      return validateState(parsed);
    } catch (e) {
      console.error('[Storage] Error loading state', e);
      return DEFAULT_STATE;
    }
  };

  /**
   * Saves state to storage with quota error protection
   */
  StorageManager.saveState = function(state) {
    try {
      var validated = validateState(state);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(validated));
      return true;
    } catch (e) {
      if (e.name === 'QuotaExceededError') {
        console.warn('[Storage] Quota exceeded, clearing history');
        try {
          localStorage.removeItem(HISTORY_KEY);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(validateState(state)));
          return true;
        } catch (e2) {
          console.error('[Storage] Failed to save even after clearing history', e2);
        }
      }
      return false;
    }
  };

  /**
   * Adds an item to calculation history
   */
  StorageManager.addHistory = function(entry) {
    try {
      var raw = localStorage.getItem(HISTORY_KEY);
      var history = safeJsonParse(raw, []);
      if (!Array.isArray(history)) history = [];

      entry.timestamp = Date.now();
      history.unshift(entry);
      if (history.length > MAX_HISTORY) {
        history = history.slice(0, MAX_HISTORY);
      }
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch (e) {
      console.warn('[Storage] Could not add history', e);
    }
  };

  /**
   * Retrieves calculation history
   */
  StorageManager.getHistory = function() {
    try {
      var raw = localStorage.getItem(HISTORY_KEY);
      var history = safeJsonParse(raw, []);
      return Array.isArray(history) ? history : [];
    } catch (e) {
      return [];
    }
  };

  /**
   * Clears calculation history
   */
  StorageManager.clearHistory = function() {
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch (e) {}
  };

  root.StorageManager = StorageManager;

})(typeof window !== 'undefined' ? window : this);
