# Operable Code And Image Workbench Showcase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the showcase so the code workbench and image workbench feel like operable tools with convincing fake interactions instead of dashboard-style overview pages.

**Architecture:** Keep all work inside `showcase/` using static HTML, shared CSS, and page-local ES modules. Use one shared helper module for repeated markup patterns, then rebuild the launcher, code workbench, and image workbench around a tool-first studio shell with lightweight stateful fake interactions.

**Tech Stack:** Static HTML, vanilla JS ES modules, shared CSS, Node.js `node:test`, `node --check`

---

## File Structure

### Existing files to modify

- `showcase/index.html`
  - Keep as a lightweight launcher and update card descriptions to match operable workbench positioning.
- `showcase/workspaces.html`
  - Rebuild as a launchpad into the two tool surfaces instead of a dashboard overview.
- `showcase/workspaces.js`
  - Replace dashboard data/rendering with launcher-specific data and interactions.
- `showcase/code-workbench.html`
  - Replace the current summary-panel version with a true IDE-style shell.
- `showcase/code-workbench.js`
  - Drive file switching, preview switching, terminal state, and AI panel state.
- `showcase/image-workbench.html`
  - Replace the current summary-panel version with a canvas-first shell.
- `showcase/image-workbench.js`
  - Drive layer selection, template switching, AI tool state, and export queue state.
- `showcase/styles.css`
  - Add the operable workbench layout system, editor/canvas surfaces, and state styles.
- `showcase/workbench-shared.js`
  - Keep only shared markup helpers that still make sense for the operable direction.
- `showcase/workbench-render.test.mjs`
  - Update tests so they validate the surviving shared helpers and new launcher content.

### Existing files to preserve as-is

- `showcase/showcase.js`
  - Leave untouched unless a tiny shared utility is clearly needed.
- `showcase/package.json`
  - Keep for ESM support inside `showcase/`.

## Task 1: Reframe Shared Helpers For The Operable Direction

**Files:**
- Modify: `showcase/workbench-shared.js`
- Modify: `showcase/workbench-render.test.mjs`

- [ ] **Step 1: Rewrite the shared-helper test file around launcher and operable-surface primitives**

Replace `showcase/workbench-render.test.mjs` with:

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  renderLauncherCards,
  renderStatusTabs,
  renderActionButtons,
} from "./workbench-shared.js";

test("renderLauncherCards outputs launch targets for code and image workbenches", () => {
  const html = renderLauncherCards([
    {
      title: "代码工作台",
      description: "进入带编辑器、终端和 AI 的开发界面",
      href: "./code-workbench.html",
      chips: ["Editor", "Terminal", "Agent"],
    },
  ]);

  assert.match(html, /代码工作台/);
  assert.match(html, /code-workbench\.html/);
  assert.match(html, /Editor/);
  assert.match(html, /launcher-card/);
});

test("renderStatusTabs marks the active tab", () => {
  const html = renderStatusTabs([
    { id: "editor", label: "Button.tsx", active: true },
    { id: "preview", label: "Preview", active: false },
  ]);

  assert.match(html, /Button\.tsx/);
  assert.match(html, /is-active/);
  assert.match(html, /Preview/);
});

test("renderActionButtons outputs tool actions", () => {
  const html = renderActionButtons([
    { label: "Run", tone: "primary" },
    { label: "Fix with AI", tone: "ghost" },
  ]);

  assert.match(html, /Run/);
  assert.match(html, /Fix with AI/);
  assert.match(html, /tool-button/);
});
```

- [ ] **Step 2: Run the test file to verify it fails against the old helper API**

Run:

```bash
node --test showcase/workbench-render.test.mjs
```

Expected:

- FAIL because `renderLauncherCards`, `renderStatusTabs`, or `renderActionButtons` do not exist yet

- [ ] **Step 3: Rewrite the shared helper module for the new operable primitives**

Replace `showcase/workbench-shared.js` with:

```js
export function renderActionButtons(items) {
  return items
    .map(
      (item) => `
        <button class="tool-button tool-button--${item.tone ?? "ghost"}" type="button">
          ${item.label}
        </button>
      `
    )
    .join("");
}

export function renderStatusTabs(items) {
  return items
    .map(
      (item) => `
        <button class="status-tab ${item.active ? "is-active" : ""}" type="button" data-tab-id="${item.id}">
          ${item.label}
        </button>
      `
    )
    .join("");
}

export function renderLauncherCards(items) {
  return items
    .map(
      (item) => `
        <a class="launcher-card" href="${item.href}">
          <div class="launcher-card__head">
            <h3>${item.title}</h3>
            <span class="meta-pill">${item.kicker ?? "Open"}</span>
          </div>
          <p class="subtle">${item.description}</p>
          <div class="type-chips">
            ${item.chips.map((chip) => `<span class="type-chip">${chip}</span>`).join("")}
          </div>
        </a>
      `
    )
    .join("");
}
```

- [ ] **Step 4: Run the shared-helper tests to verify they pass**

Run:

```bash
node --test showcase/workbench-render.test.mjs
```

Expected:

- PASS with 3 passing subtests

- [ ] **Step 5: Run syntax verification for the helper module**

Run:

```bash
node --check showcase/workbench-shared.js
```

Expected:

- no output
- exit code 0

- [ ] **Step 6: Commit the shared-helper reset**

```bash
git add showcase/workbench-shared.js showcase/workbench-render.test.mjs
git commit -m "feat: reset showcase helpers for operable workbenches"
```

## Task 2: Rebuild The Workbench Launcher Page

**Files:**
- Modify: `showcase/index.html`
- Modify: `showcase/workspaces.html`
- Modify: `showcase/workspaces.js`
- Modify: `showcase/styles.css`
- Depends on: `showcase/workbench-shared.js`

- [ ] **Step 1: Add a failing helper test for image-workbench launcher content**

Append to `showcase/workbench-render.test.mjs`:

```js
test("renderLauncherCards supports image-workbench launch copy", () => {
  const html = renderLauncherCards([
    {
      title: "图片工作台",
      description: "进入带画布、图层、AI 工具和导出队列的编辑界面",
      href: "./image-workbench.html",
      chips: ["Canvas", "Layers", "Export"],
    },
  ]);

  assert.match(html, /图片工作台/);
  assert.match(html, /image-workbench\.html/);
  assert.match(html, /Canvas/);
});
```

- [ ] **Step 2: Run the helper tests to verify the new launcher expectation**

Run:

```bash
node --test showcase/workbench-render.test.mjs
```

Expected:

- PASS if the helper already supports the data shape
- continue with page wiring as the real implementation work

- [ ] **Step 3: Rewrite the showcase index card copy to match the new direction**

Update the relevant section in `showcase/index.html` to:

```html
<section class="gallery-grid">
  <a class="gallery-card" href="./home.html">
    <p class="eyebrow">01</p>
    <h2>首页概览</h2>
    <p>天气驱动背景、日程摘要、工作区入口、概览入口。</p>
  </a>
  <a class="gallery-card" href="./workspaces.html">
    <p class="eyebrow">02</p>
    <h2>智能工作台入口</h2>
    <p>从 Daily 入口进入代码工作台或图片工作台。</p>
  </a>
  <a class="gallery-card" href="./code-workbench.html">
    <p class="eyebrow">03</p>
    <h2>代码工作台</h2>
    <p>带文件树、编辑器、终端、预览和 AI 任务流的开发界面。</p>
  </a>
  <a class="gallery-card" href="./image-workbench.html">
    <p class="eyebrow">04</p>
    <h2>图片工作台</h2>
    <p>带画布、图层、模板、AI 工具和批量导出的编辑界面。</p>
  </a>
  <a class="gallery-card" href="./schedule.html">
    <p class="eyebrow">05</p>
    <h2>日程总览</h2>
    <p>日 / 周安排、冲突识别、来源过滤、重点时段。</p>
  </a>
  <a class="gallery-card" href="./integrations.html">
    <p class="eyebrow">06</p>
    <h2>集成设置</h2>
    <p>邮箱、日历、天气接入状态、同步策略与权限说明。</p>
  </a>
</section>
```

- [ ] **Step 4: Replace `showcase/workspaces.html` with a launchpad-style page**

Replace the `<main>` and nav section with:

```html
<header class="page-topbar">
  <a class="brand-inline" href="./index.html">
    <span class="brand-badge">D</span>
    <span>Daily Showcase</span>
  </a>
  <nav class="page-nav">
    <a class="nav-link" href="./home.html">首页</a>
    <a class="nav-link active" href="./workspaces.html">工作台入口</a>
    <a class="nav-link" href="./code-workbench.html">代码工作台</a>
    <a class="nav-link" href="./image-workbench.html">图片工作台</a>
  </nav>
</header>

<main class="launcher-layout">
  <section class="panel launcher-hero">
    <p class="eyebrow">Daily Launchpad</p>
    <h1>从 Daily 进入专业工作台</h1>
    <p class="lead">Daily 根据当前任务、来源和时间段，把你带到最合适的工作台，而不是只给你一块看板。</p>
    <div class="launcher-meta-strip" id="launcher-meta-strip"></div>
  </section>

  <section class="panel launcher-surface-panel">
    <div class="panel-head">
      <div>
        <p class="eyebrow">Workbench Surfaces</p>
        <h2>选择工作台</h2>
      </div>
    </div>
    <div class="launcher-grid" id="launcher-grid"></div>
  </section>

  <section class="panel launcher-routing-panel">
    <p class="eyebrow">Routing Reason</p>
    <h2>为什么 Daily 推荐你来这里</h2>
    <div class="mini-list" id="launcher-reasons"></div>
  </section>
</main>
```

Keep the script tags as:

```html
<script src="./showcase.js"></script>
<script type="module" src="./workspaces.js"></script>
```

- [ ] **Step 5: Replace `showcase/workspaces.js` with launchpad-specific rendering**

Replace the file with:

```js
import { renderLauncherCards } from "./workbench-shared.js";

const meta = [
  ["当前焦点", "代码修复 + Hero Banner 导出"],
  ["活跃来源", "Git, Calendar, Assets, Feedback"],
  ["时间压力", "16:30 review / 18:30 确认截止"],
];

const launchers = [
  {
    title: "代码工作台",
    description: "进入带编辑器、终端、预览和 AI agent 的开发界面。",
    href: "./code-workbench.html",
    kicker: "Open IDE",
    chips: ["Editor", "Terminal", "Preview", "Agent"],
  },
  {
    title: "图片工作台",
    description: "进入带画布、图层、模板、AI 工具和导出队列的编辑界面。",
    href: "./image-workbench.html",
    kicker: "Open Canvas",
    chips: ["Canvas", "Layers", "Template", "Export"],
  },
];

const reasons = [
  ["代码工作台", "你当前有一个待修复回归、一个待 review PR，以及 16:30 前的连续开发窗口。"],
  ["图片工作台", "你今天还有一批主视觉要在 18:30 前导出确认，当前反馈已收齐。"],
  ["Daily 的作用", "先判断你该进入哪种工作面，再把上下文预装进那个界面。"],
];

document.getElementById("launcher-meta-strip").innerHTML = meta
  .map(
    ([title, value]) => `
      <article class="summary-stat">
        <span class="summary-stat__label">${title}</span>
        <strong class="summary-stat__value summary-stat__value--sm">${value}</strong>
      </article>
    `
  )
  .join("");

document.getElementById("launcher-grid").innerHTML = renderLauncherCards(launchers);

document.getElementById("launcher-reasons").innerHTML = reasons
  .map(
    ([title, text]) => `
      <article class="detail-row">
        <div>
          <strong>${title}</strong>
          <p class="subtle">${text}</p>
        </div>
      </article>
    `
  )
  .join("");
```

- [ ] **Step 6: Add the launcher layout styles**

Append to `showcase/styles.css`:

```css
.launcher-layout {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 18px;
}

.launcher-hero,
.launcher-surface-panel {
  grid-column: 1 / -1;
}

.launcher-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.launcher-card {
  display: grid;
  gap: 14px;
  padding: 22px;
  border-radius: 28px;
  border: 1px solid rgba(255, 255, 255, 0.72);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.82), rgba(255, 255, 255, 0.64)),
    radial-gradient(circle at top right, rgba(124, 173, 255, 0.12), transparent 24%);
  box-shadow: 0 18px 40px rgba(96, 112, 137, 0.14);
}

.launcher-card__head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: start;
}

.launcher-meta-strip {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.summary-stat__value--sm {
  font-size: 16px;
  line-height: 1.4;
}

@media (max-width: 1024px) {
  .launcher-layout,
  .launcher-grid,
  .launcher-meta-strip {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 7: Run the launcher verification commands**

Run:

```bash
node --test showcase/workbench-render.test.mjs
node --check showcase/workspaces.js showcase/workbench-shared.js
```

Expected:

- tests PASS
- no syntax output

- [ ] **Step 8: Commit the launcher page rebuild**

```bash
git add showcase/index.html showcase/workspaces.html showcase/workspaces.js showcase/styles.css showcase/workbench-shared.js showcase/workbench-render.test.mjs
git commit -m "feat: rebuild showcase launcher for operable workbenches"
```

## Task 3: Rebuild The Code Workbench As An Operable IDE Mock

**Files:**
- Modify: `showcase/code-workbench.html`
- Modify: `showcase/code-workbench.js`
- Modify: `showcase/styles.css`
- Modify: `showcase/workbench-render.test.mjs`
- Depends on: `showcase/workbench-shared.js`

- [ ] **Step 1: Add a failing helper test for code-surface tabs and actions**

Append to `showcase/workbench-render.test.mjs`:

```js
test("renderStatusTabs supports code editor and preview tab labels", () => {
  const html = renderStatusTabs([
    { id: "button", label: "Button.tsx", active: true },
    { id: "preview", label: "Preview", active: false },
    { id: "terminal", label: "Terminal", active: false },
  ]);

  assert.match(html, /Button\.tsx/);
  assert.match(html, /Preview/);
  assert.match(html, /Terminal/);
});
```

- [ ] **Step 2: Run tests to verify the new code-surface expectation**

Run:

```bash
node --test showcase/workbench-render.test.mjs
```

Expected:

- PASS if helper already supports the shape
- continue with full page rebuild

- [ ] **Step 3: Replace `showcase/code-workbench.html` with the operable IDE shell**

Replace the body content with:

```html
<body class="theme-neutral theme-workbench-code">
  <div class="page-frame workbench-frame">
    <header class="page-topbar">
      <a class="brand-inline" href="./index.html">
        <span class="brand-badge">D</span>
        <span>Daily Showcase</span>
      </a>
      <nav class="page-nav">
        <a class="nav-link" href="./workspaces.html">工作台入口</a>
        <a class="nav-link active" href="./code-workbench.html">代码工作台</a>
        <a class="nav-link" href="./image-workbench.html">图片工作台</a>
      </nav>
    </header>

    <main class="studio-layout studio-layout--code">
      <aside class="panel studio-sidebar">
        <div class="studio-sidebar__section">
          <p class="eyebrow">Workspace</p>
          <h2>设计系统升级</h2>
          <div id="code-file-tree"></div>
        </div>
      </aside>

      <section class="panel studio-main">
        <div class="studio-toolbar">
          <div id="code-surface-tabs"></div>
          <div class="action-row" id="code-toolbar-actions"></div>
        </div>
        <div class="studio-main-grid">
          <section class="editor-surface">
            <div class="editor-surface__header" id="code-editor-header"></div>
            <pre class="editor-surface__body" id="code-editor-body"></pre>
          </section>
          <section class="preview-surface" id="code-preview-surface"></section>
        </div>
        <div class="output-strip">
          <section class="output-panel" id="code-terminal-panel"></section>
          <section class="output-panel" id="code-log-panel"></section>
        </div>
      </section>

      <aside class="panel studio-inspector">
        <p class="eyebrow">AI / Inspector</p>
        <div class="stack" id="code-inspector"></div>
      </aside>
    </main>
  </div>
  <script type="module" src="./code-workbench.js"></script>
</body>
```

- [ ] **Step 4: Replace `showcase/code-workbench.js` with stateful fake IDE interactions**

Replace the file with:

```js
import {
  renderActionButtons,
  renderStatusTabs,
} from "./workbench-shared.js";

const files = [
  {
    id: "button",
    label: "Button.tsx",
    path: "src/components/Button.tsx",
    header: "Button.tsx · modified · PR #214",
    body: `01 export function Button({ tone = "primary" }) {\n02   const radius = tokens.button.radius.md;\n03   const hoverTone = tone === "primary" ? "primaryHover" : "neutralHover";\n04\n05   return (\n06     <button className={button({ tone, radius, hoverTone })}>\n07       Continue\n08     </button>\n09   );\n10 }`,
    previewTitle: "Component Preview",
    previewBody: "Primary button preview with hover radius fix and token diff summary.",
    terminal: "pnpm test Button --watch\nPASS button-radius.spec.ts\nPASS hover-token.spec.ts",
    logs: "AI note: token hover mismatch traced to md radius alias.",
    inspector: [
      ["Agent 任务", "建议先应用 hover token 修复，再运行按钮预览。"],
      ["选中代码解释", "当前选中的是按钮 hover 状态和半径 token 的关系。"],
      ["建议动作", "Apply patch / Re-run tests / Open related PR comment"],
    ],
  },
  {
    id: "tokens",
    label: "token-map.ts",
    path: "src/tokens/token-map.ts",
    header: "token-map.ts · focus · ISSUE-82",
    body: `01 export const buttonTokenMap = {\n02   radius: {\n03     sm: "radius-8",\n04     md: "radius-12",\n05     lg: "radius-16",\n06   },\n07   hover: {\n08     primary: "blue-600",\n09     neutral: "slate-300",\n10   },\n11 };`,
    previewTitle: "Token Diff",
    previewBody: "Comparing current radius aliases against the design token review proposal.",
    terminal: "pnpm lint tokens\n0 errors · 0 warnings",
    logs: "Related review: confirm whether radius-12 should remain md.",
    inspector: [
      ["Agent 任务", "生成 token diff 摘要并准备 16:30 review 讨论点。"],
      ["选中代码解释", "这里是按钮半径与 hover 色彩的语义映射。"],
      ["建议动作", "Draft summary / Compare branch / Copy meeting notes"],
    ],
  },
  {
    id: "readme",
    label: "README.md",
    path: "docs/button-guidelines/README.md",
    header: "README.md · docs · preview",
    body: `# Button Guidelines\n\n- Use radius token aliases instead of raw values.\n- Keep hover contrast above the accessibility threshold.\n- Document changes before merging component API updates.`,
    previewTitle: "Doc Preview",
    previewBody: "Rendered markdown preview for the updated button guidelines.",
    terminal: "No active command.\nReady to run docs preview.",
    logs: "Suggested follow-up: add a note about exportable component snapshots.",
    inspector: [
      ["Agent 任务", "把本次修复写进组件指南，减少后续回归。"],
      ["选中代码解释", "这是给 review 和未来维护者看的变更说明。"],
      ["建议动作", "Open markdown preview / Insert checklist / Link PR"],
    ],
  },
];

let activeFileId = "button";

function getActiveFile() {
  return files.find((file) => file.id === activeFileId) ?? files[0];
}

function renderFileTree() {
  return files
    .map(
      (file) => `
        <button class="tree-item ${file.id === activeFileId ? "is-active" : ""}" type="button" data-file-id="${file.id}">
          <span>${file.label}</span>
          <span class="tree-item__path">${file.path}</span>
        </button>
      `
    )
    .join("");
}

function renderInspector(items) {
  return items
    .map(
      ([title, text]) => `
        <article class="inspector-card">
          <strong>${title}</strong>
          <p class="subtle">${text}</p>
        </article>
      `
    )
    .join("");
}

function paint() {
  const active = getActiveFile();

  document.getElementById("code-file-tree").innerHTML = renderFileTree();
  document.getElementById("code-surface-tabs").innerHTML = renderStatusTabs([
    { id: "editor", label: active.label, active: true },
    { id: "preview", label: active.previewTitle, active: false },
    { id: "terminal", label: "Terminal", active: false },
  ]);
  document.getElementById("code-toolbar-actions").innerHTML = renderActionButtons([
    { label: "Run", tone: "primary" },
    { label: "Fix with AI", tone: "ghost" },
    { label: "Preview", tone: "ghost" },
  ]);
  document.getElementById("code-editor-header").textContent = active.header;
  document.getElementById("code-editor-body").textContent = active.body;
  document.getElementById("code-preview-surface").innerHTML = `
    <p class="eyebrow">${active.previewTitle}</p>
    <div class="preview-surface__card">${active.previewBody}</div>
  `;
  document.getElementById("code-terminal-panel").innerHTML = `
    <p class="eyebrow">Terminal</p>
    <pre>${active.terminal}</pre>
  `;
  document.getElementById("code-log-panel").innerHTML = `
    <p class="eyebrow">Runtime / Notes</p>
    <pre>${active.logs}</pre>
  `;
  document.getElementById("code-inspector").innerHTML = renderInspector(active.inspector);

  document.querySelectorAll("[data-file-id]").forEach((button) => {
    button.addEventListener("click", () => {
      activeFileId = button.dataset.fileId;
      paint();
    });
  });
}

paint();
```

- [ ] **Step 5: Add the IDE-shell styles**

Append to `showcase/styles.css`:

```css
.workbench-frame {
  width: min(100%, 1480px);
}

.studio-layout {
  display: grid;
  grid-template-columns: 240px 1fr 300px;
  gap: 16px;
}

.studio-main {
  display: grid;
  gap: 14px;
}

.studio-toolbar {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.status-tab,
.tree-item,
.tool-button {
  border: 0;
  cursor: pointer;
  font: inherit;
}

.status-tab {
  padding: 8px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.54);
}

.status-tab.is-active {
  background: rgba(116, 161, 255, 0.18);
  color: #355ac7;
}

.tool-button {
  padding: 9px 14px;
  border-radius: 999px;
}

.tool-button--primary {
  background: linear-gradient(180deg, #7d8cff, #6070f7);
  color: #fff;
}

.tool-button--ghost {
  background: rgba(255, 255, 255, 0.62);
}

.studio-main-grid {
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: 14px;
}

.editor-surface {
  border-radius: 24px;
  overflow: hidden;
  background: #1c2230;
  color: #cdd8ea;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.editor-surface__header {
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.04);
  font-size: 12px;
}

.editor-surface__body {
  margin: 0;
  padding: 18px;
  min-height: 340px;
  font-size: 12px;
  line-height: 1.75;
  white-space: pre-wrap;
}

.preview-surface__card,
.output-panel,
.inspector-card,
.studio-sidebar__section {
  padding: 16px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.58);
}

.output-strip {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.output-panel pre {
  margin: 8px 0 0;
  white-space: pre-wrap;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
}

.tree-item {
  display: grid;
  gap: 4px;
  width: 100%;
  text-align: left;
  padding: 12px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.5);
  margin-top: 10px;
}

.tree-item.is-active {
  background: rgba(116, 161, 255, 0.16);
}

.tree-item__path {
  color: var(--muted);
  font-size: 11px;
}
```

- [ ] **Step 6: Run the code-workbench verification commands**

Run:

```bash
node --test showcase/workbench-render.test.mjs
node --check showcase/code-workbench.js showcase/workbench-shared.js
```

Expected:

- tests PASS
- syntax check exits 0

- [ ] **Step 7: Commit the operable code workbench**

```bash
git add showcase/code-workbench.html showcase/code-workbench.js showcase/styles.css showcase/workbench-shared.js showcase/workbench-render.test.mjs
git commit -m "feat: rebuild code workbench as operable ide mock"
```

## Task 4: Rebuild The Image Workbench As A Canvas-First Editing Mock

**Files:**
- Modify: `showcase/image-workbench.html`
- Modify: `showcase/image-workbench.js`
- Modify: `showcase/styles.css`
- Modify: `showcase/workbench-render.test.mjs`
- Depends on: `showcase/workbench-shared.js`

- [ ] **Step 1: Add a failing helper test for image action buttons**

Append to `showcase/workbench-render.test.mjs`:

```js
test("renderActionButtons supports image editing actions", () => {
  const html = renderActionButtons([
    { label: "Remove BG", tone: "primary" },
    { label: "Batch Export", tone: "ghost" },
  ]);

  assert.match(html, /Remove BG/);
  assert.match(html, /Batch Export/);
});
```

- [ ] **Step 2: Run tests to verify the new image-surface expectation**

Run:

```bash
node --test showcase/workbench-render.test.mjs
```

Expected:

- PASS if helper already supports the shape
- continue with the page rebuild

- [ ] **Step 3: Replace `showcase/image-workbench.html` with the operable canvas shell**

Replace the body content with:

```html
<body class="theme-neutral theme-workbench-image">
  <div class="page-frame workbench-frame">
    <header class="page-topbar">
      <a class="brand-inline" href="./index.html">
        <span class="brand-badge">D</span>
        <span>Daily Showcase</span>
      </a>
      <nav class="page-nav">
        <a class="nav-link" href="./workspaces.html">工作台入口</a>
        <a class="nav-link" href="./code-workbench.html">代码工作台</a>
        <a class="nav-link active" href="./image-workbench.html">图片工作台</a>
      </nav>
    </header>

    <main class="studio-layout studio-layout--image">
      <aside class="panel studio-sidebar">
        <div class="studio-sidebar__section">
          <p class="eyebrow">Assets / Layers</p>
          <h2>Campaign Export Batch</h2>
          <div id="image-layer-list"></div>
        </div>
      </aside>

      <section class="panel studio-main">
        <div class="studio-toolbar">
          <div id="image-surface-tabs"></div>
          <div class="action-row" id="image-toolbar-actions"></div>
        </div>
        <div class="studio-main-grid studio-main-grid--image">
          <section class="canvas-surface" id="image-canvas-surface"></section>
          <section class="template-surface" id="image-template-surface"></section>
        </div>
        <div class="output-strip">
          <section class="output-panel" id="image-history-panel"></section>
          <section class="output-panel" id="image-export-panel"></section>
        </div>
      </section>

      <aside class="panel studio-inspector">
        <p class="eyebrow">AI / Inspector</p>
        <div class="stack" id="image-inspector"></div>
      </aside>
    </main>
  </div>
  <script type="module" src="./image-workbench.js"></script>
</body>
```

- [ ] **Step 4: Replace `showcase/image-workbench.js` with stateful fake image interactions**

Replace the file with:

```js
import {
  renderActionButtons,
  renderStatusTabs,
} from "./workbench-shared.js";

const layers = [
  {
    id: "hero",
    label: "Hero Banner",
    meta: "main visual · selected",
    canvasTitle: "Hero Banner Variant A",
    canvasBody: "Warm gradient hero with centered product lockup and highlighted CTA zone.",
    templateBody: "Template set: Hero / Social / Thumbnail linked to one source visual.",
    history: "Round 03 comments merged\nColor temp adjusted\nCTA safe area expanded",
    export: "Pending: WebP 1440, PNG 1080, Thumb 640",
    inspector: [
      ["AI 工具", "Remove BG / Expand Fill / Magic Erase / Style Shift"],
      ["选区属性", "当前选中主视觉图层，建议先微调色温和标题安全区。"],
      ["导出建议", "先导出 Hero Banner，再联动生成社媒缩略图。"],
    ],
  },
  {
    id: "kv",
    label: "Launch KV",
    meta: "wide crop",
    canvasTitle: "Launch KV Wide",
    canvasBody: "Wide-format campaign key visual with right-aligned text frame and softer background blur.",
    templateBody: "Template preset emphasizes horizontal crops and shared typography tokens.",
    history: "Contrast boosted\nBackground blur reduced\nClient note: logo can move up 12px",
    export: "Pending: PNG 1920, JPG 1600",
    inspector: [
      ["AI 工具", "Object Select / Cleanup / Relight / Reframe"],
      ["选区属性", "当前重点是 logo 垂直位置和背景层级的清晰度。"],
      ["导出建议", "这张更适合作为第二批导出，不要先占用 Hero 队列。"],
    ],
  },
  {
    id: "thumb",
    label: "Thumbnail Pack",
    meta: "batch preset",
    canvasTitle: "Thumbnail Batch",
    canvasBody: "Compact thumbnail set intended for batch export after Hero and KV are locked.",
    templateBody: "Template preset emphasizes batch resize and shared safe-area cropping.",
    history: "Batch preset loaded\nAuto-crop prepared\nWaiting for final hero approval",
    export: "Queued: 6 thumbnails after hero confirmation",
    inspector: [
      ["AI 工具", "Auto Crop / Batch Resize / Background Simplify"],
      ["选区属性", "这里更依赖模板和导出，不需要过度精修。"],
      ["导出建议", "等主视觉确认后统一批量导出最省时间。"],
    ],
  },
];

let activeLayerId = "hero";

function getActiveLayer() {
  return layers.find((layer) => layer.id === activeLayerId) ?? layers[0];
}

function renderLayerList() {
  return layers
    .map(
      (layer) => `
        <button class="tree-item ${layer.id === activeLayerId ? "is-active" : ""}" type="button" data-layer-id="${layer.id}">
          <span>${layer.label}</span>
          <span class="tree-item__path">${layer.meta}</span>
        </button>
      `
    )
    .join("");
}

function renderInspector(items) {
  return items
    .map(
      ([title, text]) => `
        <article class="inspector-card inspector-card--image">
          <strong>${title}</strong>
          <p class="subtle">${text}</p>
        </article>
      `
    )
    .join("");
}

function paint() {
  const active = getActiveLayer();

  document.getElementById("image-layer-list").innerHTML = renderLayerList();
  document.getElementById("image-surface-tabs").innerHTML = renderStatusTabs([
    { id: "canvas", label: active.label, active: true },
    { id: "variant", label: "Template", active: false },
    { id: "export", label: "Export", active: false },
  ]);
  document.getElementById("image-toolbar-actions").innerHTML = renderActionButtons([
    { label: "Remove BG", tone: "primary" },
    { label: "Magic Erase", tone: "ghost" },
    { label: "Batch Export", tone: "ghost" },
  ]);
  document.getElementById("image-canvas-surface").innerHTML = `
    <p class="eyebrow">${active.canvasTitle}</p>
    <div class="canvas-surface__stage">
      <div class="canvas-artboard">${active.canvasBody}</div>
    </div>
  `;
  document.getElementById("image-template-surface").innerHTML = `
    <p class="eyebrow">Template / Batch</p>
    <div class="preview-surface__card">${active.templateBody}</div>
  `;
  document.getElementById("image-history-panel").innerHTML = `
    <p class="eyebrow">History / Version</p>
    <pre>${active.history}</pre>
  `;
  document.getElementById("image-export-panel").innerHTML = `
    <p class="eyebrow">Export Queue</p>
    <pre>${active.export}</pre>
  `;
  document.getElementById("image-inspector").innerHTML = renderInspector(active.inspector);

  document.querySelectorAll("[data-layer-id]").forEach((button) => {
    button.addEventListener("click", () => {
      activeLayerId = button.dataset.layerId;
      paint();
    });
  });
}

paint();
```

- [ ] **Step 5: Add the image-surface styles**

Append to `showcase/styles.css`:

```css
.studio-main-grid--image {
  grid-template-columns: 1fr 240px;
}

.canvas-surface,
.template-surface {
  padding: 16px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.58);
}

.canvas-surface__stage {
  display: grid;
  place-items: center;
  min-height: 340px;
  border-radius: 20px;
  background: linear-gradient(180deg, rgba(255, 248, 242, 0.98), rgba(244, 226, 210, 0.92));
}

.canvas-artboard {
  width: min(100%, 440px);
  min-height: 220px;
  padding: 24px;
  border-radius: 24px;
  background: linear-gradient(135deg, #ffdcc7, #ffd6e2 52%, #f4c9a5);
  box-shadow: 0 18px 42px rgba(150, 103, 72, 0.2);
  color: #5c3c26;
  font-weight: 700;
  display: grid;
  place-items: center;
  text-align: center;
}

.inspector-card--image {
  background: rgba(255, 245, 238, 0.8);
}
```

- [ ] **Step 6: Run the image-workbench verification commands**

Run:

```bash
node --test showcase/workbench-render.test.mjs
node --check showcase/image-workbench.js showcase/workbench-shared.js
```

Expected:

- tests PASS
- syntax check exits 0

- [ ] **Step 7: Commit the operable image workbench**

```bash
git add showcase/image-workbench.html showcase/image-workbench.js showcase/styles.css showcase/workbench-shared.js showcase/workbench-render.test.mjs
git commit -m "feat: rebuild image workbench as canvas editing mock"
```

## Task 5: Verify The Full Operable Showcase

**Files:**
- Modify if needed: `showcase/index.html`
- Modify if needed: `showcase/workspaces.html`
- Modify if needed: `showcase/workspaces.js`
- Modify if needed: `showcase/code-workbench.html`
- Modify if needed: `showcase/code-workbench.js`
- Modify if needed: `showcase/image-workbench.html`
- Modify if needed: `showcase/image-workbench.js`
- Modify if needed: `showcase/styles.css`

- [ ] **Step 1: Run the complete automated verification**

Run:

```bash
node --test showcase/workbench-render.test.mjs
node --check showcase/workbench-shared.js showcase/workspaces.js showcase/code-workbench.js showcase/image-workbench.js
```

Expected:

- all tests PASS
- all syntax checks exit 0

- [ ] **Step 2: Serve the showcase locally for manual verification**

Run:

```bash
python3 -m http.server 4173 --directory showcase
```

Expected:

- terminal prints `Serving HTTP on`

- [ ] **Step 3: Verify the key pages manually**

Check:

```md
- [ ] /index.html loads
- [ ] /workspaces.html reads as a launchpad, not a dashboard
- [ ] /code-workbench.html reads as an IDE-like surface
- [ ] /image-workbench.html reads as a canvas-first editing surface
- [ ] clicking file items changes the code workbench center surface
- [ ] clicking layer items changes the image workbench center surface
```

- [ ] **Step 4: Apply only the final polish fixes discovered during review**

Allowed polish:

```md
- spacing
- contrast
- text density
- responsive stacking
- selection-state visibility
```

Do not add new modules at this stage.

- [ ] **Step 5: Commit the final polish**

```bash
git add showcase/index.html showcase/workspaces.html showcase/workspaces.js showcase/code-workbench.html showcase/code-workbench.js showcase/image-workbench.html showcase/image-workbench.js showcase/styles.css showcase/workbench-shared.js showcase/workbench-render.test.mjs
git commit -m "feat: finalize operable workbench showcase"
```
