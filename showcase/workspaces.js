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
