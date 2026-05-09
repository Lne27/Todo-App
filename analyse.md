# TODO App 数据持久化根因分析

**分析日期**: 2026-05-09  
**Git 基准**: commit `59418f8`

## 实测验证

用户测试了两个场景，均失败：
1. 修改已有项（追加"111"）→ 关闭窗口 → 重新打开 → 修改丢失
2. 新增一项"111" → 关闭窗口 → 重新打开 → 新项丢失

## 根本原因

`src/js/app.js` 的 `_saveToBackend()` 方法中，**catch 分支缺失 localStorage 回退**。

```javascript
// 原始代码（有 bug）
async _saveToBackend(id, changes, isNew, isDelete) {
    if (this._invoke) {          // ← invoke 是 truthy（函数引用存在）
      try {
        await this._invoke(...); // ← 调用可能失败！
      } catch (err) {
        console.error(...);      // ← 只打 log，没有调用 _saveToLocalStorage()
      }
    } else {                     // ← 只有 invoke === null 才走这里
      this._saveToLocalStorage();
    }
}
```

### 故障链

```
1. 用户编辑 → _saveToBackend() 被调用
2. this._invoke 是 truthy（window.__TAURI_INTERNALS__?.invoke 返回了函数引用）
3. 进入 if 分支，尝试 invoke IPC
4. IPC 调用失败（Tauri 2 API 签名可能在 withGlobalTauri 模式下不匹配）
5. catch 只打 log → 数据丢失
6. tray-show 事件触发 → _loadData() → 从 localStorage/DB 加载旧数据
7. 旧数据覆盖已修改的内存数据 → 用户看到修改丢失
```

### 为什么 invoke 可能失败

即使设置了 `"withGlobalTauri": true`：
- `window.__TAURI_INTERNALS__` 始终存在（Tauri 内部 IPC 桥）
- `window.__TAURI_INTERNALS__.invoke` 是函数引用 → `_invoke` 为 truthy
- 但该函数可能需要特定的参数格式或返回 Promise 的方式不同
- 调用失败时异常被捕获但数据没有落入任何持久化存储

## 解决方案

### 策略：localStorage 作为安全网，DB 作为增强

```
每次保存：localStorage（毫秒级，同步）→ DB（异步，可能失败）
每次加载：DB（优先）→ localStorage（回退）→ demo 数据（兜底）
tray-show：localStorage（优先，保留本会话最新数据）
```

### 关键修改

```javascript
// 修复后：始终先存 localStorage
async _saveToBackend(id, changes, isNew, isDelete) {
    this._saveToLocalStorage();  // ← 第1层：毫秒级同步，永不失数据
    if (this._invoke) {
      try {
        await this._invoke(...);  // ← 第2层：异步 DB 增强
      } catch (err) {
        this._saveToLocalStorage();  // ← 第3层：DB 失败也再写一次
      }
    }
}
```

```javascript
// 修复后：load 分层
async _loadData(forceLocal) {
    if (!forceLocal && this._invoke) {
      try {
        const todos = await this._invoke('get_todos');
        if (todos && todos.length > 0) {
          this.tree.load(todos);
          this._saveToLocalStorage();  // DB → localStorage 同步
          return;
        }
      } catch (err) { /* fall through */ }
    }
    // forceLocal=true 或 DB失败 → 走 localStorage
    if (!this._loadFromLocalStorage()) {
      this._loadDemoData();  // 最终兜底
    }
}
```

### 修改的文件

| 文件 | 变更 |
|------|------|
| [tauri.conf.json](../src-tauri/tauri.conf.json) | 新增 `"withGlobalTauri": true` |
| [app.js](../src/js/app.js#L197) | `_saveToBackend`: 入口处和 catch 中都调用 `_saveToLocalStorage()` |
| [app.js](../src/js/app.js#L231) | `_loadData(forceLocal)`: 分层加载，forceLocal 模式用 localStorage |
| [app.js](../src/js/app.js#L276) | `_loadFromLocalStorage()`: 返回 boolean，demo 数据抽到 `_loadData` |
| [tray.rs](../src-tauri/src/tray.rs) | emit `tray-show` 事件 |
| [session.rs](../src-tauri/src/session.rs) | emit `tray-show` 事件 |
| [reminder.rs](../src-tauri/src/reminder.rs) | emit `tray-show` 事件 |
| [autostart.rs](../src-tauri/src/autostart.rs) | 单实例互斥体生命周期修复 |

## 验证方法

1. 构建安装包 `npx tauri build`
2. 打开 app，添加 3 条 todo
3. 关闭窗口（X → 托盘）→ 打开 → 列表应在
4. 修改内容 → 关闭窗口 → 打开 → 修改应在
5. 托盘"退出" → 重启 → 列表应在
6. 添加/修改 → 直接杀进程 → 重启 → 数据应在
