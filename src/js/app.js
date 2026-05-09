// Main application - ties together data, UI rendering, and backend IPC

class TodoApp {
  constructor() {
    this.tree = window.todoTree;
    this.interactions = window.interactions;
    this.dropdowns = window.dropdowns;
    this.container = document.getElementById('todo-list');
    this.filterCategory = document.getElementById('filter-category');
    this.filterPriority = document.getElementById('filter-priority');
    this.filterIncomplete = document.getElementById('filter-incomplete-only');
    this.quickAdd = document.getElementById('quick-add-input');
    this.progressBar = document.getElementById('progress-bar');
    this.progressText = document.getElementById('progress-text');
    this.isTauri = typeof window.__TAURI__ !== 'undefined'
      || typeof window.__TAURI_INTERNALS__ !== 'undefined';
    this._invoke = window.__TAURI__?.core?.invoke
      || window.__TAURI_INTERNALS__?.invoke
      || null;
  }

  async init() {
    // Wire up interactions
    this.interactions.init(this.container);
    this.dropdowns.init();

    // Wire up callbacks
    this.interactions.onChange = (afterRender) => {
      this.render();
      if (afterRender) afterRender();
      this._updateProgress();
    };

    this.interactions.onSave = (id, changes, isNew, isDelete) => {
      this._saveToBackend(id, changes, isNew, isDelete);
    };

    this.dropdowns.onChange = () => {
      this.render();
      this._updateProgress();
    };

    this.dropdowns.onSave = (id, changes) => {
      this._saveToBackend(id, changes);
    };

    // Filter listeners
    this.filterCategory.addEventListener('change', () => this.render());
    this.filterPriority.addEventListener('change', () => this.render());
    this.filterIncomplete.addEventListener('change', () => this.render());

    // Quick add
    this.quickAdd.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const title = this.quickAdd.textContent.trim();
        if (title) {
          this._quickAdd(title);
          this.quickAdd.textContent = '';
        }
      }
      // Backspace on empty quick-add does nothing special
    });

    // Load data
    await this._loadData();
    this.render();
    this._updateProgress();

    // Focus quick add on Ctrl+N or just clicking the area
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        this.quickAdd.focus();
      }
    });

    // Handle window close to tray via Tauri
    if (this.isTauri) {
      this._setupTauriListeners();
    }
  }

  // === Render ===
  render() {
    const catFilter = this.filterCategory.value;
    const priFilter = this.filterPriority.value;
    const incompleteOnly = this.filterIncomplete.checked;

    let items = this.tree.getFilteredItems({
      category: catFilter,
      priority: priFilter,
      incompleteOnly,
    });

    if (items.length === 0) {
      this.container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📝</div>
          <div class="empty-text">还没有待办事项<br>点击下方输入框开始记录</div>
        </div>
      `;
      return;
    }

    this.container.innerHTML = items.map(item => this._renderItem(item)).join('');

    // Mark last children for guide line styling
    this.container.querySelectorAll('.todo-item').forEach(el => {
      const id = parseInt(el.dataset.id);
      const item = this.tree.getItem(id);
      if (item) {
        const siblings = this.tree.items.filter(i => i.parent_id === item.parent_id);
        siblings.sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
        if (siblings.length > 0 && siblings[siblings.length - 1].id === id) {
          el.classList.add('last-child');
        }
      }
    });
  }

  _renderItem(item) {
    const level = item._level || 0;
    const checked = item.completed ? ' checked' : '';
    const completedClass = item.completed ? ' completed' : '';
    const priorityClass = `pri-${item.priority || 2}`;
    const catClass = `cat-${item.category || '默认'}`;

    // Due date display - always show a trigger icon
    let dueHTML = '';
    if (item.due_date) {
      const dueDate = new Date(item.due_date);
      const now = new Date();
      let dueClass = '';
      let dueLabel = '';

      if (dueDate < now) {
        dueClass = ' overdue';
        dueLabel = '已过期';
      } else {
        const diffDays = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
        if (diffDays === 0) {
          dueClass = ' due-today';
          dueLabel = '今天';
        } else if (diffDays === 1) {
          dueLabel = '明天';
        } else {
          dueLabel = `${dueDate.getMonth() + 1}/${dueDate.getDate()}`;
        }
      }
      dueHTML = `<span class="due-badge${dueClass}" title="截止: ${dueDate.toLocaleString('zh-CN')}">📅 ${dueLabel}</span>`;
    } else {
      // Always show a subtle date trigger so user can add a date
      dueHTML = '<span class="date-trigger" title="添加截止日期">📅</span>';
    }

    return `
      <div class="todo-item${completedClass}" data-id="${item.id}" data-level="${level}" tabindex="-1">
        <div class="checkbox${checked}" data-action="toggle"></div>
        <div class="item-content" contenteditable="false">${this._escapeHTML(item.title)}</div>
        <div class="item-meta">
          ${dueHTML}
          <span class="cat-tag ${catClass}">${item.category || '默认'}</span>
          <span class="pri-dot ${priorityClass}"></span>
        </div>
      </div>
    `;
  }

  _escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  _updateProgress() {
    const { total, completed, percent } = this.tree.getProgress();
    this.progressBar.style.width = percent + '%';
    if (total > 0) {
      this.progressText.textContent = `${completed}/${total} 已完成`;
    } else {
      this.progressText.textContent = '';
    }
  }

  // === Quick Add ===
  _quickAdd(title) {
    const newItem = this.tree.addItem(null, title);
    this._saveToBackend(newItem.id, { title, parent_id: null }, true);
    this.render();
    this._updateProgress();
  }

  // === Backend Communication ===
  async _saveToBackend(id, changes, isNew = false, isDelete = false) {
    this._saveToLocalStorage();
    if (this._invoke) {
      try {
        if (isDelete) {
          await this._invoke('delete_todo', { id });
        } else if (isNew) {
          const newId = await this._invoke('add_todo', { new: {
            parent_id: changes.parent_id,
            title: changes.title || '',
            category: changes.category || '默认',
            priority: changes.priority || 2,
            due_date: changes.due_date,
          }});
          const item = this.tree.getItem(id);
          if (item && newId !== id) {
            this.tree.items = this.tree.items.map(i => {
              if (i.id === id) return { ...i, id: newId };
              if (i.parent_id === id) return { ...i, parent_id: newId };
              return i;
            });
            this.tree._rebuildTree();
            this.render();
            this._updateProgress();
            this._saveToLocalStorage();
          }
        } else {
          await this._invoke('update_todo', { u: { id, ...changes } });
        }
      } catch (err) {
        this._saveToLocalStorage();
      }
    }
  }

  async _loadData(forceLocal = false) {
    if (!forceLocal && this._invoke) {
      try {
        const todos = await this._invoke('get_todos');
        if (todos && todos.length > 0) {
          this.tree.load(todos);
          this._saveToLocalStorage();
          return;
        }
      } catch (err) {
        console.error('Backend load error:', err);
      }
    }
    if (!this._loadFromLocalStorage()) {
      this._loadDemoData();
    }
  }

  _setupTauriListeners() {
    const listen = window.__TAURI__?.event?.listen
      || window.__TAURI_INTERNALS__?.event?.listen;
    if (listen) {
      listen('tray-show', async () => {
        await this._loadData(true);
        this.render();
        this._updateProgress();
      });
    }
  }

  // === localStorage Fallback ===
  _saveToLocalStorage() {
    try {
      localStorage.setItem('todo-app-data', JSON.stringify(this.tree.items));
    } catch (e) {
      // Storage full or unavailable
    }
  }

  _loadFromLocalStorage() {
    try {
      const data = localStorage.getItem('todo-app-data');
      if (data) {
        this.tree.load(JSON.parse(data));
        return true;
      }
    } catch (e) {
      // Ignore parse errors
    }
    return false;
  }

  _loadDemoData() {
    this.tree.load([
      { id: 1, parent_id: null, title: '欢迎使用 TODO 提醒', category: '工作', priority: 1,
        due_date: null, completed: false, sort_order: 0, reminded: false, created_at: new Date().toISOString() },
      { id: 2, parent_id: 1, title: '双击文本可以编辑', category: '工作', priority: 2,
        due_date: null, completed: false, sort_order: 0, reminded: false, created_at: new Date().toISOString() },
      { id: 3, parent_id: 1, title: '按 Enter 创建子项', category: '工作', priority: 2,
        due_date: null, completed: false, sort_order: 1, reminded: false, created_at: new Date().toISOString() },
      { id: 4, parent_id: null, title: '点击左侧圆圈完成任务', category: '生活', priority: 3,
        due_date: null, completed: true, sort_order: 1, reminded: false, created_at: new Date().toISOString() },
      { id: 5, parent_id: null, title: '悬停可设置分类和优先级', category: '学习', priority: 2,
        due_date: new Date(Date.now() + 86400000).toISOString(), completed: false, sort_order: 2, reminded: false,
        created_at: new Date().toISOString() },
    ]);
  }
}

// Bootstrap
document.addEventListener('DOMContentLoaded', () => {
  window.app = new TodoApp();
  window.app.init();
});
