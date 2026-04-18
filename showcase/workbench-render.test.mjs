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
