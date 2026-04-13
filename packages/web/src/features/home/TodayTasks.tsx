import { useMemo, useRef } from "react";
import { addMinutes } from "date-fns";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import type { ScheduleItem } from "../../domain/schedule/types";
import { PRIORITY_STYLES } from "../../shared/constants/priority";
import { filterTodayItems, formatTime, sortByDate } from "../../shared/utils/date";

interface TodayTasksProps {
  schedules: ScheduleItem[];
  loading?: boolean;
  onCreateSchedule?: () => void;
  onOpenSchedule?: (schedule?: ScheduleItem) => void;
}

export function TodayTasks({
  schedules,
  loading = false,
  onCreateSchedule,
  onOpenSchedule,
}: TodayTasksProps) {
  const { t } = useTranslation();
  const cardRef = useRef<HTMLDivElement>(null);
  const todaySchedules = useMemo(
    () => sortByDate(filterTodayItems(schedules, "startAt")).slice(0, 4),
    [schedules]
  );
  const totalTodayCount = useMemo(
    () => filterTodayItems(schedules, "startAt").length,
    [schedules]
  );

  function getScheduleMeta(schedule: ScheduleItem) {
    const start = new Date(schedule.startAt);
    const end = addMinutes(start, schedule.durationMinutes);
    const timeRange =
      schedule.durationMinutes > 0
        ? `${formatTime(start)} - ${formatTime(end)}`
        : formatTime(start);

    return schedule.location ? `${timeRange} · ${schedule.location}` : timeRange;
  }

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    el.style.transform = `perspective(900px) rotateX(${(0.5 - y) * 5}deg) rotateY(${(x - 0.5) * 5}deg) translateY(-2px)`;
    el.style.boxShadow = "var(--shadow-xl)";
  }

  function handleMouseLeave() {
    const el = cardRef.current;
    if (!el) return;
    el.style.transform = "";
    el.style.boxShadow = "var(--shadow-lg)";
  }

  return (
    <motion.div
      className="h-full"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.38, duration: 0.45 }}
    >
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="h-full p-5 flex flex-col tasks-card"
        style={{ boxShadow: "var(--shadow-lg)" }}
      >
        <div className="panel-head">
          <div>
            <h2 className="panel-title">{t("home.tasks.todayTodo")}</h2>
          </div>
          <span className="meta-pill">
            {loading ? "..." : t("home.tasks.todayCount", { count: totalTodayCount })}
          </span>
        </div>

        {todaySchedules.length > 0 ? (
          <div className="flex-1 task-list">
            {todaySchedules.map((schedule, index) => (
              <motion.button
                key={schedule.id}
                type="button"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.48 + index * 0.06, duration: 0.3 }}
                className="task-row task-row--button"
                onClick={() => onOpenSchedule?.(schedule)}
              >
                <div className="task-main">
                  <p className="m-0 task-text">{schedule.title}</p>
                  <p className="m-0 task-meta">{getScheduleMeta(schedule)}</p>
                </div>
                <span
                  className="task-badge"
                  style={{
                    background: PRIORITY_STYLES[schedule.priority].softBackground,
                    color: PRIORITY_STYLES[schedule.priority].text,
                  }}
                >
                  {t(`home.tasks.priority.${schedule.priority}`)}
                </span>
              </motion.button>
            ))}
          </div>
        ) : (
          <div className="task-empty">
            <p className="m-0 task-empty__title">{t("calendar.noSchedules")}</p>
            <p className="m-0 task-empty__text">{t("home.tasks.empty")}</p>
          </div>
        )}

        <div className="task-actions">
          <button type="button" className="btn-primary task-action-btn" onClick={onCreateSchedule}>
            {t("schedule.newSchedule")}
          </button>
          <button
            type="button"
            className="btn-secondary task-action-btn"
            onClick={() => onOpenSchedule?.()}
          >
            {t("home.tasks.viewSchedule")}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
