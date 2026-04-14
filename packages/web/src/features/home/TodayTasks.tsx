import { useMemo, useRef } from "react";
import { addMinutes } from "date-fns";
import { motion } from "framer-motion";
import { Link2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { CSSProperties } from "react";
import type { ScheduleItem } from "../../domain/schedule/types";
import type { Workspace } from "../../domain/workspace/types";
import { PRIORITY_STYLES } from "../../shared/constants/priority";
import { filterTodayItems, formatTime, sortByDate } from "../../shared/utils/date";

interface TodayTasksProps {
  schedules: ScheduleItem[];
  workspaces: Workspace[];
  loading?: boolean;
  onCreateSchedule?: () => void;
  onOpenSchedule?: (schedule?: ScheduleItem) => void;
}

export function TodayTasks({
  schedules,
  workspaces,
  loading = false,
  onCreateSchedule,
  onOpenSchedule,
}: TodayTasksProps) {
  const { t } = useTranslation();
  const cardRef = useRef<HTMLDivElement>(null);
  const workspaceMap = useMemo(
    () => new Map(workspaces.map((workspace) => [workspace.id, workspace])),
    [workspaces]
  );
  const todaySchedules = useMemo(
    () => {
      const now = new Date();
      return sortByDate(filterTodayItems(schedules, "startAt"))
        .sort((a, b) => {
          const aStartsAt = new Date(a.startAt);
          const bStartsAt = new Date(b.startAt);
          const aUpcoming = aStartsAt >= now;
          const bUpcoming = bStartsAt >= now;

          if (aUpcoming !== bUpcoming) {
            return aUpcoming ? -1 : 1;
          }

          return aStartsAt.getTime() - bStartsAt.getTime();
        })
        .slice(0, 3);
    },
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
          <div className="panel-head__main">
            <h2 className="panel-title">{t("home.tasks.todayTodo")}</h2>
            <span className="panel-count-badge">
              {loading ? "..." : t("home.tasks.todayCountBadge", { count: totalTodayCount })}
            </span>
          </div>
          <div className="task-toolbar">
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

        {todaySchedules.length > 0 ? (
          <div className="flex-1 task-list">
            {todaySchedules.map((schedule, index) => {
              const linkedWorkspace = schedule.workspaceId
                ? workspaceMap.get(schedule.workspaceId)
                : undefined;

              return (
                <motion.button
                  key={schedule.id}
                  type="button"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.48 + index * 0.06, duration: 0.3 }}
                  className={`task-row task-row--button${linkedWorkspace ? " task-row--with-link" : ""}`}
                  onClick={() => onOpenSchedule?.(schedule)}
                  style={
                    {
                      "--task-accent": PRIORITY_STYLES[schedule.priority].border,
                      "--task-soft": PRIORITY_STYLES[schedule.priority].softBackground,
                      "--task-ring": PRIORITY_STYLES[schedule.priority].ring,
                    } as CSSProperties
                  }
                >
                  <div className={`task-main${linkedWorkspace ? " task-main--with-link" : ""}`}>
                    <p className="m-0 task-text">{schedule.title}</p>
                    <p className="m-0 task-meta">{getScheduleMeta(schedule)}</p>
                  </div>
                  {linkedWorkspace ? (
                    <div
                      className="task-link"
                      title={t("home.tasks.workspaceLink", { name: linkedWorkspace.name })}
                    >
                      <Link2 size={12} />
                      <span className="task-link__text">{linkedWorkspace.name}</span>
                    </div>
                  ) : null}
                </motion.button>
              );
            })}
          </div>
        ) : (
          <div className="task-empty">
            <p className="m-0 task-empty__title">{t("calendar.noSchedules")}</p>
            <p className="m-0 task-empty__text">{t("home.tasks.empty")}</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
