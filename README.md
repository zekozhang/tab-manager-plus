# Tab Manager Plus

A Chrome extension that automatically groups your browser tabs — by domain, second-level domain, or your own custom rules.

[Chrome Web Store](https://chrome.google.com/webstore/detail/auto-group-tabs/mnolhkkapjcaekdgopmfolekecfhgoob) | [中文说明](#中文说明)

---

## Quick Start

- **Open sidebar**: Click the extension icon to open the side panel. You’ll see all tab groups and ungrouped tabs.
- **Settings**: Click the gear icon in the sidebar header, or right‑click the extension icon → **Options**.
- **Group all tabs now**: Use the refresh icon in the sidebar header, or press **Alt+G** (Windows/Linux) / **Option+G** (Mac).

---

## Features

### Auto Grouping
- Automatically groups tabs when they are opened or when a tab’s URL changes.
- Three grouping strategies: **Domain**, **Second-Level Domain**, and **Custom**.
- Set a minimum number of tabs required before a group is created.

### Custom Rules
- Define grouping rules with domain patterns and wildcard (`*`) support.
- Fallback for tabs that don’t match any rule: group by domain, by second-level domain, or leave ungrouped.
- **Quick rule creation**: From the sidebar, add a tab to a group; a matching rule is created (by full URL, domain, or second-level domain — configurable in Settings).

### Sidebar
- View all tab groups and ungrouped tabs in the side panel.
- **Header**: Switch between “Groups” view and **Workspaces**, trigger “Group all tabs”, and open Settings.
- Collapse/expand groups; close a single tab or a whole group.
- Move tabs between groups; add or remove tabs from workspaces.
- **Resize** the panel (drag the left edge) and **pin** it so it stays open when switching tabs.

### Workspaces
- Create named workspaces and set how tabs match: **Full URL**, **Domain** (root domain, e.g. `atlassian.net`), or **Second-Level Domain**.
- Add rules (patterns) per workspace; only tabs matching those rules appear when the workspace is selected.
- Switch workspaces from the chips in the sidebar header to filter tabs by context.
- In **Settings → Workspaces**: sort workspaces by name (A–Z / Z–A) or drag cards to reorder.

### Configuration
- **Export/import** full configuration (rules, workspaces, settings) as JSON.
- **Sort groups by name** (Settings → Grouping).
- **Keyboard shortcut**: `Alt+G` / `Option+G` to group all tabs in the current window.
- **UI**: English and Chinese.

---

## Build

**Requirements**: Node.js and npm.

```bash
npm install
npm run build
```

Load the unpacked extension: open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and select the `build/` folder.

---

## Development

- Run the options/settings page in dev mode: `npm start` (opens the React dev server; use the extension’s Options page for the full flow).
- The extension uses Chrome’s **Side Panel** (MV3) and requires a recent Chrome version that supports it.

---

## License

MIT

---

<a id="中文说明"></a>

# Tab Manager Plus（中文说明）

一款 Chrome 扩展，自动将浏览器标签页分组 —— 支持按域名、二级域名或自定义规则分组。

[Chrome 应用商店](https://chrome.google.com/webstore/detail/auto-group-tabs/mnolhkkapjcaekdgopmfolekecfhgoob)

---

## 快速开始

- **打开侧边栏**：点击扩展图标即可打开侧边面板，查看全部分组和未分组标签页。
- **设置**：点击侧边栏顶部的齿轮图标，或右键扩展图标 → **选项**。
- **立即分组**：点击侧边栏顶部的刷新图标，或按 **Alt+G**（Windows/Linux）/ **Option+G**（Mac）。

---

## 功能介绍

### 自动分组
- 新打开标签页或标签页地址变化时自动分组。
- 三种分组策略：**域名**、**二级域名**、**自定义规则**。
- 可设置每组最少标签页数量。

### 自定义规则
- 通过域名模式和通配符（`*`）定义分组规则。
- 未匹配规则的标签页可按域名、二级域名归组，或不分组。
- **快速建规则**：在侧边栏中将标签页加入某分组即可生成匹配规则（按完整 URL、域名或二级域名，可在设置中配置）。

### 侧边栏
- 在侧边面板中查看所有分组和未分组标签页。
- **顶部栏**：在「分组」视图与**工作区**之间切换、一键分组、打开设置。
- 折叠/展开分组，关闭单个标签页或整个分组。
- 在分组间移动标签页，将标签页加入或移出工作区。
- 可**拖拽左侧边缘调整**面板宽度，并可**固定**侧边栏，切换标签页时保持打开。

### 工作区
- 创建命名工作区，并设置匹配方式：**完整 URL**、**域名**（根域名，如 `atlassian.net`）、**二级域名**。
- 为每个工作区添加规则（匹配模式），只有匹配的标签页会在该工作区下显示。
- 在侧边栏顶部的芯片中切换工作区，按场景筛选标签页。
- 在**设置 → 工作区**中：可按名称排序（A–Z / Z–A），或拖拽卡片调整顺序。

### 配置管理
- **导出/导入**完整配置（规则、工作区、设置），JSON 格式。
- **按名称排序分组**（设置 → 分组）。
- **快捷键**：`Alt+G` / `Option+G` 对当前窗口所有标签页立即分组。
- **界面**：支持中文与英文。

---

## 构建

**环境要求**：已安装 Node.js 和 npm。

```bash
npm install
npm run build
```

在 `chrome://extensions` 中开启开发者模式，点击「加载已解压的扩展程序」，选择生成的 `build/` 目录即可。

---

## 开发

- 本地运行选项页：`npm start`（会启动 React 开发服务器；完整流程需在扩展的选项页中操作）。
- 本扩展使用 Chrome **侧边栏（Side Panel）**（MV3），需使用支持该功能的 Chrome 版本。

---

## 许可证

MIT
