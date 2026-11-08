/**
 * Price Calculator UI Controller
 * Zero-innerHTML interpolation with user data. Safe DOM building, event delegation.
 */
(function(root) {
  'use strict';

  var UiPrice = {};

  var container = null;
  var stateRef = null;
  var onStateChange = null;

  var UNITS = [
    { key: 'kg', label: 'кг' },
    { key: 'g', label: 'г' },
    { key: 'l', label: 'л' },
    { key: 'ml', label: 'мл' },
    { key: 'unit', label: 'шт' }
  ];

  var PROMO_OPTIONS = [
    { key: 'none', label: 'Без скидки' },
    { key: 'percent', label: 'Скидка %' },
    { key: 'card', label: 'Цена по карте' },
    { key: 'two_for_one', label: '2 по цене 1' },
    { key: 'three_for_two', label: '3 по цене 2' }
  ];

  UiPrice.init = function(mountEl, state, onChangeCallback) {
    container = mountEl;
    stateRef = state;
    onStateChange = onChangeCallback;

    // Delegate events
    container.addEventListener('input', handleInput);
    container.addEventListener('change', handleChange);
    container.addEventListener('click', handleClick);

    UiPrice.render();
  };

  UiPrice.updateState = function(newState) {
    stateRef = newState;
    UiPrice.render();
  };

  function triggerHaptic(pattern) {
    if (navigator.vibrate) {
      try { navigator.vibrate(pattern); } catch (e) {}
    }
  }

  function handleInput(e) {
    var target = e.target;
    var card = target.closest('.product-card');
    if (!card) return;
    var id = parseInt(card.dataset.id, 10);
    var item = stateRef.products.find(function(p) { return p.id === id; });
    if (!item) return;

    if (target.classList.contains('input-name')) {
      item.name = target.value.slice(0, 60);
    } else if (target.classList.contains('input-price')) {
      item.price = target.value.slice(0, 20);
    } else if (target.classList.contains('input-qty')) {
      item.qty = target.value.slice(0, 20);
    } else if (target.classList.contains('input-pack-count')) {
      item.packCount = Math.max(1, parseInt(target.value, 10) || 1);
    } else if (target.classList.contains('input-promo-val')) {
      item.promoVal = target.value.slice(0, 20);
    }

    notifyChange();
    UiPrice.recalculate();
  }

  function handleChange(e) {
    var target = e.target;
    var card = target.closest('.product-card');
    if (!card) return;
    var id = parseInt(card.dataset.id, 10);
    var item = stateRef.products.find(function(p) { return p.id === id; });
    if (!item) return;

    if (target.classList.contains('select-unit')) {
      item.unit = target.value;
      triggerHaptic(10);
    } else if (target.classList.contains('select-promo')) {
      item.promoType = target.value;
      triggerHaptic(10);
      togglePromoInput(card, item.promoType);
    }

    notifyChange();
    UiPrice.recalculate();
  }

  function handleClick(e) {
    var target = e.target;

    // Delete product
    var delBtn = target.closest('.delete-card-btn');
    if (delBtn) {
      var card = delBtn.closest('.product-card');
      if (card && stateRef.products.length > 2) {
        var id = parseInt(card.dataset.id, 10);
        stateRef.products = stateRef.products.filter(function(p) { return p.id !== id; });
        triggerHaptic([15, 30, 15]);
        notifyChange();
        UiPrice.render();
      }
      return;
    }

    // Toggle multipack panel
    var packToggle = target.closest('.toggle-pack');
    if (packToggle) {
      var card2 = packToggle.closest('.product-card');
      var packPanel = card2.querySelector('.multipack-panel');
      if (packPanel) {
        var isOpen = packPanel.classList.toggle('open');
        packToggle.classList.toggle('active', isOpen);
        triggerHaptic(10);
      }
      return;
    }

    // Toggle promo panel
    var promoToggle = target.closest('.toggle-promo');
    if (promoToggle) {
      var card3 = promoToggle.closest('.product-card');
      var promoPanel = card3.querySelector('.promo-panel');
      if (promoPanel) {
        var isOpen2 = promoPanel.classList.toggle('open');
        promoToggle.classList.toggle('active', isOpen2);
        triggerHaptic(10);
      }
      return;
    }
  }

  function togglePromoInput(card, promoType) {
    var promoValInput = card.querySelector('.input-promo-val');
    var promoValLabel = card.querySelector('.label-promo-val');
    if (!promoValInput || !promoValLabel) return;

    if (promoType === 'percent') {
      promoValLabel.textContent = 'Размер скидки (%)';
      promoValInput.style.display = 'block';
    } else if (promoType === 'card') {
      promoValLabel.textContent = 'Цена по карте (₽)';
      promoValInput.style.display = 'block';
    } else {
      promoValInput.style.display = 'none';
      promoValLabel.textContent = '';
    }
  }

  function notifyChange() {
    if (typeof onStateChange === 'function') {
      onStateChange(stateRef);
    }
  }

  UiPrice.addProduct = function() {
    if (stateRef.products.length >= 30) return;
    var defaultUnit = stateRef.products.length > 0 ? stateRef.products[0].unit : 'kg';
    var newProd = {
      id: Date.now(),
      name: '',
      price: '',
      qty: '',
      unit: defaultUnit,
      packCount: 1,
      promoType: 'none',
      promoVal: ''
    };
    stateRef.products.push(newProd);
    triggerHaptic(20);
    notifyChange();
    UiPrice.render();
  };

  UiPrice.clearAll = function() {
    triggerHaptic([20, 50, 20]);
    var defaultUnit = stateRef.products.length > 0 ? stateRef.products[0].unit : 'kg';
    stateRef.products = [
      { id: Date.now(), name: '', price: '', qty: '', unit: defaultUnit, packCount: 1, promoType: 'none', promoVal: '' },
      { id: Date.now() + 1, name: '', price: '', qty: '', unit: defaultUnit, packCount: 1, promoType: 'none', promoVal: '' }
    ];
    notifyChange();
    UiPrice.render();
  };

  UiPrice.render = function() {
    if (!container) return;
    container.textContent = '';

    // Verdict Banner
    var verdictBanner = document.createElement('div');
    verdictBanner.className = 'verdict-banner';
    verdictBanner.id = 'priceVerdictBanner';
    var verdictTitle = document.createElement('div');
    verdictTitle.className = 'verdict-title';
    verdictBanner.appendChild(verdictTitle);
    var verdictDesc = document.createElement('div');
    verdictDesc.className = 'verdict-desc';
    verdictBanner.appendChild(verdictDesc);
    container.appendChild(verdictBanner);

    // Products List
    var list = document.createElement('div');
    list.className = 'products-list';
    list.id = 'productsListContainer';

    stateRef.products.forEach(function(p, idx) {
      var card = createProductCard(p, idx, stateRef.products.length);
      list.appendChild(card);
    });

    container.appendChild(list);

    // Buttons
    var actionsRow = document.createElement('div');
    actionsRow.className = 'action-btn-row';

    var addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'btn-secondary';
    addBtn.textContent = '+ Добавить товар';
    addBtn.addEventListener('click', UiPrice.addProduct);
    actionsRow.appendChild(addBtn);

    var clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'btn-clear';
    clearBtn.textContent = 'Очистить список';
    clearBtn.addEventListener('click', UiPrice.clearAll);
    actionsRow.appendChild(clearBtn);

    container.appendChild(actionsRow);

    UiPrice.recalculate();
  };

  function createProductCard(p, idx, totalCount) {
    var card = document.createElement('div');
    card.className = 'bento-card product-card';
    card.dataset.id = String(p.id);

    // Card Top: Name & Delete
    var topRow = document.createElement('div');
    topRow.className = 'card-top';

    var nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'item-name-input input-name';
    nameInput.value = p.name || '';
    nameInput.placeholder = 'Товар ' + (idx + 1);
    nameInput.setAttribute('aria-label', 'Название товара ' + (idx + 1));
    topRow.appendChild(nameInput);

    if (totalCount > 2) {
      var delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'delete-card-btn';
      delBtn.textContent = '×';
      delBtn.setAttribute('aria-label', 'Удалить товар ' + (idx + 1));
      topRow.appendChild(delBtn);
    }
    card.appendChild(topRow);

    // Main Input Grid: Price & Quantity with Unit Select
    var grid = document.createElement('div');
    grid.className = 'input-grid';

    // Price
    var cellPrice = document.createElement('div');
    cellPrice.className = 'input-cell';
    var labelPrice = document.createElement('label');
    labelPrice.textContent = 'ЦЕНА';
    cellPrice.appendChild(labelPrice);

    var priceWrapper = document.createElement('div');
    priceWrapper.className = 'input-with-addon';
    var inputPrice = document.createElement('input');
    inputPrice.type = 'text';
    inputPrice.inputMode = 'decimal';
    inputPrice.className = 'app-input input-price';
    inputPrice.value = p.price || '';
    inputPrice.placeholder = '0';
    priceWrapper.appendChild(inputPrice);

    var addonPrice = document.createElement('span');
    addonPrice.className = 'input-addon';
    addonPrice.textContent = '₽';
    priceWrapper.appendChild(addonPrice);
    cellPrice.appendChild(priceWrapper);
    grid.appendChild(cellPrice);

    // Quantity & Unit
    var cellQty = document.createElement('div');
    cellQty.className = 'input-cell';
    var labelQty = document.createElement('label');
    labelQty.textContent = 'ОБЪЁМ / ВЕС / КОЛ-ВО';
    cellQty.appendChild(labelQty);

    var qtyWrapper = document.createElement('div');
    qtyWrapper.style.display = 'flex';
    qtyWrapper.style.gap = '6px';

    var inputQty = document.createElement('input');
    inputQty.type = 'text';
    inputQty.inputMode = 'decimal';
    inputQty.className = 'app-input input-qty';
    inputQty.style.flex = '1';
    inputQty.value = p.qty || '';
    inputQty.placeholder = '0';
    qtyWrapper.appendChild(inputQty);

    var selectUnit = document.createElement('select');
    selectUnit.className = 'app-select select-unit';
    selectUnit.style.width = '75px';
    UNITS.forEach(function(u) {
      var opt = document.createElement('option');
      opt.value = u.key;
      opt.textContent = u.label;
      if (u.key === p.unit) opt.selected = true;
      selectUnit.appendChild(opt);
    });
    qtyWrapper.appendChild(selectUnit);
    cellQty.appendChild(qtyWrapper);
    grid.appendChild(cellQty);

    card.appendChild(grid);

    // Option Pills (Multipack, Promo with Vector SVG Icons)
    var optionsStrip = document.createElement('div');
    optionsStrip.className = 'options-strip';

    var btnPack = document.createElement('button');
    btnPack.type = 'button';
    btnPack.className = 'pill-toggle toggle-pack' + (p.packCount > 1 ? ' active' : '');
    btnPack.innerHTML = '<svg class="pill-svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg><span>Упаковка (' + (p.packCount || 1) + ' шт)</span>';
    optionsStrip.appendChild(btnPack);

    var btnPromo = document.createElement('button');
    btnPromo.type = 'button';
    btnPromo.className = 'pill-toggle toggle-promo' + (p.promoType !== 'none' ? ' active' : '');
    btnPromo.innerHTML = '<svg class="pill-svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><circle cx="7" cy="7" r="1.5"/></svg><span>Скидка/акция</span>';
    optionsStrip.appendChild(btnPromo);

    card.appendChild(optionsStrip);

    // Multipack Sub-panel
    var packPanel = document.createElement('div');
    packPanel.className = 'sub-panel multipack-panel' + (p.packCount > 1 ? ' open' : '');
    var packLabel = document.createElement('label');
    packLabel.style.fontSize = '12px';
    packLabel.style.color = 'var(--text-secondary)';
    packLabel.style.fontWeight = '600';
    packLabel.textContent = 'Количество упаковок / штук в наборе:';
    packPanel.appendChild(packLabel);

    var packInput = document.createElement('input');
    packInput.type = 'number';
    packInput.min = '1';
    packInput.max = '100';
    packInput.className = 'app-input input-pack-count';
    packInput.style.marginTop = '6px';
    packInput.value = p.packCount || 1;
    packPanel.appendChild(packInput);
    card.appendChild(packPanel);

    // Promo Sub-panel
    var promoPanel = document.createElement('div');
    promoPanel.className = 'sub-panel promo-panel' + (p.promoType !== 'none' ? ' open' : '');

    var promoSelect = document.createElement('select');
    promoSelect.className = 'app-select select-promo';
    promoSelect.style.marginBottom = '8px';
    PROMO_OPTIONS.forEach(function(opt) {
      var optEl = document.createElement('option');
      optEl.value = opt.key;
      optEl.textContent = opt.label;
      if (opt.key === p.promoType) optEl.selected = true;
      promoSelect.appendChild(optEl);
    });
    promoPanel.appendChild(promoSelect);

    var promoValLabel = document.createElement('label');
    promoValLabel.className = 'label-promo-val';
    promoValLabel.style.fontSize = '12px';
    promoValLabel.style.color = 'var(--text-secondary)';
    promoValLabel.style.fontWeight = '600';
    promoPanel.appendChild(promoValLabel);

    var promoValInput = document.createElement('input');
    promoValInput.type = 'text';
    promoValInput.inputMode = 'decimal';
    promoValInput.className = 'app-input input-promo-val';
    promoValInput.style.marginTop = '4px';
    promoValInput.value = p.promoVal || '';
    promoValInput.placeholder = '0';
    promoPanel.appendChild(promoValInput);

    togglePromoInput(card, p.promoType);
    card.appendChild(promoPanel);

    // Card Result Row
    var resRow = document.createElement('div');
    resRow.className = 'card-result-row';

    var priceDisplay = document.createElement('div');
    priceDisplay.className = 'price-main-display';

    var priceNum = document.createElement('span');
    priceNum.className = 'price-num';
    priceNum.textContent = '—';
    priceDisplay.appendChild(priceNum);

    var unitTag = document.createElement('span');
    unitTag.className = 'price-unit-tag';
    unitTag.textContent = '';
    priceDisplay.appendChild(unitTag);

    resRow.appendChild(priceDisplay);

    var badgeContainer = document.createElement('div');
    badgeContainer.className = 'badge-container';
    resRow.appendChild(badgeContainer);

    card.appendChild(resRow);

    return card;
  }

  UiPrice.recalculate = function() {
    if (!container || !window.CalcCore) return;

    var comparison = window.CalcCore.compareProducts(stateRef.products);
    var banner = document.getElementById('priceVerdictBanner');

    // Update individual cards
    comparison.items.forEach(function(itemRes, idx) {
      var prod = stateRef.products[idx];
      var card = container.querySelector('.product-card[data-id="' + prod.id + '"]');
      if (!card) return;

      var priceNum = card.querySelector('.price-num');
      var unitTag = card.querySelector('.price-unit-tag');
      var badgeBox = card.querySelector('.badge-container');

      card.classList.remove('best-deal');
      badgeBox.textContent = '';

      if (itemRes.valid) {
        priceNum.textContent = window.CalcCore.formatNum(itemRes.unitPrice, 2);
        unitTag.textContent = itemRes.displayUnit;

        if (itemRes.isBest && comparison.validCount > 1) {
          card.classList.add('best-deal');
          var bestBadge = document.createElement('span');
          bestBadge.className = 'badge-best';
          bestBadge.textContent = '✓ Выгодно';
          badgeBox.appendChild(bestBadge);
        } else if (itemRes.diffPercent > 0 && !comparison.hasIncompatibleUnits) {
          var worseBadge = document.createElement('div');
          worseBadge.className = 'badge-worse';
          worseBadge.textContent = '+' + itemRes.diffPercent + '%';
          badgeBox.appendChild(worseBadge);

          if (itemRes.savingPerBase > 0) {
            var savingHint = document.createElement('div');
            savingHint.className = 'savings-hint';
            savingHint.textContent = 'дороже на ' + window.CalcCore.formatNum(itemRes.savingPerBase, 2) + ' ₽';
            badgeBox.appendChild(savingHint);
          }
        }
      } else {
        priceNum.textContent = '—';
        unitTag.textContent = '';
      }
    });

    // Update summary verdict banner
    if (banner) {
      var titleEl = banner.querySelector('.verdict-title');
      var descEl = banner.querySelector('.verdict-desc');

      if (comparison.hasIncompatibleUnits) {
        banner.className = 'verdict-banner visible warning';
        titleEl.textContent = '⚠️ Несовместимые единицы измерения';
        descEl.textContent = 'Некоторые товары указаны в весе (кг/г), а другие — в объёме (л/мл) или штуках. Приведите единицы к одной категории для точного расчёта.';
      } else if (comparison.validCount > 1) {
        banner.className = 'verdict-banner visible';
        if (comparison.isExactTie) {
          titleEl.textContent = '🤝 Одинаково выгодно!';
          descEl.textContent = 'Все заполненные товары имеют одинаковую удельную стоимость (' + window.CalcCore.formatNum(comparison.minUnitPrice, 2) + ' ₽). Выбирайте по вкусу!';
        } else if (comparison.bestDealIdxs.length > 0) {
          var bestIdx = comparison.bestDealIdxs[0];
          var bestProd = stateRef.products[bestIdx];
          var bestTitle = bestProd.name ? '«' + bestProd.name + '»' : 'Товар ' + (bestIdx + 1);
          titleEl.textContent = '🏆 ' + bestTitle + ' — самый выгодный выбор';

          var bestRes = comparison.items[bestIdx];
          descEl.textContent = 'Цена: ' + window.CalcCore.formatNum(bestRes.unitPrice, 2) + ' ' + bestRes.displayUnit + '. Позволяет существенно сэкономить при регулярных покупках.';
        }
      } else {
        banner.className = 'verdict-banner';
      }
    }
  };

  root.UiPrice = UiPrice;

})(typeof window !== 'undefined' ? window : this);
