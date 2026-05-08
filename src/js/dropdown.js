// Category / Priority dropdown and Date picker

class DropdownManager {
  constructor() {
    this.dropdown = document.getElementById('tag-dropdown');
    this.datePicker = document.getElementById('date-picker');
    this.activeItemId = null;
    this.onChange = null;
    this.onSave = null;
  }

  init() {
    // Close dropdowns on outside click
    document.addEventListener('click', (e) => {
      if (!this.dropdown.contains(e.target) && !e.target.closest('.cat-tag, .pri-dot, .due-badge, .date-trigger')) {
        this._hideDropdown();
      }
      if (!this.datePicker.contains(e.target) && !e.target.closest('.due-badge, .date-trigger')) {
        this._hideDatePicker();
      }
    });

    // Calendar navigation
    this._calYear = new Date().getFullYear();
    this._calMonth = new Date().getMonth(); // 0-indexed
    this._calDay = null;
    this._calHour = 9;
    this._calMinute = 0;

    document.getElementById('cal-prev').addEventListener('click', () => {
      this._calMonth--;
      if (this._calMonth < 0) { this._calMonth = 11; this._calYear--; }
      this._renderCalendar();
    });
    document.getElementById('cal-next').addEventListener('click', () => {
      this._calMonth++;
      if (this._calMonth > 11) { this._calMonth = 0; this._calYear++; }
      this._renderCalendar();
    });

    // Date picker confirm
    document.getElementById('date-confirm').addEventListener('click', () => {
      if (this._calDay != null && this.activeItemId != null) {
        const d = new Date(this._calYear, this._calMonth, this._calDay, this._calHour, this._calMinute);
        const iso = d.toISOString();
        window.todoTree.updateItem(this.activeItemId, { due_date: iso });
        if (this.onSave) this.onSave(this.activeItemId, { due_date: iso });
        if (this.onChange) this.onChange();
      }
      this._hideDatePicker();
    });

    // Date picker clear
    document.getElementById('date-clear').addEventListener('click', () => {
      if (this.activeItemId != null) {
        window.todoTree.updateItem(this.activeItemId, { due_date: null });
        if (this.onSave) this.onSave(this.activeItemId, { due_date: null });
        if (this.onChange) this.onChange();
      }
      this._hideDatePicker();
    });
  }

  // === Category Dropdown ===
  showCategory(anchor, itemId) {
    this.activeItemId = itemId;
    const item = window.todoTree.getItem(itemId);
    const currentCat = item ? item.category : '默认';
    const categories = ['工作', '生活', '学习', '健康', '其他'];

    this.dropdown.innerHTML = categories.map(cat => `
      <div class="dropdown-item${cat === currentCat ? ' selected' : ''}" data-cat="${cat}">
        <span class="cat-tag cat-${cat}" style="font-size:11px;padding:2px 8px;border-radius:10px;">${cat}</span>
        ${cat === currentCat ? '<span style="margin-left:auto;color:var(--accent);">✓</span>' : ''}
      </div>
    `).join('');

    this.dropdown.querySelectorAll('.dropdown-item').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const cat = el.dataset.cat;
        window.todoTree.updateItem(itemId, { category: cat });
        if (this.onSave) this.onSave(itemId, { category: cat });
        if (this.onChange) this.onChange();
        this._hideDropdown();
      });
    });

    this._positionNear(this.dropdown, anchor);
  }

  // === Priority Dropdown ===
  showPriority(anchor, itemId) {
    this.activeItemId = itemId;
    const item = window.todoTree.getItem(itemId);
    const currentPri = item ? item.priority : 2;
    const priorities = [
      { value: 1, label: '高优先级', color: 'var(--red)' },
      { value: 2, label: '中优先级', color: 'var(--amber)' },
      { value: 3, label: '低优先级', color: 'var(--accent)' },
    ];

    this.dropdown.innerHTML = [
      '<div style="padding:4px 14px 6px;font-size:11px;color:var(--text-muted);">优先级</div>',
      ...priorities.map(p => `
        <div class="dropdown-item${p.value === currentPri ? ' selected' : ''}" data-pri="${p.value}">
          <span class="pri-dot pri-${p.value}" style="box-shadow:none;"></span>
          ${p.label}
          ${p.value === currentPri ? '<span style="margin-left:auto;color:var(--accent);">✓</span>' : ''}
        </div>
      `)
    ].join('');

    this.dropdown.querySelectorAll('.dropdown-item').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const pri = parseInt(el.dataset.pri);
        window.todoTree.updateItem(itemId, { priority: pri });
        if (this.onSave) this.onSave(itemId, { priority: pri });
        if (this.onChange) this.onChange();
        this._hideDropdown();
      });
    });

    this._positionNear(this.dropdown, anchor);
  }

  // === Date Picker ===
  showDatePickerUI(anchor, itemId) {
    this.activeItemId = itemId;
    const item = window.todoTree.getItem(itemId);

    // Parse existing date or use now
    if (item && item.due_date) {
      const d = new Date(item.due_date);
      this._calYear = d.getFullYear();
      this._calMonth = d.getMonth();
      this._calDay = d.getDate();
      this._calHour = d.getHours();
      this._calMinute = d.getMinutes();
    } else {
      const now = new Date();
      this._calYear = now.getFullYear();
      this._calMonth = now.getMonth();
      this._calDay = null;
      this._calHour = 9;
      this._calMinute = 0;
    }

    this._renderCalendar();
    this._positionNear(this.datePicker, anchor);
  }

  _renderCalendar() {
    // Update label
    const months = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
    document.getElementById('cal-label').textContent = `${this._calYear}年 ${months[this._calMonth]}`;

    // Update time inputs
    document.getElementById('cal-hour').value = this._calHour;
    document.getElementById('cal-minute').value = this._calMinute;

    // Time input listeners
    document.getElementById('cal-hour').onchange = (e) => { this._calHour = parseInt(e.target.value) || 0; };
    document.getElementById('cal-minute').onchange = (e) => { this._calMinute = parseInt(e.target.value) || 0; };

    // Render day grid
    const daysContainer = document.getElementById('cal-days');
    const firstDay = new Date(this._calYear, this._calMonth, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(this._calYear, this._calMonth + 1, 0).getDate();
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;

    let html = '';
    // Monday = 1, Sunday = 7. Convert from JS (0=Sun) to Mon-first
    let startDow = firstDay === 0 ? 6 : firstDay - 1; // Mon-based start
    for (let i = 0; i < startDow; i++) {
      html += '<span class="cal-day other-month"></span>';
    }

    for (let d = 1; d <= daysInMonth; d++) {
      let cls = 'cal-day';
      const dayDate = new Date(this._calYear, this._calMonth, d);
      const dayStr = `${dayDate.getFullYear()}-${dayDate.getMonth()}-${dayDate.getDate()}`;
      if (dayStr === todayStr) cls += ' today';
      if (d === this._calDay) cls += ' selected';
      const dow = dayDate.getDay();
      if (dow === 0 || dow === 6) cls += ' weekend';

      html += `<span class="${cls}" data-day="${d}">${d}</span>`;
    }

    daysContainer.innerHTML = html;

    // Day click handlers
    daysContainer.querySelectorAll('.cal-day:not(.other-month)').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this._calDay = parseInt(el.dataset.day);
        this._renderCalendar();
      });
    });
  }

  // === Helpers ===
  _positionNear(el, anchor) {
    // Temporarily make visible to measure dimensions
    el.classList.remove('hidden');
    el.style.opacity = '0';
    el.style.pointerEvents = 'none';

    const elRect = el.getBoundingClientRect();
    const elW = elRect.width;
    const elH = elRect.height;
    const anchorRect = anchor.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Prefer below anchor
    let top = anchorRect.bottom + 4;
    // If it would overflow bottom, try above anchor
    if (top + elH > vh - 8) {
      top = anchorRect.top - elH - 4;
    }
    // If still overflowing (very small window), center vertically
    if (top < 8) top = 8;
    if (top + elH > vh - 8) {
      top = Math.max(8, (vh - elH) / 2);
    }

    // Prefer aligned with anchor's left edge
    let left = anchorRect.left;
    // If it would overflow right, shift left
    if (left + elW > vw - 8) {
      left = vw - elW - 8;
    }
    if (left < 8) left = 8;

    el.style.top = top + 'px';
    el.style.left = left + 'px';
    el.style.opacity = '';
    el.style.pointerEvents = '';
  }

  _hideDropdown() {
    this.dropdown.classList.add('hidden');
    this.activeItemId = null;
  }

  _hideDatePicker() {
    this.datePicker.classList.add('hidden');
    this.activeItemId = null;
  }
}

window.dropdowns = new DropdownManager();

// Export global functions for interactions.js
window.showCategoryDropdown = (anchor, id) => window.dropdowns.showCategory(anchor, id);
window.showPriorityDropdown = (anchor, id) => window.dropdowns.showPriority(anchor, id);
window.showDatePicker = (anchor, id) => window.dropdowns.showDatePickerUI(anchor, id);
