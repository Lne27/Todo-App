// Tree data structure for hierarchical TODOs
// Stores flat list from backend, computes tree structure client-side

class TodoTree {
  constructor() {
    this.items = [];           // All items (flat from DB)
    this.nextId = -1;          // Temporary negative IDs for new items
  }

  // Load items from backend (sorted flat list)
  load(items) {
    this.items = items.map(item => ({
      ...item,
      _level: 0,               // Computed display level
      _children: [],           // Direct children references
    }));
    this._rebuildTree();
    this.nextId = Math.min(-1, ...this.items.map(i => i.id).filter(id => id < 0)) - 1;
    if (this.nextId > -1) this.nextId = -1;
  }

  // Build parent-child relationships and compute levels
  _rebuildTree() {
    const map = new Map();
    const roots = [];

    for (const item of this.items) {
      map.set(item.id, item);
      item._children = [];
    }

    for (const item of this.items) {
      if (item.parent_id != null && map.has(item.parent_id)) {
        map.get(item.parent_id)._children.push(item);
      } else {
        roots.push(item);
      }
    }

    // BFS to assign levels and flatten for display order
    const flatOrder = [];
    const visit = (node, level) => {
      node._level = level;
      flatOrder.push(node);
      for (const child of node._children) {
        visit(child, level + 1);
      }
    };

    for (const root of roots) {
      visit(root, 0);
    }

    // Update this.items to match display order
    this.items = flatOrder;
  }

  // Get items in display order (already sorted by _rebuildTree)
  getDisplayItems() {
    return this.items;
  }

  // Get visible items (respecting filters)
  getFilteredItems({ category, priority, incompleteOnly }) {
    return this.items.filter(item => {
      if (category && item.category !== category) return false;
      if (priority && item.priority !== parseInt(priority)) return false;
      if (incompleteOnly && item.completed) return false;
      return true;
    });
  }

  // Add new item
  addItem(parentId, title, category = '默认', priority = 2) {
    const id = this.nextId--;
    const newItem = {
      id,
      parent_id: parentId,
      title,
      category,
      priority,
      due_date: null,
      completed: false,
      sort_order: this.items.length,
      reminded: false,
      created_at: new Date().toISOString(),
      _level: 0,
      _children: [],
    };
    this.items.push(newItem);
    this._rebuildTree();
    return newItem;
  }

  // Update item
  updateItem(id, changes) {
    const item = this.items.find(i => i.id === id);
    if (!item) return;
    Object.assign(item, changes);
    // If parent changed, rebuild tree
    if ('parent_id' in changes) {
      this._rebuildTree();
    }
  }

  // Delete item and its children
  deleteItem(id) {
    const toDelete = new Set();
    const collect = (itemId) => {
      toDelete.add(itemId);
      const item = this.items.find(i => i.id === itemId);
      if (item) {
        for (const child of this.items.filter(i => i.parent_id === itemId)) {
          collect(child.id);
        }
      }
    };
    collect(id);
    this.items = this.items.filter(i => !toDelete.has(i.id));
    this._rebuildTree();
  }

  // Toggle complete
  toggleComplete(id) {
    const item = this.items.find(i => i.id === id);
    if (item) {
      item.completed = !item.completed;
    }
  }

  // Promote item (move up one level)
  promoteItem(id) {
    const item = this.items.find(i => i.id === id);
    if (!item || item.parent_id == null) return; // Already at root

    const parent = this.items.find(i => i.id === item.parent_id);
    if (!parent) return;

    // Move to grandparent level
    item.parent_id = parent.parent_id;
    this._rebuildTree();
  }

  // Get item by ID
  getItem(id) {
    return this.items.find(i => i.id === id);
  }

  // Get children of an item
  getChildren(parentId) {
    return this.items.filter(i => i.parent_id === parentId);
  }

  // Get progress stats
  getProgress() {
    const total = this.items.length;
    const completed = this.items.filter(i => i.completed).length;
    return { total, completed, percent: total > 0 ? Math.round((completed / total) * 100) : 0 };
  }
}

// Global instance
window.todoTree = new TodoTree();
