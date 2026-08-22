/**
 * Notes & To-Do Manager
 * Supports both Real-Time Shared Room Notes and Private Personal Notes
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
      todos: [] // [{ id, text, completed, createdBy, createdAt }]
    };

    // Kişisel Veri (LocalStorage)
    this.personalData = {
      text: localStorage.getItem('synctimer_personal_notes') || '',
      todos: JSON.parse(localStorage.getItem('synctimer_personal_todos') || '[]')
    };

    this.debounceTimer = null;

    this.initDOM();
    this.initEvents();
    this.initSocket();
    this.render();
  }

  initDOM() {
    this.tabSharedBtn = document.getElementById('tabSharedNotes');
    this.tabPersonalBtn = document.getElementById('tabPersonalNotes');

    this.notesBadge = document.getElementById('notesBadge');
    this.todoForm = document.getElementById('todoForm');
    this.todoInput = document.getElementById('todoInput');
    this.todoList = document.getElementById('todoList');
    this.notesTextarea = document.getElementById('notesTextarea');

    this.btnToggleNotes = document.getElementById('btnToggleNotes');
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

    // To-Do Ekleme
    if (this.todoForm && this.todoInput) {
      this.todoForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = this.todoInput.value.trim();
        if (!text) return;

        this.addTodo(text);
        this.todoInput.value = '';
      });
    }

    // Not Defteri Yazma (Debounced Sync)
    if (this.notesTextarea) {
      this.notesTextarea.addEventListener('input', () => {
        const text = this.notesTextarea.value;
        if (this.activeTab === 'shared') {
          this.sharedData.text = text;
          this.debounceSyncShared();
        } else {
          this.personalData.text = text;
          localStorage.setItem('synctimer_personal_notes', text);
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

  addTodo(text) {
    const newTodo = {
      id: Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      text: text.slice(0, 200),
      completed: false,
      createdBy: localStorage.getItem('synctimer_username') || 'Misafir',
      createdAt: Date.now()
    };

    if (this.activeTab === 'shared') {
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

    // Not Textarea Güncelle
    if (this.notesTextarea) {
      if (this.notesTextarea.value !== (currentData.text || '')) {
        this.notesTextarea.value = currentData.text || '';
      }
      this.notesTextarea.placeholder = this.activeTab === 'shared' 
        ? 'Odadaki herkesin eş zamanlı gördüğü ortak notlar...' 
        : 'Sadece sizin görebildiğiniz kişisel özel notlarınız...';
    }

    // Rozet Güncelle
    const totalTodos = currentData.todos.length;
    const completedTodos = currentData.todos.filter(t => t.completed).length;
    if (this.notesBadge) {
      this.notesBadge.innerText = totalTodos > 0 ? `${completedTodos}/${totalTodos}` : '0';
    }

    // To-Do Listesi Render
    if (this.todoList) {
      this.todoList.innerHTML = '';

      if (currentData.todos.length === 0) {
        this.todoList.innerHTML = `<div class="todo-empty">Henüz görev eklenmedi.</div>`;
        return;
      }

      currentData.todos.forEach(item => {
        const row = document.createElement('div');
        row.className = `todo-item ${item.completed ? 'completed' : ''}`;
        row.innerHTML = `
          <label class="todo-checkbox-label">
            <input type="checkbox" ${item.completed ? 'checked' : ''}>
            <span class="custom-checkbox"></span>
            <span class="todo-text">${this.escapeHtml(item.text)}</span>
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
