import { renderActionButtons, renderStatusTabs } from "./workbench-shared.js";

const files = [
  {
    id: "button",
    label: "Button.tsx",
    path: "src/components/Button.tsx",
    header: "Button.tsx · modified · PR #214",
    body: `01 export function Button({ tone = "primary" }) {
02   const radius = tokens.button.radius.md;
03   const hoverTone = tone === "primary" ? "primaryHover" : "neutralHover";
04
05   return (
06     <button className={button({ tone, radius, hoverTone })}>
07       Continue
08     </button>
09   );
10 }`,
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
    body: `01 export const buttonTokenMap = {
02   radius: {
03     sm: "radius-8",
04     md: "radius-12",
05     lg: "radius-16",
06   },
07   hover: {
08     primary: "blue-600",
09     neutral: "slate-300",
10   },
11 };`,
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
    body: `# Button Guidelines

- Use radius token aliases instead of raw values.
- Keep hover contrast above the accessibility threshold.
- Document changes before merging component API updates.`,
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
