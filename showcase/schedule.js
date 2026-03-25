const timeline = [
  ["09:30", "晨间整理与优先级检查", "系统保留的计划整理时间", "low"],
  ["11:00", "处理客户邮件并同步到今日计划", "来源：邮件 / 系统日历", "medium"],
  ["13:30", "产品设计评审", "关联工作区：客户项目 Atlas", "high"],
  ["16:00", "深度工作时段", "专注处理 audit 列表高优先事项", "low"],
];

document.getElementById("schedule-timeline").innerHTML = timeline
  .map(
    ([time, title, meta, priority]) => `
      <article class="timeline-row">
        <span class="timeline-time">${time}</span>
        <div class="timeline-main">
          <strong>${title}</strong>
          <span class="subtle">${meta}</span>
        </div>
        <span class="priority-pill ${priority}">${priority === "high" ? "高" : priority === "medium" ? "中" : "低"}</span>
      </article>
    `
  )
  .join("");
