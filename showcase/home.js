const homeData = window.DAILY_SHOWCASE.home;

document.getElementById("home-metric-strip").innerHTML = homeData.metrics
  .map(
    (item) => `
      <article class="metric-card">
        <div class="metric-value">${item.value}</div>
        <div class="metric-label">${item.label}</div>
      </article>
    `
  )
  .join("");

homeData.summaries.forEach((card) => {
  document.getElementById(card.id).innerHTML = `
    <div class="mini-card-head">
      <span class="icon-dot ${card.icon}"></span>
      <span class="mini-number ${card.value.length > 2 ? "small" : ""}">${card.value}</span>
    </div>
    <div>
      <p class="mini-title">${card.title}</p>
      <p class="mini-text">${card.text}</p>
    </div>
  `;
});

document.getElementById("home-task-list").innerHTML = homeData.tasks
  .map(
    (task, index) => `
      <article class="task-row">
        <div class="task-main">
          <p>${index === 0 ? `＋ ${task.title}` : task.title}</p>
          ${task.meta ? `<p class="subtle">${task.meta}</p>` : ""}
        </div>
        ${task.priority ? `<span class="task-badge ${task.priority}">${task.priority === "high" ? "高" : task.priority === "medium" ? "中" : "低"}</span>` : ""}
      </article>
    `
  )
  .join("");

document.getElementById("home-plan-copy").innerHTML = `
  <p>基于今日日程、邮件和工作区状态，系统建议先完成评审准备，再处理回信，随后进入深度工作。</p>
  <p>1. 先完成设计评审的主线确认与会前资料检查</p>
  <p>2. 将邮件中的 2 个行动项同步到客户项目 Atlas</p>
`;

document.getElementById("home-workspace-card").innerHTML = `
  <div class="workspace-box">
    <div class="panel-head">
      <h3>客户项目 Atlas</h3>
      <strong>46%</strong>
    </div>
    <p class="subtle">已接入邮件与日历同步，当前最适合先确认评审主线。</p>
    <div class="workspace-actions">
      <span class="workspace-chip">查看工作区</span>
      <span class="workspace-chip">新建工作区</span>
      <span class="workspace-chip">同步日历</span>
    </div>
  </div>
`;

const homePlanToggle = document.getElementById("home-plan-toggle");
const homePlanPanel = document.getElementById("home-plan-panel");

homePlanToggle.addEventListener("click", () => {
  homePlanPanel.classList.toggle("is-expanded");
  homePlanToggle.textContent = homePlanPanel.classList.contains("is-expanded") ? "−" : "+";
});

document.querySelectorAll(".tilt-card").forEach((card) => {
  card.addEventListener("mousemove", (event) => {
    const rect = card.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    const rotateY = (x - 0.5) * 5;
    const rotateX = (0.5 - y) * 5;
    card.style.transform = `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-2px)`;
  });

  card.addEventListener("mouseleave", () => {
    card.style.transform = "";
  });
});
