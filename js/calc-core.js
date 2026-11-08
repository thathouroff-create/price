/**
 * Pure Mathematical & Business Logic Engine for Price & Percent Calculator
 * Zero DOM, Zero Storage dependencies. Fully testable in any environment.
 */
(function(root) {
  'use strict';

  var CalcCore = {};

  /**
   * Safely parses user string input into a valid float.
   * Handles commas, spaces, NBSP, and rejects invalid formats.
   */
  CalcCore.parseNum = function(val) {
    if (val === null || val === undefined) return NaN;
    if (typeof val === 'number') return isFinite(val) ? val : NaN;
    var s = String(val).trim().replace(/\u00A0/g, '').replace(/\s+/g, '').replace(',', '.');
    if (!s || !/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(s)) return NaN;
    var n = parseFloat(s);
    return isFinite(n) ? n : NaN;
  };

  /**
   * Accurate half-up rounding avoiding IEEE-754 precision artifacts (e.g. 1.005 -> 1.01).
   */
  CalcCore.roundHalfUp = function(val, decimals) {
    var d = typeof decimals === 'number' ? decimals : 2;
    if (!isFinite(val)) return NaN;
    var sign = val < 0 ? -1 : 1;
    var absVal = Math.abs(val);
    var shifted = Number(absVal + 'e' + d);
    var rounded = Math.round(shifted);
    var result = Number(rounded + 'e-' + d);
    return sign * result;
  };

  /**
   * Formats a number with Russian locale rules (comma separator, non-breaking space grouping).
   */
  CalcCore.formatNum = function(val, decimals) {
    if (!isFinite(val)) return '—';
    var d = typeof decimals === 'number' ? decimals : 2;
    var rounded = CalcCore.roundHalfUp(val, d);
    return new Intl.NumberFormat('ru-RU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: d
    }).format(rounded);
  };

  /**
   * Unit definition table & normalization factors
   */
  CalcCore.UNITS = {
    'g':    { type: 'weight', base: 'kg', mult: 0.001, label: 'г', baseLabel: 'кг', display: '₽/кг' },
    'kg':   { type: 'weight', base: 'kg', mult: 1.0,   label: 'кг', baseLabel: 'кг', display: '₽/кг' },
    'ml':   { type: 'volume', base: 'l',  mult: 0.001, label: 'мл', baseLabel: 'л', display: '₽/л' },
    'l':    { type: 'volume', base: 'l',  mult: 1.0,   label: 'л',  baseLabel: 'л', display: '₽/л' },
    'unit': { type: 'count',  base: 'unit', mult: 1.0, label: 'шт', baseLabel: 'шт', display: '₽/шт' },
    'pack': { type: 'count',  base: 'unit', mult: 1.0, label: 'уп', baseLabel: 'шт', display: '₽/шт' }
  };

  /**
   * Computes effective price after applying any discounts or promo campaigns.
   */
  CalcCore.calcEffectivePrice = function(price, promoType, promoVal) {
    var p = CalcCore.parseNum(price);
    if (isNaN(p) || p <= 0) return 0;
    if (!promoType || promoType === 'none') return p;

    if (promoType === 'percent') {
      var disc = CalcCore.parseNum(promoVal);
      if (isNaN(disc) || disc <= 0) return p;
      if (disc >= 100) return 0;
      return p * (1 - disc / 100);
    }
    if (promoType === 'card') {
      var cardPrice = CalcCore.parseNum(promoVal);
      if (isNaN(cardPrice) || cardPrice <= 0) return p;
      return cardPrice;
    }
    if (promoType === 'two_for_one') {
      // 2 for 1 means 50% discount per unit
      return p * 0.5;
    }
    if (promoType === 'three_for_two') {
      // 3 for the price of 2 means (2/3) price per unit
      return p * (2.0 / 3.0);
    }
    return p;
  };

  /**
   * Computes unit price for a single item normalized to standard base unit (kg, l, or unit).
   */
  CalcCore.calcItemUnitPrice = function(item) {
    var rawPrice = CalcCore.parseNum(item.price);
    var rawQty = CalcCore.parseNum(item.qty);
    var packCount = CalcCore.parseNum(item.packCount) || 1;
    if (packCount <= 0) packCount = 1;

    if (isNaN(rawPrice) || isNaN(rawQty) || rawPrice <= 0 || rawQty <= 0) {
      return { valid: false, unitPrice: 0, baseUnit: '', display: '—' };
    }

    var unitKey = item.unit || 'unit';
    var unitMeta = CalcCore.UNITS[unitKey] || CalcCore.UNITS['unit'];
    var effectivePrice = CalcCore.calcEffectivePrice(rawPrice, item.promoType, item.promoVal);
    var totalBaseQty = (rawQty * packCount) * unitMeta.mult;

    if (totalBaseQty <= 0) {
      return { valid: false, unitPrice: 0, baseUnit: unitMeta.base, display: '—' };
    }

    var unitPrice = effectivePrice / totalBaseQty;
    return {
      valid: true,
      unitPrice: unitPrice,
      effectivePrice: effectivePrice,
      totalBaseQty: totalBaseQty,
      unitType: unitMeta.type,
      baseUnit: unitMeta.base,
      displayUnit: unitMeta.display,
      label: unitMeta.label
    };
  };

  /**
   * Compares an array of products, validating unit types and calculating relative difference.
   */
  CalcCore.compareProducts = function(items) {
    if (!items || !items.length) {
      return { items: [], hasIncompatibleUnits: false, bestDealIdxs: [] };
    }

    var calculated = items.map(function(item) {
      return CalcCore.calcItemUnitPrice(item);
    });

    var validItems = [];
    calculated.forEach(function(c, idx) {
      if (c.valid) validItems.push({ idx: idx, res: c });
    });

    if (!validItems.length) {
      return { items: calculated, hasIncompatibleUnits: false, bestDealIdxs: [] };
    }

    // Check unit compatibility (e.g. comparing weight to volume)
    var firstType = validItems[0].res.unitType;
    var hasIncompatible = validItems.some(function(v) {
      return v.res.unitType !== firstType;
    });

    if (hasIncompatible) {
      return {
        items: calculated,
        hasIncompatibleUnits: true,
        incompatibleMsg: 'Внимание: сравниваются разные величины (вес, объём или штуки)!',
        bestDealIdxs: []
      };
    }

    // Find best deals (minimum unit price)
    var minPrice = Infinity;
    validItems.forEach(function(v) {
      if (v.res.unitPrice < minPrice) {
        minPrice = v.res.unitPrice;
      }
    });

    var bestDealIdxs = [];
    var tolerance = 1e-9;
    validItems.forEach(function(v) {
      if (Math.abs(v.res.unitPrice - minPrice) <= (minPrice * tolerance)) {
        bestDealIdxs.push(v.idx);
      }
    });

    // Compute relative worse percentage & savings
    calculated.forEach(function(c, idx) {
      if (!c.valid || minPrice === Infinity) return;
      if (bestDealIdxs.indexOf(idx) !== -1) {
        c.isBest = true;
        c.diffPercent = 0;
      } else {
        c.isBest = false;
        c.diffPercent = CalcCore.roundHalfUp(((c.unitPrice - minPrice) / minPrice) * 100, 1);
        c.savingPerBase = CalcCore.roundHalfUp(c.unitPrice - minPrice, 2);
      }
    });

    var isExactTie = bestDealIdxs.length > 1 && bestDealIdxs.length === validItems.length;

    return {
      items: calculated,
      hasIncompatibleUnits: false,
      bestDealIdxs: bestDealIdxs,
      isExactTie: isExactTie,
      minUnitPrice: minPrice,
      validCount: validItems.length
    };
  };

  /**
   * Percent Operations (12 Operations with Step-by-Step Explanations)
   */
  CalcCore.PERCENT_OPERATIONS = {
    '1': {
      title: 'Найти процент от числа',
      label1: 'Процент',
      addon1: '%',
      placeholder1: '0',
      label2: 'Число',
      addon2: '',
      placeholder2: '0',
      p1: 'Процент (%)',
      p2: 'Число',
      sep: '% от',
      end: '',
      calc: function(v1, v2) {
        var r = (v1 / 100) * v2;
        return {
          res: r,
          display: CalcCore.formatNum(r, 2),
          formula: '(' + v1 + ' / 100) × ' + v2 + ' = ' + CalcCore.formatNum(r, 2),
          step: 'Делим процент ' + v1 + ' на 100 и умножаем на число ' + v2
        };
      }
    },
    '2': {
      title: 'Сколько процентов составляет число от числа',
      label1: 'Число 1',
      addon1: '',
      placeholder1: '0',
      label2: 'Число 2 (база)',
      addon2: '',
      placeholder2: '0',
      p1: 'Число 1',
      p2: 'Число 2',
      sep: 'от',
      end: '',
      calc: function(v1, v2) {
        if (v2 === 0) return { error: 'Деление на ноль невозможно (второе число = 0)' };
        var r = (v1 / v2) * 100;
        return {
          res: r,
          display: CalcCore.formatNum(r, 2) + '%',
          formula: '(' + v1 + ' / ' + v2 + ') × 100% = ' + CalcCore.formatNum(r, 2) + '%',
          step: 'Делим ' + v1 + ' на ' + v2 + ' и переводим в проценты'
        };
      }
    },
    '3': {
      title: 'Прибавить процент к числу',
      label1: 'Число',
      addon1: '',
      placeholder1: '0',
      label2: 'Процент',
      addon2: '%',
      placeholder2: '0',
      p1: 'Число',
      p2: 'Процент (%)',
      sep: '+',
      end: '%',
      calc: function(v1, v2) {
        var delta = (v1 * v2) / 100;
        var r = v1 + delta;
        return {
          res: r,
          display: CalcCore.formatNum(r, 2),
          formula: v1 + ' + (' + v1 + ' × ' + v2 + '%) = ' + CalcCore.formatNum(r, 2),
          step: 'Прибавка составляет ' + CalcCore.formatNum(delta, 2) + ' (итого ' + CalcCore.formatNum(r, 2) + ')'
        };
      }
    },
    '4': {
      title: 'Вычесть процент из числа',
      label1: 'Число',
      addon1: '',
      placeholder1: '0',
      label2: 'Процент',
      addon2: '%',
      placeholder2: '0',
      p1: 'Число',
      p2: 'Процент (%)',
      sep: '−',
      end: '%',
      calc: function(v1, v2) {
        var delta = (v1 * v2) / 100;
        var r = v1 - delta;
        return {
          res: r,
          display: CalcCore.formatNum(r, 2),
          formula: v1 + ' − (' + v1 + ' × ' + v2 + '%) = ' + CalcCore.formatNum(r, 2),
          step: 'Скидка составляет ' + CalcCore.formatNum(delta, 2) + ' (остаётся ' + CalcCore.formatNum(r, 2) + ')'
        };
      }
    },
    '5': {
      title: 'На сколько % одно число больше другого',
      label1: 'Число 1',
      addon1: '',
      placeholder1: '0',
      label2: 'Число 2 (база)',
      addon2: '',
      placeholder2: '0',
      p1: 'Число 1',
      p2: 'Число 2',
      sep: 'больше чем',
      end: '',
      calc: function(v1, v2) {
        if (v2 === 0) return { error: 'Деление на ноль невозможно (второе число = 0)' };
        var r = ((v1 - v2) / v2) * 100;
        return {
          res: r,
          display: (r > 0 ? '+' : '') + CalcCore.formatNum(r, 2) + '%',
          formula: '((' + v1 + ' − ' + v2 + ') / ' + v2 + ') × 100% = ' + CalcCore.formatNum(r, 2) + '%',
          step: 'Разница (' + (v1 - v2) + ') делится на базу ' + v2
        };
      }
    },
    '6': {
      title: 'На сколько % одно число меньше другого',
      label1: 'Число 1',
      addon1: '',
      placeholder1: '0',
      label2: 'Число 2 (база)',
      addon2: '',
      placeholder2: '0',
      p1: 'Число 1',
      p2: 'Число 2',
      sep: 'меньше чем',
      end: '',
      calc: function(v1, v2) {
        if (v2 === 0) return { error: 'Деление на ноль невозможно (второе число = 0)' };
        var r = ((v2 - v1) / v2) * 100;
        return {
          res: r,
          display: CalcCore.formatNum(r, 2) + '%',
          formula: '((' + v2 + ' − ' + v1 + ') / ' + v2 + ') × 100% = ' + CalcCore.formatNum(r, 2) + '%',
          step: 'Уменьшение от ' + v2 + ' до ' + v1
        };
      }
    },
    '7': {
      title: 'Найти 100 процентов (по известной доле)',
      label1: 'Значение части',
      addon1: '',
      placeholder1: '0',
      label2: 'Процент доли',
      addon2: '%',
      placeholder2: '0',
      p1: 'Число',
      p2: 'Процент (%)',
      sep: 'это',
      end: '%',
      calc: function(v1, v2) {
        if (v2 === 0) return { error: 'Процент не может быть равен 0' };
        var r = (v1 / v2) * 100;
        return {
          res: r,
          display: CalcCore.formatNum(r, 2),
          formula: '(' + v1 + ' / ' + v2 + ') × 100 = ' + CalcCore.formatNum(r, 2),
          step: 'Если ' + v1 + ' составляет ' + v2 + '%, то 100% равно ' + CalcCore.formatNum(r, 2)
        };
      }
    },
    '8': {
      title: 'Процентное изменение числа (было → стало)',
      label1: 'Было',
      addon1: '',
      placeholder1: '0',
      label2: 'Стало',
      addon2: '',
      placeholder2: '0',
      p1: 'Было',
      p2: 'Стало',
      sep: '→',
      end: '',
      calc: function(v1, v2) {
        if (v1 === 0) return { error: 'Начальное значение не может быть равно 0' };
        var r = ((v2 - v1) / Math.abs(v1)) * 100;
        var prefix = r > 0 ? '+' : '';
        return {
          res: r,
          display: prefix + CalcCore.formatNum(r, 2) + '%',
          formula: '((' + v2 + ' − ' + v1 + ') / |' + v1 + '|) × 100% = ' + prefix + CalcCore.formatNum(r, 2) + '%',
          step: r >= 0 ? 'Рост на ' + CalcCore.formatNum(r, 2) + '%' : 'Падение на ' + CalcCore.formatNum(Math.abs(r), 2) + '%'
        };
      }
    },
    '9': {
      title: 'НДС 20% (выделить или начислить)',
      label1: 'Сумма',
      addon1: '₽',
      placeholder1: '0',
      label2: 'Режим расчёта',
      addon2: '',
      placeholder2: '',
      p1: 'Сумма (₽)',
      p2: 'Режим',
      sep: 'расчёт',
      end: '',
      isCustomMode: true,
      calc: function(sum, mode) {
        if (mode === 2) {
          var ndsAdd = sum * 0.20;
          var totalAdd = sum + ndsAdd;
          return {
            res: totalAdd,
            display: CalcCore.formatNum(totalAdd, 2) + ' ₽',
            formula: 'НДС 20%: ' + CalcCore.formatNum(ndsAdd, 2) + ' ₽ | Итого с НДС: ' + CalcCore.formatNum(totalAdd, 2) + ' ₽',
            step: 'Начислено 20% НДС (' + CalcCore.formatNum(ndsAdd, 2) + ' ₽) к базе ' + CalcCore.formatNum(sum, 2) + ' ₽'
          };
        } else {
          var base = sum / 1.20;
          var ndsExt = sum - base;
          return {
            res: ndsExt,
            display: CalcCore.formatNum(ndsExt, 2) + ' ₽',
            formula: 'НДС 20%: ' + CalcCore.formatNum(ndsExt, 2) + ' ₽ | Без НДС: ' + CalcCore.formatNum(base, 2) + ' ₽',
            step: 'В сумме ' + CalcCore.formatNum(sum, 2) + ' ₽ заложено ' + CalcCore.formatNum(ndsExt, 2) + ' ₽ НДС'
          };
        }
      }
    },
    '10': {
      title: 'Наценка и маржа',
      label1: 'Себестоимость',
      addon1: '₽',
      placeholder1: '0',
      label2: 'Наценка',
      addon2: '%',
      placeholder2: '0',
      p1: 'Себестоимость (₽)',
      p2: 'Наценка (%)',
      sep: 'с наценкой',
      end: '%',
      calc: function(cost, markup) {
        if (cost < 0) return { error: 'Себестоимость не может быть отрицательной' };
        var price = cost * (1 + markup / 100);
        var profit = price - cost;
        var margin = price > 0 ? (profit / price) * 100 : 0;
        return {
          res: price,
          display: CalcCore.formatNum(price, 2) + ' ₽',
          formula: 'Цена продажи: ' + CalcCore.formatNum(price, 2) + ' ₽ | Маржа: ' + CalcCore.formatNum(margin, 1) + '%',
          step: 'Прибыль с единицы: ' + CalcCore.formatNum(profit, 2) + ' ₽ (маржинальность ' + CalcCore.formatNum(margin, 1) + '%)'
        };
      }
    },
    '11': {
      title: 'Сложный процент (депозит / вклад)',
      label1: 'Сумма вклада',
      addon1: '₽',
      placeholder1: '0',
      label2: 'Ставка годовых',
      addon2: '%',
      placeholder2: '0',
      p1: 'Сумма (₽)',
      p2: 'Ставка (% год)',
      sep: 'под',
      end: '%',
      calc: function(principal, rate, months) {
        var m = months || 12;
        var monthlyRate = (rate / 100) / 12;
        var total = principal * Math.pow(1 + monthlyRate, m);
        var interest = total - principal;
        return {
          res: total,
          display: CalcCore.formatNum(total, 2) + ' ₽',
          formula: 'Доход: +' + CalcCore.formatNum(interest, 2) + ' ₽ | Итог через ' + m + ' мес: ' + CalcCore.formatNum(total, 2) + ' ₽',
          step: 'Капитализация ежемесячно под ' + rate + '% годовых за ' + m + ' мес.'
        };
      }
    },
    '12': {
      title: 'Расчёт скидки (старая и новая цена)',
      label1: 'Старая цена',
      addon1: '₽',
      placeholder1: '0',
      label2: 'Новая цена',
      addon2: '₽',
      placeholder2: '0',
      p1: 'Старая цена',
      p2: 'Новая цена',
      sep: '→',
      end: '',
      calc: function(oldPrice, newPrice) {
        if (oldPrice <= 0) return { error: 'Старая цена должна быть больше нуля' };
        var diff = oldPrice - newPrice;
        var pct = (diff / oldPrice) * 100;
        return {
          res: diff,
          display: 'Скидка ' + CalcCore.formatNum(pct, 1) + '%',
          formula: 'Экономия: ' + CalcCore.formatNum(diff, 2) + ' ₽ (скидка ' + CalcCore.formatNum(pct, 1) + '%)',
          step: 'Вы экономите ' + CalcCore.formatNum(diff, 2) + ' ₽ относительно исходной цены'
        };
      }
    }
  };

  /**
   * Helper to execute a percent operation by ID with arguments
   */
  CalcCore.calcPercent = function(opId, v1Str, v2Str, roundDecimals, opt3) {
    var op = CalcCore.PERCENT_OPERATIONS[String(opId)];
    if (!op) return { error: 'Неизвестная операция' };

    var v1 = CalcCore.parseNum(v1Str);
    var v2 = CalcCore.parseNum(v2Str);
    if (isNaN(v1) || isNaN(v2)) {
      return { error: 'Пожалуйста, введите корректные числовые значения' };
    }

    var result = op.calc(v1, v2, opt3);
    if (result.error) return result;

    var decimals = typeof roundDecimals === 'number' ? roundDecimals : 2;
    if (typeof result.res === 'number') {
      result.rounded = CalcCore.roundHalfUp(result.res, decimals);
    }
    return result;
  };

  root.CalcCore = CalcCore;

})(typeof window !== 'undefined' ? window : this);
