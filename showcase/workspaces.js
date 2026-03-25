const types = [
  {
    name: "代码",
    description: "开发任务、bug 修复、code review、技术会议。",
    chips: ["PR", "Issue", "本地项目"],
  },
  {
    name: "图片处理",
    description: "修图、导出、素材整理、视觉评审。",
    chips: ["附件", "导出", "素材"],
  },
  {
    name: "写作",
    description: "文章、文案、提纲、周报、资料整理。",
    chips: ["稿件", "提纲", "反馈邮件"],
  },
  {
    name: "通用",
    description: "行政事务、临时项目、跨类型任务。",
    chips: ["待办", "日历", "摘要"],
  },
];

const workspaces = [
  ["客户项目 Atlas", "写作", "46%", "已绑定邮件和日历"],
  ["设计系统升级", "代码", "74%", "本周重点处理 review"],
  ["视觉导出批次", "图片处理", "52%", "2 个素材待确认"],
];

const details = [
  ["已接入 Gmail", "用于提取反馈和待办"],
  ["已接入 Google Calendar", "同步评审和专注时段"],
  ["已绑定资料目录", "用于统一查看相关文件"],
];

document.getElementById("workspace-types").innerHTML = types
  .map(
    (type) => `
      <article class="type-card">
        <h3>${type.name}</h3>
        <p class="subtle">${type.description}</p>
        <div class="type-chips">
          ${type.chips.map((chip) => `<span class="type-chip">${chip}</span>`).join("")}
        </div>
      </article>
    `
  )
  .join("");

document.getElementById("workspace-list").innerHTML = workspaces
  .map(
    ([name, type, score, meta]) => `
      <article class="workspace-row">
        <div>
          <strong>${name}</strong>
          <p class="subtle">${type} · ${meta}</p>
        </div>
        <span class="meta-pill">${score}</span>
      </article>
    `
  )
  .join("");

document.getElementById("workspace-detail-items").innerHTML = details
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
