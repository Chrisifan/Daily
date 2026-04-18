# Code And Image Workbench Showcase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a showcase-only smart workbench prototype for Daily, including an upgraded workbench overview plus dedicated code and image workbench pages.

**Architecture:** Keep the implementation inside `showcase/` using static HTML, shared CSS, and small page-local JS files. Introduce one shared rendering helper module with pure string-returning functions so the most important showcase content can be verified with `node:test` before wiring it into the pages.

**Tech Stack:** Static HTML, vanilla JS, shared CSS, Node.js `node:test`, `node --check`

---

## File Structure

### Existing files to modify

- `showcase/index.html`
  - Add gallery cards for the code and image workbench experiences.
- `showcase/workspaces.html`
  - Reframe the page as the smart workbench overview surface.
- `showcase/workspaces.js`
  - Replace the current generic workspace demo data with overview-specific demo data and page rendering.
- `showcase/styles.css`
  - Add shared workbench layout, cards, rails, badges, and page-specific palette hooks.

### New files to create

- `showcase/workbench-shared.js`
  - Pure rendering helpers shared by overview, code, and image pages.
- `showcase/workbench-render.test.mjs`
  - `node:test` coverage for shared render helpers.
- `showcase/code-workbench.html`
  - Dedicated code workbench showcase page shell.
- `showcase/code-workbench.js`
  - Code-workbench-specific demo data and DOM rendering.
- `showcase/image-workbench.html`
  - Dedicated image workbench showcase page shell.
- `showcase/image-workbench.js`
  - Image-workbench-specific demo data and DOM rendering.

## Task 1: Add Shared Render Helpers And Failing Tests

**Files:**
- Create: `showcase/workbench-shared.js`
- Create: `showcase/workbench-render.test.mjs`

- [ ] **Step 1: Write the failing test file for shared workbench renderers**

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  renderSummaryStrip,
  renderWorkbenchCards,
  renderRecommendationList,
  renderTimelineList,
} from "./workbench-shared.js";

test("renderSummaryStrip outputs showcase stat cards", () => {
  const html = renderSummaryStrip([
    { value: "2", label: "活跃工作台" },
    { value: "5", label: "已同步来源" },
  ]);

  assert.match(html, /活跃工作台/);
  assert.match(html, /已同步来源/);
  assert.match(html, /summary-stat/);
});

test("renderWorkbenchCards outputs CTA links and linked sources", () => {
  const html = renderWorkbenchCards([
    {
      name: "设计系统升级",
      type: "代码工作台",
      focus: "修复 Token 回归",
      readiness: "74%",
      href: "./code-workbench.html",
      sources: ["PR", "Issue", "Calendar"],
    },
  ]);

  assert.match(html, /设计系统升级/);
  assert.match(html, /打开工作台/);
  assert.match(html, /code-workbench\.html/);
  assert.match(html, /Calendar/);
});

test("renderRecommendationList outputs recommendation actions", () => {
  const html = renderRecommendationList([
    {
      title: "先 review 设计令牌 PR",
      meta: "15:00 之前还有 42 分钟连续空档",
      actions: ["采纳", "稍后处理"],
    },
  ]);

  assert.match(html, /先 review 设计令牌 PR/);
  assert.match(html, /42 分钟连续空档/);
  assert.match(html, /采纳/);
});

test("renderTimelineList outputs schedule or deadline rows", () => {
  const html = renderTimelineList([
    {
      time: "15:00",
      title: "设计系统 sync",
      meta: "决定按钮半径和导出规范",
    },
  ]);

  assert.match(html, /15:00/);
  assert.match(html, /设计系统 sync/);
  assert.match(html, /timeline-row/);
});
```

- [ ] **Step 2: Run the new test file to verify it fails**

Run:

```bash
node --test showcase/workbench-render.test.mjs
```

Expected:

- FAIL with `Cannot find module` for `showcase/workbench-shared.js`

- [ ] **Step 3: Implement the shared renderer module with minimal pure functions**

```js
function renderActionChips(actions = []) {
  return actions
    .map((action) => `<button class="chip-button" type="button">${action}</button>`)
    .join("");
}

export function renderSummaryStrip(items) {
  return items
    .map(
      (item) => `
        <article class="summary-stat">
          <strong class="summary-stat__value">${item.value}</strong>
          <span class="summary-stat__label">${item.label}</span>
        </article>
      `
    )
    .join("");
}

export function renderWorkbenchCards(items) {
  return items
    .map(
      (item) => `
        <article class="workbench-card">
          <div class="workbench-card__top">
            <div>
              <p class="eyebrow">${item.type}</p>
              <h3>${item.name}</h3>
              <p class="subtle">${item.focus}</p>
            </div>
            <span class="meta-pill">${item.readiness}</span>
          </div>
          <div class="tag-row">
            ${item.sources.map((source) => `<span class="tag">${source}</span>`).join("")}
          </div>
          <a class="btn btn-ghost" href="${item.href}">打开工作台</a>
        </article>
      `
    )
    .join("");
}

export function renderRecommendationList(items) {
  return items
    .map(
      (item) => `
        <article class="recommendation-card">
          <div>
            <strong>${item.title}</strong>
            <p class="subtle">${item.meta}</p>
          </div>
          <div class="action-row">
            ${renderActionChips(item.actions)}
          </div>
        </article>
      `
    )
    .join("");
}

export function renderTimelineList(items) {
  return items
    .map(
      (item) => `
        <article class="timeline-row">
          <div class="timeline-main">
            <strong>${item.title}</strong>
            <p class="subtle">${item.meta}</p>
          </div>
          <span class="meta-pill">${item.time}</span>
        </article>
      `
    )
    .join("");
}
```

- [ ] **Step 4: Run the shared renderer tests to verify they pass**

Run:

```bash
node --test showcase/workbench-render.test.mjs
```

Expected:

- PASS with 4 passing subtests

- [ ] **Step 5: Commit the shared renderer foundation**

```bash
git add showcase/workbench-shared.js showcase/workbench-render.test.mjs
git commit -m "feat: add showcase workbench render helpers"
```

## Task 2: Upgrade The Gallery And Workbench Overview Page

**Files:**
- Modify: `showcase/index.html`
- Modify: `showcase/workspaces.html`
- Modify: `showcase/workspaces.js`
- Modify: `showcase/styles.css`
- Depends on: `showcase/workbench-shared.js`

- [ ] **Step 1: Write a failing test for overview card rendering**

Append this test to `showcase/workbench-render.test.mjs`:

```js
test("renderWorkbenchCards supports overview CTA labels for smart workbench surfaces", () => {
  const html = renderWorkbenchCards([
    {
      name: "Campaign Export Batch",
      type: "图片工作台",
      focus: "4 张主视觉待导出",
      readiness: "52%",
      href: "./image-workbench.html",
      sources: ["Feedback", "Assets", "Calendar"],
    },
  ]);

  assert.match(html, /图片工作台/);
  assert.match(html, /4 张主视觉待导出/);
  assert.match(html, /image-workbench\.html/);
});
```

- [ ] **Step 2: Run the test file to verify the new assertion fails or is not yet satisfied by page content**

Run:

```bash
node --test showcase/workbench-render.test.mjs
```

Expected:

- FAIL if the helper output does not yet cover the new expectation
- If it already passes, continue and treat the overview page wiring as the red step for this task

- [ ] **Step 3: Replace the gallery and overview markup with smart-workbench-specific structure**

Update `showcase/index.html` gallery section so it includes:

```html
<section class="gallery-grid">
  <a class="gallery-card" href="./home.html">
    <p class="eyebrow">01</p>
    <h2>首页概览</h2>
    <p>天气驱动背景、日程摘要、工作区入口、概览入口。</p>
  </a>
  <a class="gallery-card" href="./schedule.html">
    <p class="eyebrow">02</p>
    <h2>日程总览</h2>
    <p>日 / 周安排、冲突识别、来源过滤、重点时段。</p>
  </a>
  <a class="gallery-card" href="./workspaces.html">
    <p class="eyebrow">03</p>
    <h2>智能工作台总览</h2>
    <p>查看代码、图片、写作、通用四类工作台，以及 Daily 的下一步建议。</p>
  </a>
  <a class="gallery-card" href="./code-workbench.html">
    <p class="eyebrow">04</p>
    <h2>代码工作台</h2>
    <p>聚合 PR、Issue、分支、深度工作时段和开发主线建议。</p>
  </a>
  <a class="gallery-card" href="./image-workbench.html">
    <p class="eyebrow">05</p>
    <h2>图片工作台</h2>
    <p>聚合素材批次、反馈、导出规格和交付风险提示。</p>
  </a>
  <a class="gallery-card" href="./integrations.html">
    <p class="eyebrow">06</p>
    <h2>集成设置</h2>
    <p>邮箱、日历、天气接入状态、同步策略与权限说明。</p>
  </a>
</section>
```

Update `showcase/workspaces.html` main body to this structure:

```html
<main class="workbench-overview-layout">
  <section class="panel workbench-overview-hero">
    <div class="panel-head">
      <div>
        <p class="eyebrow">Smart Workbench</p>
        <h1>智能工作台总览</h1>
        <p class="lead">Daily 会根据任务、日程、文件和反馈来源，把不同类型工作整理成下一步可执行的桌面。</p>
      </div>
    </div>
    <div class="summary-strip" id="workbench-summary-strip"></div>
  </section>

  <section class="panel workbench-template-panel">
    <div class="panel-head">
      <div>
        <p class="eyebrow">Templates</p>
        <h2>工作台模板</h2>
      </div>
    </div>
    <div class="workbench-template-grid" id="workspace-types"></div>
  </section>

  <section class="panel workbench-active-panel">
    <div class="panel-head">
      <div>
        <p class="eyebrow">Active Workbenches</p>
        <h2>当前工作台</h2>
      </div>
    </div>
    <div class="workbench-card-grid" id="workspace-list"></div>
  </section>

  <section class="panel workbench-source-panel">
    <p class="eyebrow">Context Sources</p>
    <h2>上下文来源</h2>
    <div class="mini-list" id="workspace-context-sources"></div>
  </section>

  <section class="panel workbench-recommendation-panel">
    <p class="eyebrow">Daily Suggestions</p>
    <h2>建议下一步</h2>
    <div class="stack" id="workspace-recommendations"></div>
  </section>
</main>
```

Update the script tags at the bottom of `showcase/workspaces.html` to:

```html
<script src="./showcase.js"></script>
<script type="module" src="./workspaces.js"></script>
```

- [ ] **Step 4: Replace `showcase/workspaces.js` with overview-specific data and rendering**

```js
import {
  renderRecommendationList,
  renderSummaryStrip,
  renderWorkbenchCards,
} from "./workbench-shared.js";

const summary = [
  { value: "2", label: "活跃工作台" },
  { value: "5", label: "已同步来源" },
  { value: "7", label: "待处理动作" },
];

const types = [
  {
    name: "代码工作台",
    description: "处理 PR、Issue、分支和开发会议，把今天的开发主线压缩成一个执行面板。",
    chips: ["PR", "Issue", "Branch", "Calendar"],
    accent: "is-code",
  },
  {
    name: "图片工作台",
    description: "处理素材批次、反馈轮次、导出规范和交付节奏，把交付风险集中展示。",
    chips: ["Assets", "Feedback", "Export", "Deadline"],
    accent: "is-image",
  },
  {
    name: "写作工作台",
    description: "适合文章、提纲、周报和反馈邮件整理。",
    chips: ["Draft", "Notes", "Mail"],
    accent: "",
  },
  {
    name: "通用工作台",
    description: "适合行政事务、跨项目跟进和临时任务编排。",
    chips: ["Tasks", "Calendar", "Files"],
    accent: "",
  },
];

const workbenches = [
  {
    name: "设计系统升级",
    type: "代码工作台",
    focus: "下午 15:00 sync 前先完成 Token 回归修复和一轮 PR review。",
    readiness: "74%",
    href: "./code-workbench.html",
    sources: ["PR", "Issue", "Calendar"],
  },
  {
    name: "Campaign Export Batch",
    type: "图片工作台",
    focus: "4 张主视觉待导出，18:30 前需要完成一轮客户确认版。",
    readiness: "52%",
    href: "./image-workbench.html",
    sources: ["Assets", "Feedback", "Deadline"],
  },
];

const sources = [
  ["邮件反馈", "图片工作台：高频使用，聚合客户修改意见"],
  ["日历", "代码工作台：围绕会议前后安排 review 和深度工作"],
  ["本地文件", "代码与图片工作台都依赖活跃文件和目录上下文"],
  ["任务清单", "用于生成 Daily 的下一步建议和风险排序"],
  ["外部反馈", "图片工作台优先使用，用于合并评论和版本差异"],
];

const recommendations = [
  {
    title: "先 review 设计令牌 PR",
    meta: "15:00 sync 前还有 42 分钟连续空档，适合先清掉 review 阻塞。",
    actions: ["采纳", "稍后处理"],
  },
  {
    title: "优先导出 Hero Banner 批次",
    meta: "当前客户反馈已齐，继续拖延会挤压 18:30 前的确认时间。",
    actions: ["采纳", "转到图片工作台"],
  },
];

document.getElementById("workbench-summary-strip").innerHTML = renderSummaryStrip(summary);

document.getElementById("workspace-types").innerHTML = types
  .map(
    (type) => `
      <article class="type-card ${type.accent}">
        <h3>${type.name}</h3>
        <p class="subtle">${type.description}</p>
        <div class="type-chips">
          ${type.chips.map((chip) => `<span class="type-chip">${chip}</span>`).join("")}
        </div>
      </article>
    `
  )
  .join("");

document.getElementById("workspace-list").innerHTML = renderWorkbenchCards(workbenches);

document.getElementById("workspace-context-sources").innerHTML = sources
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

document.getElementById("workspace-recommendations").innerHTML =
  renderRecommendationList(recommendations);
```

- [ ] **Step 5: Add the overview layout and card styles**

Append these CSS blocks to `showcase/styles.css`:

```css
.summary-strip,
.workbench-card-grid,
.workbench-template-grid,
.workbench-rail,
.lane-grid {
  display: grid;
  gap: 14px;
}

.summary-strip {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.summary-stat {
  padding: 14px 16px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.42);
  border: 1px solid rgba(255, 255, 255, 0.64);
}

.summary-stat__value {
  display: block;
  font-size: 28px;
  line-height: 1;
}

.summary-stat__label {
  color: var(--muted);
  font-size: 12px;
}

.workbench-overview-layout {
  display: grid;
  grid-template-columns: 1.3fr 1fr;
  gap: 18px;
}

.workbench-overview-hero,
.workbench-active-panel {
  grid-column: 1 / -1;
}

.workbench-template-grid,
.workbench-card-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.workbench-card,
.recommendation-card {
  display: grid;
  gap: 12px;
  padding: 18px;
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.66);
  background: rgba(255, 255, 255, 0.46);
}

.workbench-card__top {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: start;
}

.type-card.is-code {
  background: linear-gradient(180deg, rgba(225, 235, 255, 0.82), rgba(255, 255, 255, 0.72));
}

.type-card.is-image {
  background: linear-gradient(180deg, rgba(255, 236, 228, 0.88), rgba(255, 255, 255, 0.72));
}

.chip-button {
  padding: 8px 12px;
  border-radius: 999px;
  border: 0;
  background: rgba(255, 255, 255, 0.72);
}

@media (max-width: 1024px) {
  .workbench-overview-layout,
  .workbench-template-grid,
  .workbench-card-grid,
  .summary-strip {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 6: Run syntax and test verification for the overview slice**

Run:

```bash
node --test showcase/workbench-render.test.mjs
node --check showcase/workspaces.js showcase/workbench-shared.js
```

Expected:

- tests PASS
- `node --check` emits no output and exits 0

- [ ] **Step 7: Commit the overview page slice**

```bash
git add showcase/index.html showcase/workspaces.html showcase/workspaces.js showcase/styles.css showcase/workbench-shared.js showcase/workbench-render.test.mjs
git commit -m "feat: build smart workbench overview showcase"
```

## Task 3: Build The Dedicated Code Workbench Page

**Files:**
- Create: `showcase/code-workbench.html`
- Create: `showcase/code-workbench.js`
- Modify: `showcase/styles.css`
- Modify: `showcase/workbench-render.test.mjs`
- Depends on: `showcase/workbench-shared.js`

- [ ] **Step 1: Add a failing test for code-workbench timeline rendering**

Append this test to `showcase/workbench-render.test.mjs`:

```js
test("renderTimelineList supports code-workbench meeting and deadline copy", () => {
  const html = renderTimelineList([
    {
      time: "16:30",
      title: "Design tokens review",
      meta: "确认按钮圆角和变量命名回归",
    },
  ]);

  assert.match(html, /Design tokens review/);
  assert.match(html, /变量命名回归/);
});
```

- [ ] **Step 2: Run tests to verify the new code-workbench expectation is captured**

Run:

```bash
node --test showcase/workbench-render.test.mjs
```

Expected:

- PASS if the shared helper already supports the copy
- continue to the page wiring as the implementation step for this task

- [ ] **Step 3: Create the code workbench HTML shell**

Create `showcase/code-workbench.html`:

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Daily Code Workbench Prototype</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Noto+Sans+SC:wght@400;500;700&display=swap"
      rel="stylesheet"
    />
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body class="theme-neutral theme-workbench-code">
    <div class="page-frame">
      <header class="page-topbar">
        <a class="brand-inline" href="./index.html">
          <span class="brand-badge">D</span>
          <span>Daily Showcase</span>
        </a>
        <nav class="page-nav">
          <a class="nav-link" href="./home.html">首页</a>
          <a class="nav-link" href="./schedule.html">日程</a>
          <a class="nav-link" href="./workspaces.html">工作区</a>
          <a class="nav-link active" href="./code-workbench.html">代码工作台</a>
          <a class="nav-link" href="./image-workbench.html">图片工作台</a>
        </nav>
      </header>

      <main class="workbench-page-layout">
        <section class="panel workbench-hero">
          <div id="code-hero"></div>
          <div class="summary-strip" id="code-summary"></div>
        </section>
        <section class="panel">
          <p class="eyebrow">Today's Lane</p>
          <h2>今日开发主线</h2>
          <div class="lane-grid" id="code-lane"></div>
        </section>
        <section class="panel">
          <p class="eyebrow">Code Context</p>
          <h2>代码上下文</h2>
          <div class="workbench-card-grid" id="code-context"></div>
        </section>
        <section class="panel">
          <p class="eyebrow">Time And Coordination</p>
          <h2>时间与协作</h2>
          <div class="stack" id="code-timeline"></div>
        </section>
        <aside class="panel workbench-side-panel">
          <p class="eyebrow">Smart Assistant</p>
          <h2>建议动作</h2>
          <div class="stack" id="code-recommendations"></div>
        </aside>
      </main>
    </div>

    <script type="module" src="./code-workbench.js"></script>
  </body>
</html>
```

- [ ] **Step 4: Create the code workbench data and rendering script**

Create `showcase/code-workbench.js`:

```js
import {
  renderRecommendationList,
  renderSummaryStrip,
  renderTimelineList,
  renderWorkbenchCards,
} from "./workbench-shared.js";

const hero = {
  eyebrow: "Design System Upgrade · main/ui-tokens",
  title: "代码工作台",
  summary:
    "Daily 已把本地变更、PR 评论、Issue 优先级和下午会议压缩成一个开发顺序：先 review，再修 Token 回归，最后准备 sync 决策。",
};

const summary = [
  { value: "3", label: "待 review 项" },
  { value: "2", label: "阻塞问题" },
  { value: "42m", label: "下个深度工作窗口" },
];

const lane = [
  ["当前任务", "修复 Button token hover 回归"],
  ["待 Review", "Review PR #214 design-token-cleanup"],
  ["阻塞项", "等产品确认 radius token 命名"],
  ["下一步", "16:30 前整理 sync 决策清单"],
];

const contextCards = [
  {
    name: "活跃文件",
    type: "Code Context",
    focus: "Button.tsx, token-map.ts, styles.css",
    readiness: "3 files",
    href: "./code-workbench.html",
    sources: ["UI", "Tokens", "State"],
  },
  {
    name: "关联项",
    type: "PR / Issue",
    focus: "PR #214 · ISSUE-82 · 2 条待回复评论",
    readiness: "2 pending",
    href: "./code-workbench.html",
    sources: ["PR", "Issue", "Review"],
  },
];

const timeline = [
  { time: "15:00", title: "专注时段", meta: "适合清掉 review 和 token 命名修复" },
  { time: "16:30", title: "Design tokens review", meta: "确认按钮圆角和变量命名回归" },
  { time: "18:00", title: "提交 checkpoint", meta: "如果修复完成，生成一版可 review diff" },
];

const recommendations = [
  {
    title: "先 review PR #214",
    meta: "先清 review 可以减少 16:30 会议上的上下文切换。",
    actions: ["采纳", "先修 bug"],
  },
  {
    title: "把 sync 决策点写成 3 条",
    meta: "当前问题集中在半径 token 命名、hover state 和导出规范。",
    actions: ["采纳", "稍后处理"],
  },
];

document.getElementById("code-hero").innerHTML = `
  <p class="eyebrow">${hero.eyebrow}</p>
  <h1>${hero.title}</h1>
  <p class="lead">${hero.summary}</p>
`;

document.getElementById("code-summary").innerHTML = renderSummaryStrip(summary);

document.getElementById("code-lane").innerHTML = lane
  .map(
    ([label, text]) => `
      <article class="lane-card">
        <p class="eyebrow">${label}</p>
        <strong>${text}</strong>
      </article>
    `
  )
  .join("");

document.getElementById("code-context").innerHTML = renderWorkbenchCards(contextCards);
document.getElementById("code-timeline").innerHTML = renderTimelineList(timeline);
document.getElementById("code-recommendations").innerHTML =
  renderRecommendationList(recommendations);
```

- [ ] **Step 5: Add the code workbench visual treatment**

Append to `showcase/styles.css`:

```css
.workbench-page-layout {
  display: grid;
  grid-template-columns: 1.2fr 1.2fr 0.9fr;
  gap: 18px;
}

.workbench-hero,
.workbench-page-layout > .panel:nth-child(2),
.workbench-page-layout > .panel:nth-child(3),
.workbench-page-layout > .panel:nth-child(4) {
  min-height: 220px;
}

.workbench-hero {
  grid-column: 1 / 3;
  display: grid;
  gap: 18px;
}

.workbench-side-panel {
  grid-column: 3 / 4;
  grid-row: 1 / 4;
}

.lane-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.lane-card {
  padding: 16px;
  border-radius: 20px;
  background: rgba(235, 242, 255, 0.62);
  border: 1px solid rgba(196, 213, 255, 0.72);
}

.theme-workbench-code {
  background:
    radial-gradient(circle at top right, rgba(112, 162, 255, 0.18), transparent 24%),
    linear-gradient(180deg, rgba(232, 238, 246, 0.96) 0%, rgba(214, 224, 238, 0.92) 100%);
}

@media (max-width: 1120px) {
  .workbench-page-layout {
    grid-template-columns: 1fr;
  }

  .workbench-hero,
  .workbench-side-panel {
    grid-column: auto;
    grid-row: auto;
  }

  .lane-grid {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 6: Run syntax and shared tests for the code page**

Run:

```bash
node --test showcase/workbench-render.test.mjs
node --check showcase/code-workbench.js showcase/workbench-shared.js
```

Expected:

- tests PASS
- syntax check prints nothing

- [ ] **Step 7: Commit the code workbench page**

```bash
git add showcase/code-workbench.html showcase/code-workbench.js showcase/styles.css showcase/workbench-render.test.mjs showcase/workbench-shared.js
git commit -m "feat: add code workbench showcase page"
```

## Task 4: Build The Dedicated Image Workbench Page

**Files:**
- Create: `showcase/image-workbench.html`
- Create: `showcase/image-workbench.js`
- Modify: `showcase/styles.css`
- Modify: `showcase/workbench-render.test.mjs`
- Depends on: `showcase/workbench-shared.js`

- [ ] **Step 1: Add a failing test for image-workbench recommendation copy**

Append this test to `showcase/workbench-render.test.mjs`:

```js
test("renderRecommendationList supports image-workbench delivery suggestions", () => {
  const html = renderRecommendationList([
    {
      title: "优先导出 Hero Banner 批次",
      meta: "客户评论已经收齐，继续拖延会压缩 18:30 前确认窗口。",
      actions: ["采纳", "转到导出"],
    },
  ]);

  assert.match(html, /Hero Banner/);
  assert.match(html, /18:30/);
  assert.match(html, /转到导出/);
});
```

- [ ] **Step 2: Run the tests to verify the new image-workbench expectation is covered**

Run:

```bash
node --test showcase/workbench-render.test.mjs
```

Expected:

- PASS if the helper already supports the new data shape
- continue with page creation

- [ ] **Step 3: Create the image workbench HTML shell**

Create `showcase/image-workbench.html`:

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Daily Image Workbench Prototype</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Noto+Sans+SC:wght@400;500;700&display=swap"
      rel="stylesheet"
    />
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body class="theme-neutral theme-workbench-image">
    <div class="page-frame">
      <header class="page-topbar">
        <a class="brand-inline" href="./index.html">
          <span class="brand-badge">D</span>
          <span>Daily Showcase</span>
        </a>
        <nav class="page-nav">
          <a class="nav-link" href="./home.html">首页</a>
          <a class="nav-link" href="./schedule.html">日程</a>
          <a class="nav-link" href="./workspaces.html">工作区</a>
          <a class="nav-link" href="./code-workbench.html">代码工作台</a>
          <a class="nav-link active" href="./image-workbench.html">图片工作台</a>
        </nav>
      </header>

      <main class="workbench-page-layout">
        <section class="panel workbench-hero">
          <div id="image-hero"></div>
          <div class="summary-strip" id="image-summary"></div>
        </section>
        <section class="panel">
          <p class="eyebrow">Delivery Lane</p>
          <h2>交付主线</h2>
          <div class="lane-grid" id="image-lane"></div>
        </section>
        <section class="panel">
          <p class="eyebrow">Asset Context</p>
          <h2>素材上下文</h2>
          <div class="workbench-card-grid" id="image-context"></div>
        </section>
        <section class="panel">
          <p class="eyebrow">Time And Coordination</p>
          <h2>时间与协作</h2>
          <div class="stack" id="image-timeline"></div>
        </section>
        <aside class="panel workbench-side-panel">
          <p class="eyebrow">Smart Assistant</p>
          <h2>建议动作</h2>
          <div class="stack" id="image-recommendations"></div>
        </aside>
      </main>
    </div>

    <script type="module" src="./image-workbench.js"></script>
  </body>
</html>
```

- [ ] **Step 4: Create the image workbench data and rendering script**

Create `showcase/image-workbench.js`:

```js
import {
  renderRecommendationList,
  renderSummaryStrip,
  renderTimelineList,
  renderWorkbenchCards,
} from "./workbench-shared.js";

const hero = {
  eyebrow: "Campaign Export Batch · Client Round 03",
  title: "图片工作台",
  summary:
    "Daily 已把素材批次、客户反馈、导出规格和今晚交付节点整理成一个交付面板：先修 Hero Banner，再统一导出，再进入确认。",
};

const summary = [
  { value: "12", label: "素材总数" },
  { value: "4", label: "待导出主视觉" },
  { value: "18:30", label: "确认截止" },
];

const lane = [
  ["待修图", "Hero Banner 2 张、KV 裁切 1 张"],
  ["待导出", "WebP / PNG 双规格未齐"],
  ["待确认", "客户端 Round 03 仍有 2 条评论"],
  ["下一步", "17:20 前完成 Hero Banner 批次导出"],
];

const contextCards = [
  {
    name: "素材批次",
    type: "Assets",
    focus: "hero-banner-v4, launch-kv-wide, thumbnail-pack",
    readiness: "12 assets",
    href: "./image-workbench.html",
    sources: ["Assets", "Versions", "Folders"],
  },
  {
    name: "反馈与规格",
    type: "Feedback",
    focus: "7 条评论已合并，导出尺寸包括 1440 / 1080 / 640",
    readiness: "7 comments",
    href: "./image-workbench.html",
    sources: ["Comments", "Export", "Deadline"],
  },
];

const timeline = [
  { time: "16:00", title: "内部视觉过稿", meta: "确认 Hero Banner 色温和标题安全区" },
  { time: "17:20", title: "导出窗口", meta: "统一出 WebP、PNG 和缩略图尺寸" },
  { time: "18:30", title: "客户确认节点", meta: "如果错过，交付会顺延到明早" },
];

const recommendations = [
  {
    title: "优先导出 Hero Banner 批次",
    meta: "客户评论已经收齐，继续拖延会压缩 18:30 前确认窗口。",
    actions: ["采纳", "转到导出"],
  },
  {
    title: "把 7 条评论合并成 3 组修订",
    meta: "现在最浪费时间的是来回切换反馈，不是修图本身。",
    actions: ["采纳", "稍后处理"],
  },
];

document.getElementById("image-hero").innerHTML = `
  <p class="eyebrow">${hero.eyebrow}</p>
  <h1>${hero.title}</h1>
  <p class="lead">${hero.summary}</p>
`;

document.getElementById("image-summary").innerHTML = renderSummaryStrip(summary);

document.getElementById("image-lane").innerHTML = lane
  .map(
    ([label, text]) => `
      <article class="lane-card lane-card--image">
        <p class="eyebrow">${label}</p>
        <strong>${text}</strong>
      </article>
    `
  )
  .join("");

document.getElementById("image-context").innerHTML = renderWorkbenchCards(contextCards);
document.getElementById("image-timeline").innerHTML = renderTimelineList(timeline);
document.getElementById("image-recommendations").innerHTML =
  renderRecommendationList(recommendations);
```

- [ ] **Step 5: Add the image page palette and module styling**

Append to `showcase/styles.css`:

```css
.theme-workbench-image {
  background:
    radial-gradient(circle at top right, rgba(255, 178, 148, 0.2), transparent 24%),
    linear-gradient(180deg, rgba(243, 236, 232, 0.96) 0%, rgba(234, 224, 219, 0.92) 100%);
}

.lane-card--image {
  background: rgba(255, 238, 229, 0.72);
  border: 1px solid rgba(255, 210, 188, 0.76);
}
```

- [ ] **Step 6: Run syntax and shared tests for the image page**

Run:

```bash
node --test showcase/workbench-render.test.mjs
node --check showcase/image-workbench.js showcase/workbench-shared.js
```

Expected:

- tests PASS
- syntax check prints nothing

- [ ] **Step 7: Commit the image workbench page**

```bash
git add showcase/image-workbench.html showcase/image-workbench.js showcase/styles.css showcase/workbench-render.test.mjs showcase/workbench-shared.js
git commit -m "feat: add image workbench showcase page"
```

## Task 5: Final Showcase Verification And Polish

**Files:**
- Modify if needed: `showcase/index.html`
- Modify if needed: `showcase/workspaces.html`
- Modify if needed: `showcase/workspaces.js`
- Modify if needed: `showcase/code-workbench.html`
- Modify if needed: `showcase/code-workbench.js`
- Modify if needed: `showcase/image-workbench.html`
- Modify if needed: `showcase/image-workbench.js`
- Modify if needed: `showcase/styles.css`

- [ ] **Step 1: Run the full showcase syntax and test suite**

Run:

```bash
node --test showcase/workbench-render.test.mjs
node --check showcase/workbench-shared.js showcase/workspaces.js showcase/code-workbench.js showcase/image-workbench.js
```

Expected:

- all tests PASS
- all `node --check` commands exit 0 with no output

- [ ] **Step 2: Serve the showcase locally for visual verification**

Run:

```bash
python3 -m http.server 4173 --directory showcase
```

Expected:

- terminal prints `Serving HTTP on`
- manually verify:
  - `http://localhost:4173/index.html`
  - `http://localhost:4173/workspaces.html`
  - `http://localhost:4173/code-workbench.html`
  - `http://localhost:4173/image-workbench.html`

- [ ] **Step 3: Verify the acceptance criteria against the spec**

Checklist:

```md
- [ ] index page links to code and image workbench pages
- [ ] workspaces page reads as a smart workbench overview
- [ ] code page feels like a command center
- [ ] image page feels like a delivery surface
- [ ] the three workbench surfaces feel like one family
- [ ] Daily's context + recommendation + time-awareness story is obvious
```

- [ ] **Step 4: Apply any final CSS copy or spacing fixes discovered during manual review**

Focus only on:

```css
/* spacing, responsive stacking, card emphasis, palette balance */
```

Do not add new modules or new interactions at this stage.

- [ ] **Step 5: Commit the verification polish pass**

```bash
git add showcase/index.html showcase/workspaces.html showcase/workspaces.js showcase/code-workbench.html showcase/code-workbench.js showcase/image-workbench.html showcase/image-workbench.js showcase/styles.css showcase/workbench-shared.js showcase/workbench-render.test.mjs
git commit -m "feat: finalize smart workbench showcase"
```
