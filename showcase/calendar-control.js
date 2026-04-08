const calendarDays = [
  {
    weekday: "周日",
    day: 5,
    markers: [
      { tone: "coral", glyph: "⏰" },
      { tone: "blue", glyph: "☾" },
    ],
    active: false,
  },
  {
    weekday: "周一",
    day: 6,
    markers: [
      { tone: "coral", glyph: "⏰" },
      { tone: "blue", glyph: "☾" },
    ],
    active: false,
  },
  {
    weekday: "周二",
    day: 7,
    markers: [
      { tone: "coral", glyph: "" },
      { tone: "coral", glyph: "⏰" },
      { tone: "blue", glyph: "☑" },
      { tone: "blue", glyph: "☾" },
    ],
    active: true,
  },
  {
    weekday: "周三",
    day: 8,
    markers: [
      { tone: "coral", glyph: "⏰" },
      { tone: "blue", glyph: "☾" },
    ],
    active: false,
  },
  {
    weekday: "周四",
    day: 9,
    markers: [
      { tone: "coral", glyph: "⏰" },
      { tone: "blue", glyph: "☾" },
    ],
    active: false,
  },
  {
    weekday: "周五",
    day: 10,
    markers: [
      { tone: "coral", glyph: "⏰" },
      { tone: "blue", glyph: "☾" },
    ],
    active: false,
  },
  {
    weekday: "周六",
    day: 11,
    markers: [
      { tone: "coral", glyph: "⏰" },
      { tone: "blue", glyph: "☾" },
    ],
    active: false,
  },
];

const columnEvents = {
  5: ["wake", "sleep"],
  6: ["wake", "sleep"],
  7: ["wake", "focus", "sleep"],
  8: ["wake-muted", "sleep-muted"],
  9: ["wake-muted", "sleep-muted"],
  10: ["wake-muted", "sleep-muted"],
  11: ["wake-muted", "sleep-muted"],
};

const railHours = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00"];

const detailRows = [
  { kind: "event", time: "08:00", meta: "08:00 ◌", title: "起床啦!", tone: "coral", icon: "⏰", classes: "wake" },
  { kind: "event", time: "08:05", meta: "08:05 – 08:20 (15 分钟)", title: "1", tone: "blue", icon: "☑", classes: "task" },
  { kind: "event", time: "08:20", meta: "08:20 – 08:35 (15 分钟)", title: "1", tone: "blue", icon: "☑", classes: "task" },
  { kind: "event", time: "08:35", meta: "08:35 – 08:50 (15 分钟)", title: "2222", tone: "blue", icon: "☑", classes: "task" },
  { kind: "note", time: "08:50", text: "暂停结束。继续前进！" },
  {
    kind: "event",
    time: "10:00",
    meta: "10:00 – 10:15 (15 分钟)",
    title: "回复邮件",
    badge: "任务重叠",
    tone: "coral",
    icon: "@",
    classes: "focus is-focus",
  },
  { kind: "event", time: "10:15", meta: "10:00 – 10:15 (15 分钟)", title: "回复邮件", tone: "coral", icon: "@", classes: "task overlap-copy" },
  { kind: "note", time: "11:00", text: "间歇结束。接下来是什么？" },
  { kind: "event", time: "11:45", meta: "11:45 – 12:00 (15 分钟)", title: "222", tone: "blue", icon: "◫", classes: "task" },
  { kind: "note", time: "17:00", text: "间歇结束。接下来是什么？" },
  { kind: "event", time: "22:00", meta: "22:00 ◌", title: "晚安!", tone: "blue", icon: "☾", classes: "sleep" },
];

const weekStrip = document.getElementById("calendar-week-strip");
const timeRail = document.getElementById("calendar-time-rail");
const weekColumns = document.getElementById("calendar-week-columns");
const detailList = document.getElementById("calendar-detail-list");
const toggle = document.getElementById("calendar-toggle");
const demo = document.querySelector("[data-calendar-demo]");

function buildWeekStrip() {
  weekStrip.innerHTML = calendarDays
    .map(
      ({ weekday, day, markers, active }) => `
        <button class="calendar-day-pill ${active ? "is-active" : ""}" type="button" data-day="${day}">
          <span class="calendar-day-week">${weekday}</span>
          <span class="calendar-day-number">${day}</span>
          <span class="calendar-day-markers">
            ${markers
              .map(
                ({ tone, glyph }) => `
                  <i class="marker-dot ${tone} ${glyph ? "has-glyph" : "is-plain"}">${glyph || ""}</i>
                `
              )
              .join("")}
          </span>
        </button>
      `
    )
    .join("");
}

function buildExpandedRail() {
  timeRail.innerHTML = railHours.map((hour) => `<span>${hour}</span>`).join("");

  weekColumns.innerHTML = calendarDays
    .map(({ weekday, day, active }) => {
      const events = columnEvents[day] || [];
      return `
        <article class="calendar-week-column ${active ? "is-active" : ""}">
          <div class="calendar-column-head">
            <span>${weekday}</span>
            <strong>${day}</strong>
          </div>
          <div class="calendar-column-track">
            ${events
              .map((event) => `<span class="calendar-column-event ${event} ${active && event === "focus" ? "highlight" : ""}"></span>`)
              .join("")}
          </div>
        </article>
      `;
    })
    .join("");
}

function buildDetailList() {
  detailList.innerHTML = detailRows
    .map((row) => {
      if (row.kind === "note") {
        return `
          <article class="calendar-detail-row note-row">
            <div class="calendar-detail-row-time">${row.time}</div>
            <div class="calendar-detail-row-content">
              <div class="calendar-detail-note-block">
                <span class="calendar-detail-note-icon">z z</span>
                <p>${row.text}</p>
              </div>
            </div>
            <div></div>
          </article>
        `;
      }

      return `
        <article class="calendar-detail-row event-row ${row.classes}">
          <div class="calendar-detail-row-time">${row.time}</div>
          <div class="calendar-detail-row-content">
            <div class="calendar-detail-node ${row.tone}">
              <span>${row.icon}</span>
            </div>
            <div class="calendar-detail-copy">
              <p class="calendar-detail-meta">${row.meta}</p>
              <h3>${row.title}</h3>
              ${row.badge ? `<p class="calendar-detail-badge">${row.badge}</p>` : ""}
            </div>
          </div>
          <div class="calendar-detail-row-status">
            <span class="status-ring ${row.tone}"></span>
          </div>
        </article>
      `;
    })
    .join("");
}

function setExpanded(nextExpanded) {
  demo.classList.toggle("is-expanded", nextExpanded);
  toggle.setAttribute("aria-expanded", String(nextExpanded));
  toggle.setAttribute("aria-label", nextExpanded ? "收起日历详情" : "展开日历详情");
}

function getTitle(day) {
  return day === 7 ? "2026年4月7日" : `2026年4月${day}日`;
}

buildWeekStrip();
buildExpandedRail();
buildDetailList();
setExpanded(false);

toggle.addEventListener("click", () => {
  setExpanded(!demo.classList.contains("is-expanded"));
});

weekStrip.addEventListener("click", (event) => {
  const target = event.target.closest("[data-day]");
  if (!target) {
    return;
  }

  const nextDay = Number(target.dataset.day);

  calendarDays.forEach((day) => {
    day.active = day.day === nextDay;
  });

  document.querySelector("[data-calendar-title]").textContent = getTitle(nextDay);

  buildWeekStrip();
  buildExpandedRail();
});
