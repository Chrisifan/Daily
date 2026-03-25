import { useRef } from "react";
import { motion } from "framer-motion";

// 对齐原型 showcase.js tasks
const TASKS = [
  { title: "添加新任务",   meta: "",                              priority: "" as const,       isAdd: true  },
  { title: "13:30 产品设计评审，整理主线与评审纪要模板",         meta: "关联工作区：客户项目 Atlas", priority: "high" as const,   isAdd: false },
  { title: "11:00 处理客户邮件并同步到今日计划",                meta: "来源：邮件 / 系统日历",   priority: "medium" as const, isAdd: false },
  { title: "16:00 深度工作时段，处理 audit 列表高优先事项",    meta: "系统保留的专注区间",      priority: "low" as const,    isAdd: false },
];

const PRIORITY_STYLE = {
  high:   { bg: "rgba(243,122,145,0.16)", color: "#b13d59", label: "高" },
  medium: { bg: "rgba(255,214,122,0.18)", color: "#9a7422", label: "中" },
  low:    { bg: "rgba(140,221,164,0.20)", color: "#2c8d4d", label: "低" },
} as const;

export function TodayTasks() {
  const cardRef = useRef<HTMLDivElement>(null);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    el.style.transform = `perspective(900px) rotateX(${(0.5 - y) * 5}deg) rotateY(${(x - 0.5) * 5}deg) translateY(-2px)`;
    el.style.boxShadow = "0 24px 48px rgba(74,83,97,0.18)";
  }
  function handleMouseLeave() {
    const el = cardRef.current;
    if (!el) return;
    el.style.transform = "";
    el.style.boxShadow = "0 20px 50px rgba(74,83,97,0.12)";
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
        className="h-full p-5 flex flex-col glass-card tasks-card"
      >
        {/* panel-head */}
        <div className="panel-head">
          <div>
            <p className="panel-eyebrow">Today Schedule</p>
            <h2 className="panel-title">今日待办</h2>
          </div>
          <span className="meta-pill">4 / 7 已完成</span>
        </div>

        {/* task-list */}
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
                  {task.isAdd ? "＋ 添加新任务" : task.title}
                </p>
                {task.meta && <p className="m-0 task-meta">{task.meta}</p>}
              </div>
              {task.priority && task.priority in PRIORITY_STYLE && (
                <span
                  className="task-badge"
                  style={{
                    background: PRIORITY_STYLE[task.priority].bg,
                    color: PRIORITY_STYLE[task.priority].color,
                  }}
                >
                  {PRIORITY_STYLE[task.priority].label}
                </span>
              )}
            </motion.article>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
