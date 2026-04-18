import { renderActionButtons, renderStatusTabs } from "./workbench-shared.js";

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
