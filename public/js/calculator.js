/**
 * Advanced Scientific Floating Calculator
 * Trigonometric (sin, cos, tan, etc.), Logarithmic, Powers, Roots, Memory & History
 * Draggable, collapsible, keyboard-supported floating window
 */

class ScientificCalculator {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.displayExpression = document.getElementById('calcExpression');
    this.displayResult = document.getElementById('calcResult');
    this.historyList = document.getElementById('calcHistoryList');
    this.degRadBtn = document.getElementById('btnCalcDegRad');
    this.angleMode = 'DEG'; // 'DEG' | 'RAD'
    this.memoryValue = 0;

    this.currentInput = '0';
    this.expression = '';
    this.shouldResetInput = false;
    this.history = []; // [{ exp, res }]

    this.initEvents();
    this.initDraggable();
    this.initKeyboard();
  }

  initEvents() {
    if (!this.container) return;

    // Tuş tıklamaları
    this.container.querySelectorAll('[data-calc-val]').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = btn.getAttribute('data-calc-val');
        this.handleInput(val);
      });
    });

    this.container.querySelectorAll('[data-calc-fn]').forEach(btn => {
      btn.addEventListener('click', () => {
        const fn = btn.getAttribute('data-calc-fn');
        this.handleFunction(fn);
      });
    });

    if (this.degRadBtn) {
      this.degRadBtn.addEventListener('click', () => {
        this.angleMode = this.angleMode === 'DEG' ? 'RAD' : 'DEG';
        this.degRadBtn.innerText = this.angleMode;
        if (window.showToast) window.showToast(`Açı modu: ${this.angleMode}`);
      });
    }

    // Geçmişi temizle
    const btnClearHistory = document.getElementById('btnClearCalcHistory');
    if (btnClearHistory) {
      btnClearHistory.addEventListener('click', () => {
        this.history = [];
        this.renderHistory();
      });
    }

    // Minimize / Toggle
    const btnClose = document.getElementById('btnCloseCalc');
    if (btnClose) {
      btnClose.addEventListener('click', () => this.hide());
    }

    const btnMinimize = document.getElementById('btnMinimizeCalc');
    if (btnMinimize) {
      btnMinimize.addEventListener('click', () => {
        this.container.classList.toggle('minimized');
      });
    }
  }

  show() {
    if (!this.container) return;
    this.container.style.display = 'flex';
    this.container.classList.remove('minimized');
    this.bringToFront();
  }

  hide() {
    if (!this.container) return;
    this.container.style.display = 'none';
  }

  toggle() {
    if (!this.container) return;
    if (this.container.style.display === 'none' || !this.container.style.display) {
      this.show();
    } else {
      this.hide();
    }
  }

  bringToFront() {
    document.querySelectorAll('.floating-widget').forEach(w => w.style.zIndex = '999');
    if (this.container) this.container.style.zIndex = '1001';
  }

  // ==========================================
  // Hesaplama ve İşlem Mantığı
  // ==========================================
  handleInput(val) {
    if (this.shouldResetInput) {
      this.currentInput = '';
      this.shouldResetInput = false;
    }

    if (val === '.') {
      if (!this.currentInput.includes('.')) {
        this.currentInput = (this.currentInput || '0') + '.';
      }
    } else {
      if (this.currentInput === '0') {
        this.currentInput = val;
      } else {
        this.currentInput += val;
      }
    }
    this.updateDisplay();
  }

  handleFunction(fn) {
    let num = parseFloat(this.currentInput) || 0;

    switch (fn) {
      case 'clear': // AC
        this.currentInput = '0';
        this.expression = '';
        this.shouldResetInput = false;
        break;

      case 'delete': // ⌫
        if (this.currentInput.length > 1) {
          this.currentInput = this.currentInput.slice(0, -1);
        } else {
          this.currentInput = '0';
        }
        break;

      case 'negate': // ±
        if (this.currentInput !== '0') {
          if (this.currentInput.startsWith('-')) {
            this.currentInput = this.currentInput.slice(1);
          } else {
            this.currentInput = '-' + this.currentInput;
          }
        }
        break;

      case 'op': // +, -, *, /, %
        return; // Direkt data-op ile yönetiliyor

      // ================= Trigonometri =================
      case 'sin':
        this.applyUnary(num, (x) => {
          const rad = this.angleMode === 'DEG' ? (x * Math.PI) / 180 : x;
          return Math.sin(rad);
        }, `sin(${this.currentInput})`);
        break;

      case 'cos':
        this.applyUnary(num, (x) => {
          const rad = this.angleMode === 'DEG' ? (x * Math.PI) / 180 : x;
          return Math.cos(rad);
        }, `cos(${this.currentInput})`);
        break;

      case 'tan':
        this.applyUnary(num, (x) => {
          const rad = this.angleMode === 'DEG' ? (x * Math.PI) / 180 : x;
          return Math.tan(rad);
        }, `tan(${this.currentInput})`);
        break;

      case 'asin':
        this.applyUnary(num, (x) => {
          const res = Math.asin(x);
          return this.angleMode === 'DEG' ? (res * 180) / Math.PI : res;
        }, `asin(${this.currentInput})`);
        break;

      case 'acos':
        this.applyUnary(num, (x) => {
          const res = Math.acos(x);
          return this.angleMode === 'DEG' ? (res * 180) / Math.PI : res;
        }, `acos(${this.currentInput})`);
        break;

      case 'atan':
        this.applyUnary(num, (x) => {
          const res = Math.atan(x);
          return this.angleMode === 'DEG' ? (res * 180) / Math.PI : res;
        }, `atan(${this.currentInput})`);
        break;

      // ================= Logaritma & Üs =================
      case 'ln':
        this.applyUnary(num, (x) => Math.log(x), `ln(${this.currentInput})`);
        break;

      case 'log10':
        this.applyUnary(num, (x) => Math.log10(x), `log(${this.currentInput})`);
        break;

      case 'sqrt':
        this.applyUnary(num, (x) => Math.sqrt(x), `√(${this.currentInput})`);
        break;

      case 'cbrt':
        this.applyUnary(num, (x) => Math.cbrt(x), `∛(${this.currentInput})`);
        break;

      case 'sqr':
        this.applyUnary(num, (x) => x * x, `sqr(${this.currentInput})`);
        break;

      case 'cube':
        this.applyUnary(num, (x) => x * x * x, `cube(${this.currentInput})`);
        break;

      case 'exp':
        this.applyUnary(num, (x) => Math.exp(x), `e^(${this.currentInput})`);
        break;

      case 'ten_pow':
        this.applyUnary(num, (x) => Math.pow(10, x), `10^(${this.currentInput})`);
        break;

      case 'inv': // 1/x
        this.applyUnary(num, (x) => 1 / x, `1/(${this.currentInput})`);
        break;

      case 'abs': // |x|
        this.applyUnary(num, (x) => Math.abs(x), `abs(${this.currentInput})`);
        break;

      case 'fact': // n!
        this.applyUnary(num, (x) => this.factorial(Math.floor(x)), `fact(${this.currentInput})`);
        break;

      case 'pi':
        this.currentInput = Math.PI.toString();
        this.shouldResetInput = true;
        break;

      case 'e':
        this.currentInput = Math.E.toString();
        this.shouldResetInput = true;
        break;

      case 'rand':
        this.currentInput = Math.random().toFixed(4);
        this.shouldResetInput = true;
        break;

      // ================= Hafıza =================
      case 'mc':
        this.memoryValue = 0;
        if (window.showToast) window.showToast('Hafıza temizlendi (MC)');
        break;
      case 'mr':
        this.currentInput = this.memoryValue.toString();
        this.shouldResetInput = true;
        if (window.showToast) window.showToast(`Hafıza okundu: ${this.memoryValue}`);
        break;
      case 'm_plus':
        this.memoryValue += num;
        this.shouldResetInput = true;
        if (window.showToast) window.showToast(`Hafızaya eklendi (M+): ${this.memoryValue}`);
        break;
      case 'm_minus':
        this.memoryValue -= num;
        this.shouldResetInput = true;
        if (window.showToast) window.showToast(`Hafızadan çıkarıldı (M-): ${this.memoryValue}`);
        break;

      // ================= Eşittir & İşlemler =================
      case 'add_op':
        this.appendOperator('+');
        break;
      case 'sub_op':
        this.appendOperator('-');
        break;
      case 'mul_op':
        this.appendOperator('×');
        break;
      case 'div_op':
        this.appendOperator('÷');
        break;
      case 'pow_op':
        this.appendOperator('^');
        break;
      case 'mod_op':
        this.appendOperator('%');
        break;
      case 'open_paren':
        this.expression += '(';
        break;
      case 'close_paren':
        this.expression += (this.currentInput || '') + ')';
        this.currentInput = '0';
        break;
      case 'equals':
        this.calculate();
        break;
    }
    this.updateDisplay();
  }

  appendOperator(op) {
    if (this.currentInput !== '') {
      this.expression += ` ${this.currentInput} ${op}`;
      this.currentInput = '0';
      this.shouldResetInput = false;
    } else if (this.expression.length > 0) {
      this.expression = this.expression.replace(/[\+\-×÷\^%]$/, op);
    }
    this.updateDisplay();
  }

  applyUnary(val, fn, exprText) {
    try {
      const res = fn(val);
      if (isNaN(res) || !isFinite(res)) {
        this.currentInput = 'Geçersiz';
      } else {
        const rounded = this.formatResult(res);
        this.addHistory(exprText, rounded);
        this.currentInput = rounded.toString();
      }
      this.shouldResetInput = true;
    } catch (e) {
      this.currentInput = 'Hata';
    }
    this.updateDisplay();
  }

  calculate() {
    let fullExpr = this.expression + ' ' + (this.currentInput || '0');
    fullExpr = fullExpr.trim();

    if (!fullExpr) return;

    try {
      // Güvenli matematik ifadesi dönüştürme
      let sanitized = fullExpr
        .replace(/×/g, '*')
        .replace(/÷/g, '/')
        .replace(/\^/g, '**')
        .replace(/π/g, 'Math.PI')
        .replace(/e/g, 'Math.E');

      // Güvenli hesaplama
      // eslint-disable-next-line no-new-func
      const calcFn = new Function(`'use strict'; return (${sanitized})`);
      const res = calcFn();

      if (isNaN(res) || !isFinite(res)) {
        this.currentInput = 'Sıfıra Bölünemez';
      } else {
        const formatted = this.formatResult(res);
        this.addHistory(fullExpr, formatted);
        this.currentInput = formatted.toString();
      }
      this.expression = '';
      this.shouldResetInput = true;
    } catch (err) {
      this.currentInput = 'Sözdizimi Hatası';
      this.shouldResetInput = true;
    }
    this.updateDisplay();
  }

  factorial(n) {
    if (n < 0) return NaN;
    if (n > 170) return Infinity;
    let res = 1;
    for (let i = 2; i <= n; i++) res *= i;
    return res;
  }

  formatResult(val) {
    if (Math.abs(val) < 1e-10 && val !== 0) return 0;
    const num = Number(val);
    if (Number.isInteger(num)) return num;
    return parseFloat(num.toFixed(10));
  }

  updateDisplay() {
    if (this.displayExpression) {
      this.displayExpression.innerText = this.expression || '';
    }
    if (this.displayResult) {
      this.displayResult.innerText = this.currentInput || '0';
    }
  }

  addHistory(exp, res) {
    this.history.unshift({ exp, res });
    if (this.history.length > 25) this.history.pop();
    this.renderHistory();
  }

  renderHistory() {
    if (!this.historyList) return;
    this.historyList.innerHTML = '';

    if (this.history.length === 0) {
      this.historyList.innerHTML = '<div class="calc-hist-empty">İşlem geçmişi yok</div>';
      return;
    }

    this.history.forEach(item => {
      const row = document.createElement('div');
      row.className = 'calc-hist-row';
      row.innerHTML = `
        <span class="calc-hist-exp">${item.exp} =</span>
        <span class="calc-hist-res">${item.res}</span>
      `;
      row.addEventListener('click', () => {
        this.currentInput = item.res.toString();
        this.shouldResetInput = true;
        this.updateDisplay();
      });
      this.historyList.appendChild(row);
    });
  }

  // ==========================================
  // Sürükle ve Bırak (Draggable) Pencere
  // ==========================================
  initDraggable() {
    if (!this.container) return;
    const header = this.container.querySelector('.calc-header');
    if (!header) return;

    let isDragging = false;
    let startX, startY, initX, initY;

    const onMouseDown = (e) => {
      if (e.target.closest('button')) return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      initX = this.container.offsetLeft;
      initY = this.container.offsetTop;
      this.bringToFront();
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };

    const onMouseMove = (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      let newX = Math.max(10, Math.min(window.innerWidth - this.container.offsetWidth - 10, initX + dx));
      let newY = Math.max(10, Math.min(window.innerHeight - this.container.offsetHeight - 10, initY + dy));

      this.container.style.left = `${newX}px`;
      this.container.style.top = `${newY}px`;
      this.container.style.right = 'auto';
      this.container.style.bottom = 'auto';
    };

    const onMouseUp = () => {
      isDragging = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    header.addEventListener('mousedown', onMouseDown);
  }

  // ==========================================
  // Klavye Desteği
  // ==========================================
  initKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (this.container.style.display === 'none' || !this.container.style.display) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      const key = e.key;

      if (!isNaN(key)) {
        this.handleInput(key);
      } else if (key === '.') {
        this.handleInput('.');
      } else if (key === '+') {
        this.appendOperator('+');
      } else if (key === '-') {
        this.appendOperator('-');
      } else if (key === '*') {
        this.appendOperator('×');
      } else if (key === '/') {
        this.appendOperator('÷');
      } else if (key === '^') {
        this.appendOperator('^');
      } else if (key === '%') {
        this.appendOperator('%');
      } else if (key === 'Enter' || key === '=') {
        e.preventDefault();
        this.calculate();
      } else if (key === 'Backspace') {
        this.handleFunction('delete');
      } else if (key === 'Escape') {
        this.handleFunction('clear');
      }
    });
  }
}

// Global olarak tarayıcıya sun
window.ScientificCalculator = ScientificCalculator;
