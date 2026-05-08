<div align="center">

# TODO 提醒

一款轻量级桌面待办事项应用，基于 Tauri 构建，支持层级任务树、分类管理、优先级标记、截止日期提醒与系统通知。

![App Screenshot](../app.png)

</div>

---

## 功能特性

### 核心功能

- **层级任务树** — 支持无限嵌套的子任务结构，通过 Tab / Shift+Tab 轻松调整层级
- **分类管理** — 预设 工作 / 生活 / 学习 / 健康 / 其他 五大分类，彩色标签一目了然
- **优先级标记** — 高 / 中 / 低三档优先级，配合红 / 黄 / 紫色圆点直观展示
- **截止日期** — 内置可视化日历选择器，支持精确到分钟的时间设定
- **进度追踪** — 顶部进度条实时显示完成情况，如 `3/7 已完成`

### 交互体验

- **键盘优先** — 完整的键盘操作支持，无需鼠标即可高效管理任务
- **快速添加** — 底部输入框，回车即添加，极简操作流程
- **内联编辑** — 双击任意任务即可原地编辑，自动保存
- **平滑动画** — 新增 / 删除任务均带有流畅的过渡动画
- **筛选过滤** — 按分类、优先级快速筛选，一键隐藏已完成项

### 系统集成

- **系统托盘** — 关闭窗口后最小化至托盘，点击托盘图标即可唤回
- **到期提醒** — 任务到期时自动弹出系统通知，并将窗口置顶显示
- **开机自启** — Windows 下自动注册开机启动，不遗漏任何任务
- **解锁检测** — Windows 解锁屏幕后自动弹出待办提醒
- **数据持久化** — 本地 SQLite 存储，数据安全可靠

## 键盘快捷键

| 按键 | 操作 |
|------|------|
| `Enter` | 创建子任务 |
| `Tab` | 缩进（成为上一项的子任务） |
| `Shift + Tab` | 提升层级（移至父级） |
| `Delete` | 删除当前任务 |
| `Backspace` | 空任务按 Backspace 提升层级 / 非空时进入编辑 |
| `↑` `↓` | 在任务间导航 |
| `Escape` | 退出编辑 / 取消选中 |
| `Ctrl + N` | 聚焦快速添加框 |

## 技术栈

| 层 | 技术 |
|----|------|
| 框架 | [Tauri 2](https://v2.tauri.app/) |
| 后端 | Rust + rusqlite + chrono |
| 前端 | 原生 HTML / CSS / JavaScript（零依赖） |
| 存储 | SQLite（WAL 模式） |
| 通知 | tauri-plugin-notification |

## 项目结构

```
todo-app/
├── src/                        # 前端源码
│   ├── index.html              # 主页面
│   ├── styles/main.css         # 样式
│   └── js/
│       ├── app.js              # 主应用逻辑
│       ├── tree.js             # 层级树数据结构
│       ├── interactions.js     # 键盘与交互管理
│       └── dropdown.js         # 分类/优先级/日期选择器
├── src-tauri/                  # Rust 后端
│   ├── src/
│   │   ├── lib.rs              # Tauri 入口
│   │   ├── commands.rs         # IPC 命令
│   │   ├── db.rs               # SQLite 数据库
│   │   ├── models.rs           # 数据模型
│   │   ├── tray.rs             # 系统托盘
│   │   ├── reminder.rs         # 到期提醒线程
│   │   ├── session.rs          # Windows 解锁监听
│   │   └── autostart.rs        # 开机自启注册
│   ├── Cargo.toml
│   └── tauri.conf.json
├── package.json
└── README.md
```

## 快速开始

### 环境要求

- [Rust](https://rustup.rs/) (stable)
- [Node.js](https://nodejs.org/) >= 16
- [Tauri Prerequisites](https://v2.tauri.app/start/prerequisites/)

### 安装与运行

```bash
# 克隆仓库
git clone https://github.com/your-username/todo-app.git
cd todo-app

# 安装前端依赖
npm install

# 启动开发模式
npm run tauri dev

# 构建生产版本
npm run tauri build
```

### 浏览器预览

项目也支持直接在浏览器中运行（使用 localStorage 存储数据）：

```bash
# 启动开发服务器
npx serve src
```

## 构建产物

构建完成后，安装包位于：

```
src-tauri/target/release/bundle/nsis/
```

支持 Windows NSIS 安装包，安装时自动选择用户级安装（无需管理员权限）。

## License

MIT
