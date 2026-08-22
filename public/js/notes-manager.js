/**
 * Advanced Floating Notes & Task Manager
 * - Draggable floating window with resize support
 * - Line-numbered ruled smart notepad
 * - Shared (Socket.io) and Personal (localStorage) multi-note lines & tasks
 * - Search, filter, priority tags and quick export
 */

class NotesManager {
  constructor(socket, containerId) {
    this.socket = socket;
    this.container = document.getElementById(containerId);

    // Aktif Sekme: 'shared' | 'personal'
    this.activeTab = 'shared';

    // Ortak Veri
    this.sharedData = {
      text: '',
      todos: [], // [{ id, text, completed, priority: 'normal'|'high', createdBy, createdAt }]
      noteLines: [] // [{ id, content, author, timestamp }]
    };

    // Kişisel Veri (LocalStorage)
    this.personalData = {
      text: localStorage.getItem('synctimer_personal_notes') || '',
      todos: JSON.parse(localStorage.getItem('synctimer_personal_todos') || '[]'),
      noteLines: JSON.parse(localStorage.getItem('synctimer_personal_notelines') || '[]')
    };

    this.debounceTimer = null;
    this.searchQuery = '';

    this.initDOM();
    this.initEvents();
    this.initDraggable();
    this.initLineNumbers();
    this.initSocket();
    this.render();
  }

  initDOM() {
    this.tabSharedBtn = document.getElementById('tabSharedNotes');
    this.tabPersonalBtn = document.getElementById('tabPersonalNotes');

    this.notesBadge = document.getElementById('notesBadge');
    this.todoForm = document.getElementById('todoForm');
    this.todoInput = document.getElementById('todoInput');
    this.todoPrioritySelect = document.getElementById('todoPrioritySelect');
    this.todoList = document.getElementById('todoList');
    this.notesTextarea = document.getElementById('notesTextarea');
    this.lineNumbersEl = document.getElementById('notesLineNumbers');
    this.notesSearchInput = document.getElementById('notesSearchInput');

    this.btnNewNoteLine = document.getElementById('btnNewNoteLine');
    this.noteLinesList = document.getElementById('noteLinesList');
    this.btnClearCompletedTodos = document.getElementById('btnClearCompletedTodos');

    this.btnCloseNotes = document.getElementById('btnCloseNotes');
    this.btnMinimizeNotes = document.getElementById('btnMinimizeNotes');
  }

  initEvents() {
    // Sekme Değişimi
    if (this.tabSharedBtn) {
      this.tabSharedBtn.addEventListener('click', () => {
        this.activeTab = 'shared';
        this.tabSharedBtn.classList.add('active');
        this.tabPersonalBtn.classList.remove('active');
        this.render();
      });
    }

    if (this.tabPersonalBtn) {
      this.tabPersonalBtn.addEventListener('click', () => {
        this.activeTab = 'personal';
        this.tabPersonalBtn.classList.add('active');
        this.tabSharedBtn.classList.remove('active');
        this.render();
      });
    }

    // Görev Ekleme
    if (this.todoForm && this.todoInput) {
      this.todoForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = this.todoInput.value.trim();
        if (!text) return;
        const priority = this.todoPrioritySelect ? this.todoPrioritySelect.value : 'normal';

        this.addTodo(text, priority);
        this.todoInput.value = '';
      });
    }

    // Tamamlanan Görevleri Temizle
    if (this.btnClearCompletedTodos) {
      this.btnClearCompletedTodos.addEventListener('click', () => {
        this.clearCompletedTodos();
      });
    }

    // Yeni Not Satırı Ekle Butonu
    if (this.btnNewNoteLine) {
      this.btnNewNoteLine.addEventListener('click', () => {
        const text = prompt('Yeni not satırı girin:');
        if (text && text.trim()) {
          this.addNoteLine(text.trim());
        }
      });
    }

    // Arama / Filtre
    if (this.notesSearchInput) {
      this.notesSearchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.render();
      });
    }

    // Not Defteri Yazma (Debounced Sync)
    if (this.notesTextarea) {
      this.notesTextarea.addEventListener('input', () => {
        const text = this.notesTextarea.value;
        this.updateLineNumbers();
        if (this.activeTab === 'shared') {
          this.sharedData.text = text;
          this.debounceSyncShared();
        } else {
          this.personalData.text = text;
          localStorage.setItem('synctimer_personal_notes', text);
        }
      });

      this.notesTextarea.addEventListener('scroll', () => {
        if (this.lineNumbersEl) {
          this.lineNumbersEl.scrollTop = this.notesTextarea.scrollTop;
        }
      });
    }

    // Aç/Kapat & Minimize
    if (this.btnCloseNotes) {
      this.btnCloseNotes.addEventListener('click', () => this.hide());
    }

    if (this.btnMinimizeNotes) {
      this.btnMinimizeNotes.addEventListener('click', () => {
        this.container.classList.toggle('minimized');
      });
    }
  }

  initLineNumbers() {
    this.updateLineNumbers();
  }

  updateLineNumbers() {
    if (!this.lineNumbersEl || !this.notesTextarea) return;
    const lines = this.notesTextarea.value.split('\n').length;
    let html = '';
    for (let i = 1; i <= Math.max(lines, 8); i++) {
      html += `<div>${i}</div>`;
    }
    this.lineNumbersEl.innerHTML = html;
  }

  initDraggable() {
    if (!this.container) return;
    const header = this.container.querySelector('.notes-header');
    if (!header) return;

    let isDragging = false;
    let startX, startY, initX, initY;

    const onMouseDown = (e) => {
      if (e.target.closest('button') || e.target.closest('input')) return;
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

  bringToFront() {
    document.querySelectorAll('.floating-widget').forEach(w => w.style.zIndex = '999');
    if (this.container) this.container.style.zIndex = '1002';
  }

  initSocket() {
    if (!this.socket) return;

    this.socket.on('shared-notes-updated', (data) => {
      if (data && data.sharedNotes) {
        this.sharedData = data.sharedNotes;
        if (this.activeTab === 'shared') {
          this.render();
        }
      }
    });
  }

  setInitialSharedData(sharedNotes) {
    if (sharedNotes) {
      this.sharedData = sharedNotes;
      if (this.activeTab === 'shared') {
        this.render();
      }
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

  addTodo(text, priority = 'normal') {
    const newTodo = {
      id: Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      text: text.slice(0, 300),
      completed: false,
      priority, // 'normal' | 'high'
      createdBy: localStorage.getItem('synctimer_username') || 'Misafir',
      createdAt: Date.now()
    };

    if (this.activeTab === 'shared') {
      if (!this.sharedData.todos) this.sharedData.todos = [];
      this.sharedData.todos.unshift(newTodo);
      this.syncShared();
    } else {
      this.personalData.todos.unshift(newTodo);
      localStorage.setItem('synctimer_personal_todos', JSON.stringify(this.personalData.todos));
    }
    this.render();
  }

  toggleTodo(id) {
    const list = this.activeTab === 'shared' ? this.sharedData.todos : this.personalData.todos;
    const item = list.find(t => t.id === id);
    if (item) {
      item.completed = !item.completed;
      if (this.activeTab === 'shared') {
        this.syncShared();
      } else {
        localStorage.setItem('synctimer_personal_todos', JSON.stringify(this.personalData.todos));
      }
      this.render();
    }
  }

  deleteTodo(id) {
    if (this.activeTab === 'shared') {
      this.sharedData.todos = this.sharedData.todos.filter(t => t.id !== id);
      this.syncShared();
    } else {
      this.personalData.todos = this.personalData.todos.filter(t => t.id !== id);
      localStorage.setItem('synctimer_personal_todos', JSON.stringify(this.personalData.todos));
    }
    this.render();
  }

  clearCompletedTodos() {
    if (this.activeTab === 'shared') {
      this.sharedData.todos = this.sharedData.todos.filter(t => !t.completed);
      this.syncShared();
    } else {
      this.personalData.todos = this.personalData.todos.filter(t => !t.completed);
      localStorage.setItem('synctimer_personal_todos', JSON.stringify(this.personalData.todos));
    }
    this.render();
    if (window.showToast) window.showToast('Tamamlanan görevler temizlendi');
  }

  addNoteLine(text) {
    const newLine = {
      id: Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      content: text,
      author: localStorage.getItem('synctimer_username') || 'Misafir',
      timestamp: Date.now()
    };

    if (this.activeTab === 'shared') {
      if (!this.sharedData.noteLines) this.sharedData.noteLines = [];
      this.sharedData.noteLines.unshift(newLine);
      this.syncShared();
    } else {
      if (!this.personalData.noteLines) this.personalData.noteLines = [];
      this.personalData.noteLines.unshift(newLine);
      localStorage.setItem('synctimer_personal_notelines', JSON.stringify(this.personalData.noteLines));
    }
    this.render();
  }

  deleteNoteLine(id) {
    if (this.activeTab === 'shared') {
      this.sharedData.noteLines = (this.sharedData.noteLines || []).filter(l => l.id !== id);
      this.syncShared();
    } else {
      this.personalData.noteLines = (this.personalData.noteLines || []).filter(l => l.id !== id);
      localStorage.setItem('synctimer_personal_notelines', JSON.stringify(this.personalData.noteLines));
    }
    this.render();
  }

  debounceSyncShared() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.syncShared();
    }, 600);
  }

  syncShared() {
    if (this.socket) {
      this.socket.emit('update-shared-notes', this.sharedData);
    }
  }

  render() {
    const currentData = this.activeTab === 'shared' ? this.sharedData : this.personalData;

    // Not Textarea ve Satır Numaraları
    if (this.notesTextarea) {
      if (this.notesTextarea.value !== (currentData.text || '')) {
        this.notesTextarea.value = currentData.text || '';
      }
      this.notesTextarea.placeholder = this.activeTab === 'shared' 
        ? 'Odadaki herkesin eş zamanlı düzenlediği ortak satır notları...\n1. Toplantı gündem maddeleri\n2. Süre hedefleri...' 
        : 'Sadece sizin görebildiğiniz kişisel çizgili not defteriniz...\n- Kişisel notlar\n- Hızlı hatırlatıcılar...';
      this.updateLineNumbers();
    }

    // Rozet Güncelle
    const todos = currentData.todos || [];
    const totalTodos = todos.length;
    const completedTodos = todos.filter(t => t.completed).length;
    if (this.notesBadge) {
      this.notesBadge.innerText = totalTodos > 0 ? `${completedTodos}/${totalTodos}` : '0';
    }

    // Görevler Listesi Render
    if (this.todoList) {
      this.todoList.innerHTML = '';
      let filteredTodos = todos;
      if (this.searchQuery) {
        filteredTodos = filteredTodos.filter(t => t.text.toLowerCase().includes(this.searchQuery));
      }

      if (filteredTodos.length === 0) {
        this.todoList.innerHTML = `<div class="todo-empty">${this.searchQuery ? 'Aramayla eşleşen görev bulunamadı.' : 'Henüz görev eklenmedi.'}</div>`;
      } else {
        filteredTodos.forEach(item => {
          const row = document.createElement('div');
          const isHigh = item.priority === 'high';
          row.className = `todo-item ${item.completed ? 'completed' : ''} ${isHigh ? 'priority-high' : ''}`;
          row.innerHTML = `
            <label class="todo-checkbox-label">
              <input type="checkbox" ${item.completed ? 'checked' : ''}>
              <span class="custom-checkbox"></span>
              <div class="todo-text-wrap">
                <span class="todo-text">${this.escapeHtml(item.text)}</span>
                ${isHigh ? '<span class="priority-badge">Önemli</span>' : ''}
              </div>
            </label>
            <button class="btn-del-todo" title="Görevi Sil">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          `;

          const checkbox = row.querySelector('input[type="checkbox"]');
          checkbox.addEventListener('change', () => this.toggleTodo(item.id));

          const btnDel = row.querySelector('.btn-del-todo');
          btnDel.addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteTodo(item.id);
          });

          this.todoList.appendChild(row);
        });
      }
    }

    // Not Satırları Listesi Render (Multi-line Note Cards)
    if (this.noteLinesList) {
      this.noteLinesList.innerHTML = '';
      const lines = currentData.noteLines || [];
      let filteredLines = lines;
      if (this.searchQuery) {
        filteredLines = filteredLines.filter(l => l.content.toLowerCase().includes(this.searchQuery));
      }

      if (filteredLines.length === 0) {
        this.noteLinesList.innerHTML = `<div class="todo-empty">${this.searchQuery ? 'Eşleşen not satırı yok.' : 'Satır notu eklemek için "+ Satır Ekle"ye basın.'}</div>`;
      } else {
        filteredLines.forEach((line, index) => {
          const card = document.createElement('div');
          card.className = 'noteline-card';
          const timeStr = new Date(line.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          card.innerHTML = `
            <div class="noteline-num">#${lines.length - index}</div>
            <div class="noteline-content">
              <div class="noteline-text">${this.escapeHtml(line.content)}</div>
              <div class="noteline-meta">${this.escapeHtml(line.author || 'Misafir')} • ${timeStr}</div>
            </div>
            <button class="btn-del-noteline" title="Satırı Sil">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          `;

          const btnDel = card.querySelector('.btn-del-noteline');
          btnDel.addEventListener('click', () => this.deleteNoteLine(line.id));

          this.noteLinesList.appendChild(card);
        });
      }
    }
  }

  escapeHtml(str) {
    return (str || '').replace(/[&<>"']/g, (m) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[m]));
  }
}

// Global olarak sun
window.NotesManager = NotesManager;
