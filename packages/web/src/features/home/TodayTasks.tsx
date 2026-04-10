import { useRef } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";

const TASKS = [
  { title: "home.tasks.addNewTask", metaKey: "" as const, priority: "" as const, isAdd: true  },
  { title: "13:30 产品设计评审，整理主线与评审纪要模板", metaKey: "home.tasks.workspaceLink" as const, priority: "high" as const,   isAdd: false },
  { title: "11:00 处理客户邮件并同步到今日计划",       metaKey: "home.tasks.source" as const, priority: "medium" as const, isAdd: false },
  { title: "16:00 深度工作时段，处理 audit 列表高优先事项", metaKey: "home.tasks.systemReserved" as const, priority: "low" as const,    isAdd: false },
];

const PRIORITY_STYLE = {
  high:   { bg: "rgba(239, 68, 68, 0.1)", color: "var(--color-error)" },
  medium: { bg: "rgba(245, 158, 11, 0.1)", color: "var(--color-warning)" },
  low:    { bg: "rgba(34, 197, 94, 0.1)", color: "var(--color-success)" },
} as const;

export function TodayTasks() {
  const { t } = useTranslation();
  const cardRef = useRef<HTMLDivElement>(null);

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
            <p className="panel-eyebrow">Today Schedule</p>
            <h2 className="panel-title">{t("home.tasks.todayTodo")}</h2>
          </div>
          <span className="meta-pill">{t("home.tasks.completed", { completed: 4, total: 7 })}</span>
        </div>

        <div className="flex-1 task-list">
          {TASKS.map((task, index) => (
            <motion.article
              key={task.title}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.48 + index * 0.06, duration: 0.3 }}
              className="task-row"
            >
              <div className="task-main">
                <p className={`m-0 task-text${task.isAdd ? " task-text--add" : ""}`}>
                  {task.isAdd ? `＋ ${t("home.tasks.addNewTask")}` : task.title}
                </p>
                {task.metaKey && <p className="m-0 task-meta">{t(task.metaKey)}</p>}
              </div>
              {task.priority && task.priority in PRIORITY_STYLE && (
                <span
                  className="task-badge"
                  style={{
                    background: PRIORITY_STYLE[task.priority].bg,
                    color: PRIORITY_STYLE[task.priority].color,
                  }}
                >
                  {t(`home.tasks.priority.${task.priority}`)}
                </span>
              )}
            </motion.article>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
