const calendarDays = [
  { weekday: "周日", day: 5, markers: ["coral", "blue"], active: false },
  { weekday: "周一", day: 6, markers: ["coral", "blue"], active: false },
  { weekday: "周二", day: 7, markers: ["coral", "coral", "blue"], active: true },
  { weekday: "周三", day: 8, markers: ["coral", "blue"], active: false },
  { weekday: "周四", day: 9, markers: ["coral", "blue"], active: false },
  { weekday: "周五", day: 10, markers: ["coral", "blue"], active: false },
  { weekday: "周六", day: 11, markers: ["coral", "blue"], active: false },
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

const weekStrip = document.getElementById("calendar-week-strip");
const timeRail = document.getElementById("calendar-time-rail");
const weekColumns = document.getElementById("calendar-week-columns");
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
            ${markers.map((marker) => `<i class="marker-dot ${marker}"></i>`).join("")}
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

function setExpanded(nextExpanded) {
  demo.classList.toggle("is-expanded", nextExpanded);
  toggle.setAttribute("aria-expanded", String(nextExpanded));
  toggle.setAttribute("aria-label", nextExpanded ? "收起日历详情" : "展开日历详情");
}

buildWeekStrip();
buildExpandedRail();
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

  document.querySelector("[data-calendar-title]").textContent = nextDay === 7 ? "2026年4月7日" : `2026年4月${nextDay}日`;

  buildWeekStrip();
  buildExpandedRail();
});
