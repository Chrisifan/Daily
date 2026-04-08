import { useState, useRef } from "react";
import { motion } from "framer-motion";

const TAGS = [
  { label: "活跃项目 3", bg: "rgba(34, 197, 94, 0.12)", color: "var(--color-success)" },
  { label: "工作区 4",   bg: "rgba(59, 130, 246, 0.12)", color: "var(--color-info)" },
  { label: "新邮件 2",   bg: "rgba(139, 92, 246, 0.12)", color: "#8B5CF6" },
];

const CHIPS = ["查看工作区", "新建工作区", "同步日历"];

export function WorkspaceOverview() {
  const [expanded, setExpanded] = useState(false);
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
      transition={{ delay: 0.42, duration: 0.45 }}
    >
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="relative h-full p-5 flex flex-col gap-3 ws-card"
        style={{ boxShadow: "var(--shadow-lg)" }}
      >
        <div className="panel-head" style={{ marginBottom: 0 }}>
          <div>
            <p className="panel-eyebrow">Overview</p>
            <h2 className="panel-title">今日总览与工作区</h2>
          </div>
          <button className="ws-link-btn">查看总览</button>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {TAGS.map(tag => (
            <span
              key={tag.label}
              className="tag-pill"
              style={{ background: tag.bg, color: tag.color }}
            >
              {tag.label}
            </span>
          ))}
        </div>

        <div
          className="flex-1 split-grid min-h-0"
          style={{ gridTemplateColumns: expanded ? "1fr" : "1.2fr 0.8fr" }}
        >
          <div className="grid gap-3 text-sm content-start ws-stack">
            <p className="m-0">
              基于今日日程、邮件和工作区状态，系统建议先完成评审准备，再处理回信，随后进入深度工作。
            </p>
            <p className="m-0">1. 先完成设计评审的主线确认与会前资料检查</p>
            <p className="m-0">2. 将邮件中的 2 个行动项同步到客户项目 Atlas</p>
          </div>

          {!expanded && (
            <div className="workspace-box">
              <div className="flex items-center justify-between gap-2">
                <h3 className="workspace-box__title">客户项目 Atlas</h3>
                <strong className="workspace-box__progress">46%</strong>
              </div>
              <p className="workspace-box__desc">
                已接入邮件与日历同步，当前最适合先确认评审主线。
              </p>
              <div className="flex flex-wrap gap-2" style={{ marginTop: "10px" }}>
                {CHIPS.map(chip => (
                  <span key={chip} className="chip">{chip}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => setExpanded(prev => !prev)}
          className={`fab-toggle${expanded ? " fab-toggle--expanded" : ""}`}
          aria-label="展开总览"
        >
          {expanded ? "−" : "+"}
        </button>
      </div>
    </motion.div>
  );
}
