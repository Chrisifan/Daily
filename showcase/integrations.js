const accounts = [
  ["Gmail", "已连接", "最近同步：2 分钟前"],
  ["Google Calendar", "已连接", "同步今日与未来 14 天事件"],
  ["Outlook", "未连接", "可用于邮件和日历聚合"],
  ["IMAP", "未启用", "作为通用邮箱兜底方案"],
];

const flow = [
  ["1. Connector", "从 Gmail、Google Calendar 等服务读取原始数据"],
  ["2. Normalizer", "统一转成 InboxItem 和 ScheduleItem"],
  ["3. Router", "按代码 / 图片处理 / 写作工作区归类"],
  ["4. Suggestion", "生成加入待办、加入日程、绑定工作区建议"],
];

const security = [
  ["最小权限", "第一版默认只读，不自动写回日历或发邮件"],
  ["本地缓存", "业务缓存存 SQLite，敏感凭证优先走系统安全存储"],
  ["用户控制", "可关闭自动分类、清空本地缓存、断开账户"],
];

document.getElementById("account-list").innerHTML = accounts
  .map(
    ([name, status, meta]) => `
      <article class="account-row">
        <div>
          <strong>${name}</strong>
          <p class="subtle">${meta}</p>
        </div>
        <span class="status-pill ${status === "已连接" ? "green" : status === "未连接" ? "medium" : "low"}">${status}</span>
      </article>
    `
  )
  .join("");

document.getElementById("flow-list").innerHTML = flow
  .map(
    ([step, text]) => `
      <article class="flow-row">
        <strong>${step}</strong>
        <p class="subtle">${text}</p>
      </article>
    `
  )
  .join("");

document.getElementById("security-list").innerHTML = security
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
