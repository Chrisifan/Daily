import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";

const TAG_KEYS = [
  { key: "home.overview.tags.activeProjects", count: 3, bg: "rgba(34, 197, 94, 0.12)", color: "var(--color-success)" },
  { key: "home.overview.tags.workspaces", count: 4, bg: "rgba(59, 130, 246, 0.12)", color: "var(--color-info)" },
  { key: "home.overview.tags.newEmails", count: 2, bg: "rgba(139, 92, 246, 0.12)", color: "#8B5CF6" },
];

const CHIP_KEYS = ["home.overview.actions.viewWorkspaces", "home.overview.actions.newWorkspace", "home.overview.actions.syncCalendar"] as const;

export function WorkspaceOverview() {
  const { t } = useTranslation();
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
            <h2 className="panel-title">{t("home.overview.todayOverview")}</h2>
          </div>
          <button className="ws-link-btn">{t("home.overview.viewOverview")}</button>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {TAG_KEYS.map(tag => (
            <span
              key={tag.key}
              className="tag-pill"
              style={{ background: tag.bg, color: tag.color }}
            >
              {t(tag.key, { count: tag.count })}
            </span>
          ))}
        </div>

        <div
          className="flex-1 split-grid min-h-0"
          style={{ gridTemplateColumns: expanded ? "1fr" : "1.2fr 0.8fr" }}
        >
          <div className="grid gap-3 text-sm content-start ws-stack">
            <p className="m-0">{t("home.overview.suggestion")}</p>
            <p className="m-0">{t("home.overview.step1")}</p>
            <p className="m-0">{t("home.overview.step2", { count: 2 })}</p>
          </div>

          {!expanded && (
            <div className="workspace-box">
              <div className="flex items-center justify-between gap-2">
                <h3 className="workspace-box__title">客户项目 Atlas</h3>
                <strong className="workspace-box__progress">46%</strong>
              </div>
              <p className="workspace-box__desc">
                {t("home.overview.atlasSynced")}
              </p>
              <div className="flex flex-wrap gap-2" style={{ marginTop: "10px" }}>
                {CHIP_KEYS.map(chip => (
                  <span key={chip} className="chip">{t(chip)}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => setExpanded(prev => !prev)}
          className={`fab-toggle${expanded ? " fab-toggle--expanded" : ""}`}
          aria-label={expanded ? t("home.overview.collapseOverview") : t("home.overview.expandOverview")}
        >
          {expanded ? "−" : "+"}
        </button>
      </div>
    </motion.div>
  );
}
