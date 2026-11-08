/**
 * Percent Calculator UI Controller
 * 12 Operations, instant debounced calculation, step-by-step formula explanations,
 * swap button, copy result, and calculation history.
 */
(function(root) {
  'use strict';

  var UiPercent = {};

  var container = null;
  var stateRef = null;
  var onStateChange = null;
  var debounceTimer = null;

  UiPercent.init = function(mountEl, state, onChangeCallback) {
    container = mountEl;
    stateRef = state;
    onStateChange = onChangeCallback;

    UiPercent.render();
  };

  function triggerHaptic(pattern) {
    if (navigator.vibrate) {
      try { navigator.vibrate(pattern); } catch (e) {}
    }
  }

  function notifyChange() {
    if (typeof onStateChange === 'function') {
      onStateChange(stateRef);
    }
  }

  UiPercent.render = function() {
    if (!container) return;
    container.textContent = '';

    var pctState = stateRef.percent;

    // Operation Selector Card
    var opCard = document.createElement('div');
    opCard.className = 'bento-card';
    opCard.style.marginBottom = '14px';

    var opLabel = document.createElement('label');
    opLabel.style.fontSize = '11px';
    opLabel.style.fontWeight = '700';
    opLabel.style.color = 'var(--text-secondary)';
    opLabel.style.textTransform = 'uppercase';
    opLabel.style.letterSpacing = '0.05em';
    opLabel.style.display = 'block';
    opLabel.style.marginBottom = '8px';
    opLabel.textContent = 'ЧТО ВЫЧИСЛИТЬ';
    opCard.appendChild(opLabel);

    var opSelect = document.createElement('select');
    opSelect.className = 'app-select';
    opSelect.id = 'pctOpSelect';

    var ops = window.CalcCore ? window.CalcCore.PERCENT_OPERATIONS : {};
    Object.keys(ops).forEach(function(key) {
      var opt = document.createElement('option');
      opt.value = key;
      opt.textContent = ops[key].title;
      if (key === pctState.op) opt.selected = true;
      opSelect.appendChild(opt);
    });

    opSelect.addEventListener('change', function() {
      pctState.op = opSelect.value;
      triggerHaptic(10);
      notifyChange();
      updateFormLayout();
      UiPercent.calculate();
    });
    opCard.appendChild(opSelect);
    container.appendChild(opCard);

    // Values Input Card
    var valCard = document.createElement('div');
    valCard.className = 'bento-card';
    valCard.id = 'pctValCard';

    var valTop = document.createElement('div');
    valTop.className = 'card-top';
    var valTitle = document.createElement('span');
    valTitle.style.fontSize = '11px';
    valTitle.style.fontWeight = '700';
    valTitle.style.color = 'var(--text-secondary)';
    valTitle.style.textTransform = 'uppercase';
    valTitle.textContent = 'ЗНАЧЕНИЯ ДЛЯ РАСЧЁТА';
    valTop.appendChild(valTitle);

    var swapBtn = document.createElement('button');
    swapBtn.type = 'button';
    swapBtn.className = 'swap-btn';
    swapBtn.title = 'Поменять местами';
    swapBtn.setAttribute('aria-label', 'Поменять местами значения');
    swapBtn.textContent = '⇄';
    swapBtn.addEventListener('click', function() {
      var tmp = pctState.v1;
      pctState.v1 = pctState.v2;
      pctState.v2 = tmp;
      triggerHaptic(15);
      var in1 = document.getElementById('pctInput1');
      var in2 = document.getElementById('pctInput2');
      if (in1) in1.value = pctState.v1;
      if (in2) in2.value = pctState.v2;
      notifyChange();
      UiPercent.calculate();
    });
    valTop.appendChild(swapBtn);
    valCard.appendChild(valTop);

    // Inputs Row
    var inputsRow = document.createElement('div');
    inputsRow.style.display = 'flex';
    inputsRow.style.alignItems = 'center';
    inputsRow.style.gap = '8px';
    inputsRow.style.marginBottom = '14px';

    var in1Wrapper = document.createElement('div');
    in1Wrapper.style.flex = '1';
    var in1 = document.createElement('input');
    in1.type = 'text';
    in1.inputMode = 'decimal';
    in1.className = 'app-input';
    in1.id = 'pctInput1';
    in1.value = pctState.v1 || '';
    in1.placeholder = '0';
    in1.addEventListener('input', function() {
      pctState.v1 = in1.value;
      notifyChange();
      scheduleRecalc();
    });
    in1Wrapper.appendChild(in1);
    inputsRow.appendChild(in1Wrapper);

    var sepLabel = document.createElement('span');
    sepLabel.id = 'pctSepLabel';
    sepLabel.style.color = 'var(--text-secondary)';
    sepLabel.style.fontWeight = '700';
    sepLabel.style.fontSize = '14px';
    sepLabel.style.whiteSpace = 'nowrap';
    sepLabel.textContent = '% от';
    inputsRow.appendChild(sepLabel);

    var in2Wrapper = document.createElement('div');
    in2Wrapper.style.flex = '1';
    in2Wrapper.id = 'pctIn2Wrapper';

    var in2 = document.createElement('input');
    in2.type = 'text';
    in2.inputMode = 'decimal';
    in2.className = 'app-input';
    in2.id = 'pctInput2';
    in2.value = pctState.v2 || '';
    in2.placeholder = '0';
    in2.addEventListener('input', function() {
      pctState.v2 = in2.value;
      notifyChange();
      scheduleRecalc();
    });
    in2Wrapper.appendChild(in2);

    // Alternative dropdown for NDS mode (operation 9)
    var ndsSelect = document.createElement('select');
    ndsSelect.className = 'app-select';
    ndsSelect.id = 'pctNdsSelect';
    ndsSelect.style.display = 'none';

    var ndsOpt1 = document.createElement('option');
    ndsOpt1.value = '1';
    ndsOpt1.textContent = 'Выделить НДС 20%';
    ndsSelect.appendChild(ndsOpt1);

    var ndsOpt2 = document.createElement('option');
    ndsOpt2.value = '2';
    ndsOpt2.textContent = 'Начислить НДС 20%';
    ndsSelect.appendChild(ndsOpt2);

    ndsSelect.value = String(pctState.ndsMode || 1);
    ndsSelect.addEventListener('change', function() {
      pctState.ndsMode = parseInt(ndsSelect.value, 10);
      notifyChange();
      UiPercent.calculate();
    });
    in2Wrapper.appendChild(ndsSelect);

    inputsRow.appendChild(in2Wrapper);

    var endLabel = document.createElement('span');
    endLabel.id = 'pctEndLabel';
    endLabel.style.color = 'var(--text-secondary)';
    endLabel.style.fontWeight = '700';
    endLabel.style.fontSize = '14px';
    endLabel.style.display = 'none';
    endLabel.textContent = '%';
    inputsRow.appendChild(endLabel);

    valCard.appendChild(inputsRow);

    // Rounding & Decimals Controls
    var roundRow = document.createElement('div');
    roundRow.style.display = 'flex';
    roundRow.style.alignItems = 'center';
    roundRow.style.gap = '10px';

    var roundLabel = document.createElement('span');
    roundLabel.style.fontSize = '13px';
    roundLabel.style.color = 'var(--text-secondary)';
    roundLabel.textContent = 'Округлять до:';
    roundRow.appendChild(roundLabel);

    var roundSelect = document.createElement('select');
    roundSelect.className = 'app-select';
    roundSelect.style.width = '70px';
    roundSelect.style.minHeight = '36px';
    roundSelect.style.padding = '6px 10px';
    [0, 1, 2, 3, 4].forEach(function(d) {
      var rOpt = document.createElement('option');
      rOpt.value = String(d);
      rOpt.textContent = String(d);
      if (d === pctState.round) rOpt.selected = true;
      roundSelect.appendChild(rOpt);
    });

    roundSelect.addEventListener('change', function() {
      pctState.round = parseInt(roundSelect.value, 10);
      notifyChange();
      UiPercent.calculate();
    });
    roundRow.appendChild(roundSelect);

    var signsLabel = document.createElement('span');
    signsLabel.style.fontSize = '13px';
    signsLabel.style.color = 'var(--text-muted)';
    signsLabel.textContent = 'знаков после запятой';
    roundRow.appendChild(signsLabel);

    valCard.appendChild(roundRow);
    container.appendChild(valCard);

    // Result Card
    var resCard = document.createElement('div');
    resCard.className = 'percent-result-card';
    resCard.id = 'pctResultCard';

    var resVal = document.createElement('div');
    resVal.className = 'percent-result-val';
    resVal.id = 'pctResultVal';
    resVal.textContent = '0';
    resCard.appendChild(resVal);

    var formulaBox = document.createElement('div');
    formulaBox.className = 'formula-display';
    formulaBox.id = 'pctFormulaBox';
    resCard.appendChild(formulaBox);

    var stepBox = document.createElement('div');
    stepBox.className = 'step-explanation';
    stepBox.id = 'pctStepBox';
    resCard.appendChild(stepBox);

    var copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'copy-result-btn';
    copyBtn.textContent = '📋 Скопировать результат';
    copyBtn.addEventListener('click', copyResult);
    resCard.appendChild(copyBtn);

    container.appendChild(resCard);

    // History Section
    var histSection = document.createElement('div');
    histSection.className = 'history-section';
    histSection.id = 'pctHistorySection';
    container.appendChild(histSection);

    updateFormLayout();
    renderHistory();
    UiPercent.calculate();
  };

  function updateFormLayout() {
    var opId = stateRef.percent.op;
    var ops = window.CalcCore ? window.CalcCore.PERCENT_OPERATIONS : {};
    var opMeta = ops[opId];
    if (!opMeta) return;

    var in1 = document.getElementById('pctInput1');
    var in2 = document.getElementById('pctInput2');
    var ndsSelect = document.getElementById('pctNdsSelect');
    var sep = document.getElementById('pctSepLabel');
    var end = document.getElementById('pctEndLabel');

    if (in1) in1.placeholder = opMeta.p1;
    if (sep) sep.textContent = opMeta.sep;

    if (opId === '9') {
      // NDS mode: hide input2, show NDS select
      if (in2) in2.style.display = 'none';
      if (ndsSelect) ndsSelect.style.display = 'block';
    } else {
      if (in2) {
        in2.style.display = 'block';
        in2.placeholder = opMeta.p2;
      }
      if (ndsSelect) ndsSelect.style.display = 'none';
    }

    if (end) {
      if (opMeta.end) {
        end.textContent = opMeta.end;
        end.style.display = 'inline';
      } else {
        end.style.display = 'none';
      }
    }
  }

  function scheduleRecalc() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function() {
      UiPercent.calculate();
    }, 120);
  }

  UiPercent.calculate = function() {
    if (!container || !window.CalcCore) return;

    var pctState = stateRef.percent;
    var opId = pctState.op;

    var resCard = document.getElementById('pctResultCard');
    var resVal = document.getElementById('pctResultVal');
    var formulaBox = document.getElementById('pctFormulaBox');
    var stepBox = document.getElementById('pctStepBox');

    if (opId === '9') {
      // NDS Mode
      var sum = window.CalcCore.parseNum(pctState.v1);
      if (isNaN(sum) || sum <= 0) {
        if (resCard) resCard.classList.remove('visible');
        return;
      }
      var ndsRes = window.CalcCore.PERCENT_OPERATIONS['9'].calc(sum, pctState.ndsMode);
      if (resCard && resVal && formulaBox && stepBox) {
        resVal.textContent = ndsRes.display;
        formulaBox.textContent = ndsRes.formula;
        stepBox.textContent = ndsRes.step;
        resCard.classList.add('visible');
      }
      return;
    }

    var v1 = pctState.v1;
    var v2 = pctState.v2;

    if (!v1 || !v2) {
      if (resCard) resCard.classList.remove('visible');
      return;
    }

    var result = window.CalcCore.calcPercent(opId, v1, v2, pctState.round);

    if (result.error) {
      if (resCard && resVal) {
        resVal.textContent = result.error;
        resVal.style.fontSize = '18px';
        resVal.style.color = 'var(--red-light)';
        if (formulaBox) formulaBox.textContent = '';
        if (stepBox) stepBox.textContent = '';
        resCard.classList.add('visible');
      }
      return;
    }

    if (resCard && resVal && formulaBox && stepBox) {
      resVal.style.fontSize = '36px';
      resVal.style.color = 'var(--accent-light)';
      resVal.textContent = result.display;
      formulaBox.textContent = result.formula;
      stepBox.textContent = result.step;
      resCard.classList.add('visible');

      // Add to history
      if (window.StorageManager) {
        window.StorageManager.addHistory({
          op: opId,
          display: result.display,
          formula: result.formula,
          v1: v1,
          v2: v2
        });
        renderHistory();
      }
    }
  };

  function copyResult() {
    var resVal = document.getElementById('pctResultVal');
    if (!resVal) return;
    var text = resVal.textContent;
    triggerHaptic(20);

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('Результат скопирован: ' + text);
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      showToast('Результат скопирован: ' + text);
    } catch (e) {}
    document.body.removeChild(ta);
  }

  function showToast(msg) {
    var toast = document.getElementById('globalToast');
    if (!toast) return;
    var toastText = toast.querySelector('.toast-text');
    if (toastText) toastText.textContent = msg;
    toast.classList.add('show');
    setTimeout(function() {
      toast.classList.remove('show');
    }, 2500);
  }

  function renderHistory() {
    var histSection = document.getElementById('pctHistorySection');
    if (!histSection || !window.StorageManager) return;
    histSection.textContent = '';

    var history = window.StorageManager.getHistory();
    if (!history.length) return;

    var header = document.createElement('div');
    header.className = 'history-header';

    var title = document.createElement('span');
    title.className = 'history-title';
    title.textContent = 'НЕДАВНИЕ ВЫЧИСЛЕНИЯ';
    header.appendChild(title);

    var clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'clear-history-btn';
    clearBtn.textContent = 'Очистить историю';
    clearBtn.addEventListener('click', function() {
      window.StorageManager.clearHistory();
      renderHistory();
    });
    header.appendChild(clearBtn);

    histSection.appendChild(header);

    history.forEach(function(item) {
      var row = document.createElement('div');
      row.className = 'history-item';

      var fBox = document.createElement('span');
      fBox.style.color = 'var(--text-secondary)';
      fBox.textContent = item.formula || item.display;
      row.appendChild(fBox);

      var rBox = document.createElement('span');
      rBox.style.fontWeight = '700';
      rBox.style.color = 'var(--accent-light)';
      rBox.textContent = item.display;
      row.appendChild(rBox);

      row.addEventListener('click', function() {
        stateRef.percent.op = item.op;
        stateRef.percent.v1 = item.v1;
        stateRef.percent.v2 = item.v2;
        triggerHaptic(15);
        notifyChange();
        UiPercent.render();
      });

      histSection.appendChild(row);
    });
  }

  root.UiPercent = UiPercent;

})(typeof window !== 'undefined' ? window : this);
