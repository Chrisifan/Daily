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

test("renderActionButtons supports image editing actions", () => {
  const html = renderActionButtons([
    { label: "Remove BG", tone: "primary" },
    { label: "Batch Export", tone: "ghost" },
  ]);

  assert.match(html, /Remove BG/);
  assert.match(html, /Batch Export/);
});
