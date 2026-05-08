// Feishu-like TODO list interactions

class InteractionManager {
  constructor() {
    this.focusedItemId = null;
    this.editingItemId = null;
    this.onChange = null;
    this.onSave = null;
  }

  init(container) {
    this.container = container;

    // Click handler (event delegation)
    container.addEventListener('click', (e) => {
      const itemEl = e.target.closest('.todo-item');
      if (!itemEl) {
        this._clearFocus();
        return;
      }

      const id = parseInt(itemEl.dataset.id);

      if (e.target.closest('.checkbox')) {
        this._toggleComplete(id);
        return;
      }

      if (e.target.closest('.cat-tag')) {
        e.stopPropagation();
        this._showCategoryDropdown(e.target.closest('.cat-tag'), id);
        return;
      }
      if (e.target.closest('.pri-dot')) {
        e.stopPropagation();
        this._showPriorityDropdown(e.target.closest('.pri-dot'), id);
        return;
      }
      if (e.target.closest('.due-badge, .date-trigger')) {
        e.stopPropagation();
        this._showDatePicker(e.target.closest('.due-badge, .date-trigger'), id);
        return;
      }

      this._focusItem(id, itemEl);
    });

    // Double-click to edit
    container.addEventListener('dblclick', (e) => {
      const itemEl = e.target.closest('.todo-item');
      if (!itemEl) return;
      if (e.target.closest('.checkbox, .cat-tag, .pri-dot, .due-badge, .date-trigger')) return;

      const id = parseInt(itemEl.dataset.id);
      this._startEdit(id, itemEl);
    });

    // Keyboard handler - on document so it works when item div has focus
    document.addEventListener('keydown', (e) => {
      // Only handle when we have a focused item
      if (this.editingItemId == null && this.focusedItemId == null) return;

      const activeId = this.editingItemId || this.focusedItemId;
      const itemEl = this.container.querySelector(`[data-id="${activeId}"]`);
      if (!itemEl) return;

      const contentEl = itemEl.querySelector('.item-content');

      // Enter: create child and start editing it
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (this.editingItemId != null) {
          this._commitEdit(activeId);
        }
        this._createChild(activeId);
        return;
      }

      // Backspace on empty content: promote level
      if (e.key === 'Backspace') {
        const text = contentEl ? contentEl.textContent.trim() : '';
        if (text === '') {
          e.preventDefault();
          if (this.editingItemId != null) {
            this._commitEdit(activeId);
          }
          this._promoteItem(activeId);
          return;
        }
        // Otherwise let Backspace work normally (delete chars in edit mode)
        if (this.editingItemId == null) {
          // Not editing, hit Backspace on non-empty = start editing at end
          e.preventDefault();
          this._startEdit(activeId, itemEl);
          // Place cursor at end
          const sel = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(contentEl);
          range.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range);
        }
        return;
      }

      // Delete: remove item
      if (e.key === 'Delete') {
        e.preventDefault();
        if (this.editingItemId != null) {
          this._commitEdit(activeId);
        }
        this._deleteItem(activeId);
        return;
      }

      // Tab: indent
      if (e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        if (this.editingItemId != null) {
          this._commitEdit(activeId);
        }
        this._indentItem(activeId);
        return;
      }

      // Shift+Tab: promote
      if (e.key === 'Tab' && e.shiftKey) {
        e.preventDefault();
        if (this.editingItemId != null) {
          this._commitEdit(activeId);
        }
        this._promoteItem(activeId);
        return;
      }

      // Escape: finish editing / clear focus
      if (e.key === 'Escape') {
        e.preventDefault();
        if (this.editingItemId != null) {
          this._commitEdit(activeId);
        }
        this._clearFocus();
        return;
      }

      // Arrow keys: navigate between items
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (this.editingItemId != null) {
          this._commitEdit(activeId);
        }
        this._navigate(activeId, e.key === 'ArrowUp' ? -1 : 1);
        return;
      }

      // Any other key: if focused but not editing, enter edit mode
      if (this.editingItemId == null && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        this._startEdit(activeId, itemEl);
        // Insert the typed character
        if (contentEl) {
          contentEl.textContent = contentEl.textContent + e.key;
          const sel = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(contentEl);
          range.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }
    });

    // Blur handler for contenteditable
    container.addEventListener('blur', (e) => {
      const contentEl = e.target.closest('.item-content');
      if (contentEl) {
        const itemEl = contentEl.closest('.todo-item');
        if (itemEl) {
          const id = parseInt(itemEl.dataset.id);
          setTimeout(() => this._commitEdit(id), 150);
        }
      }
    }, true);
  }

  // === Focus Management ===
  _focusItem(id, itemEl) {
    this._clearFocus();
    this.focusedItemId = id;
    itemEl.classList.add('focused');
    itemEl.focus({ preventScroll: false });  // Make item receive keyboard events
  }

  _clearFocus() {
    if (this.focusedItemId != null) {
      const el = this.container.querySelector(`[data-id="${this.focusedItemId}"]`);
      if (el) el.classList.remove('focused');
      this.focusedItemId = null;
    }
    // Return focus to document body so keyboard events still work
    if (this.editingItemId == null) {
      document.body.focus();
    }
  }

  // === Editing ===
  _startEdit(id, itemEl) {
    const contentEl = itemEl.querySelector('.item-content');
    if (!contentEl) return;

    this.focusedItemId = id;
    this.editingItemId = id;
    itemEl.classList.add('focused');

    contentEl.contentEditable = 'true';
    contentEl.focus();

    // Place cursor at end of text
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(contentEl);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  _commitEdit(id) {
    if (this.editingItemId !== id) return;

    const itemEl = this.container.querySelector(`[data-id="${id}"]`);
    if (!itemEl) { this.editingItemId = null; return; }

    const contentEl = itemEl.querySelector('.item-content');
    if (!contentEl) { this.editingItemId = null; return; }

    contentEl.contentEditable = 'false';
    const newTitle = contentEl.textContent.trim();

    if (newTitle === '') {
      this.editingItemId = null;
      this._deleteItem(id);
      return;
    }

    const item = window.todoTree.getItem(id);
    if (item && item.title !== newTitle) {
      item.title = newTitle;
      if (this.onSave) this.onSave(id, { title: newTitle });
    }

    this.editingItemId = null;
    // Keep the item focused after committing edit
    if (this.onChange) this.onChange(() => {
      const newEl = this.container.querySelector(`[data-id="${id}"]`);
      if (newEl) {
        this.focusedItemId = id;
        newEl.classList.add('focused');
        newEl.focus({ preventScroll: false });
      }
    });
  }

  // === Actions ===
  _toggleComplete(id) {
    window.todoTree.toggleComplete(id);
    if (this.onSave) {
      const item = window.todoTree.getItem(id);
      if (item) this.onSave(id, { completed: item.completed });
    }
    if (this.onChange) this.onChange();
  }

  _createChild(parentId) {
    const newItem = window.todoTree.addItem(parentId, '');
    if (this.onSave) this.onSave(newItem.id, {
      title: '',
      parent_id: parentId,
      category: window.todoTree.getItem(parentId)?.category || '默认',
    }, true);

    if (this.onChange) this.onChange(() => {
      const newEl = this.container.querySelector(`[data-id="${newItem.id}"]`);
      if (newEl) {
        newEl.scrollIntoView({ block: 'nearest' });
        this._startEdit(newItem.id, newEl);
      }
    });
  }

  _promoteItem(id) {
    const item = window.todoTree.getItem(id);
    if (!item || item.parent_id == null) return;

    window.todoTree.promoteItem(id);
    if (this.onSave) this.onSave(id, { parent_id: item.parent_id });
    if (this.onChange) this.onChange(() => {
      const el = this.container.querySelector(`[data-id="${id}"]`);
      if (el) {
        el.scrollIntoView({ block: 'nearest' });
        el.classList.add('focused');
        this.focusedItemId = id;
        el.focus({ preventScroll: false });
      }
    });
  }

  _indentItem(id) {
    const item = window.todoTree.getItem(id);
    if (!item) return;

    const siblings = window.todoTree.items.filter(i => i.parent_id === item.parent_id);
    siblings.sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
    const myIdx = siblings.findIndex(i => i.id === id);
    if (myIdx <= 0) return;

    const prevSibling = siblings[myIdx - 1];
    item.parent_id = prevSibling.id;
    window.todoTree._rebuildTree();

    if (this.onSave) this.onSave(id, { parent_id: prevSibling.id });
    if (this.onChange) this.onChange(() => {
      const el = this.container.querySelector(`[data-id="${id}"]`);
      if (el) {
        el.scrollIntoView({ block: 'nearest' });
        el.classList.add('focused');
        this.focusedItemId = id;
        el.focus({ preventScroll: false });
      }
    });
  }

  _deleteItem(id) {
    const itemEl = this.container.querySelector(`[data-id="${id}"]`);
    if (itemEl) {
      // Move focus to next sibling or parent
      const nextEl = itemEl.nextElementSibling;
      const prevEl = itemEl.previousElementSibling;

      itemEl.classList.add('removing');
      itemEl.addEventListener('animationend', () => {
        window.todoTree.deleteItem(id);
        if (this.onSave) this.onSave(id, null, false, true);
        if (this.onChange) this.onChange(() => {
          // Try to focus the next item
          const targetEl = nextEl || prevEl;
          if (targetEl && targetEl.classList.contains('todo-item')) {
            const targetId = parseInt(targetEl.dataset.id);
            this._focusItem(targetId, targetEl);
          }
        });
      }, { once: true });
    } else {
      window.todoTree.deleteItem(id);
      if (this.onSave) this.onSave(id, null, false, true);
      if (this.onChange) this.onChange();
    }
  }

  _navigate(currentId, direction) {
    const visibleIds = window.todoTree.getDisplayItems().map(i => i.id);
    const idx = visibleIds.indexOf(currentId);
    if (idx === -1) return;

    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= visibleIds.length) return;

    const newId = visibleIds[newIdx];
    const newEl = this.container.querySelector(`[data-id="${newId}"]`);
    if (newEl) {
      this._clearFocus();
      this._focusItem(newId, newEl);
      newEl.scrollIntoView({ block: 'nearest' });
    }
  }

  // === Dropdown Triggers ===
  _showCategoryDropdown(anchor, id) {
    if (typeof window.showCategoryDropdown === 'function') {
      window.showCategoryDropdown(anchor, id);
    }
  }
  _showPriorityDropdown(anchor, id) {
    if (typeof window.showPriorityDropdown === 'function') {
      window.showPriorityDropdown(anchor, id);
    }
  }
  _showDatePicker(anchor, id) {
    if (typeof window.showDatePicker === 'function') {
      window.showDatePicker(anchor, id);
    }
  }
}

window.interactions = new InteractionManager();
