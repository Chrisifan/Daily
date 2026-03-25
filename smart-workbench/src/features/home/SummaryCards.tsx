import { motion } from "framer-motion";
import { useRef } from "react";
import type { ScheduleItem } from "../../domain/schedule/types";
import type { InboxItem } from "../../domain/inbox/types";
import type { Workspace } from "../../domain/workspace/types";

interface SummaryCardsProps {
  schedules: ScheduleItem[];
  workspaces: Workspace[];
  inboxItems: InboxItem[];
}

// 对齐原型 showcase.js summaries
const CARD_DEFS = [
  {
    value: "40%", title: "日程规划", text: "查看完整日历",
    iconBg: "rgba(124,173,255,0.24)",
    // card-float-a
    transform: "rotate(-0.9deg)",
    borderRadius: "30px 24px 24px 24px",
  },
  {
    value: "4",   title: "项目跟踪", text: "活跃项目状态",
    iconBg: "rgba(137,222,165,0.26)",
    // card-float-b
    transform: "translateY(8px) rotate(1deg)",
    borderRadius: "24px 30px 24px 24px",
  },
  {
    value: "2",   title: "邮件同步", text: "新邮件待整理",
    iconBg: "rgba(255,221,135,0.28)",
    // card-float-c
    transform: "translateY(-6px) rotate(-0.8deg)",
    borderRadius: "24px 24px 30px 24px",
  },
  {
    value: "1",   title: "工作区",   text: "进入活跃工作区",
    iconBg: "rgba(213,178,255,0.28)",
    // card-float-d
    transform: "translateX(-8px) rotate(0.6deg)",
    borderRadius: "24px 24px 24px 30px",
  },
];

export function SummaryCards({ schedules, workspaces, inboxItems }: SummaryCardsProps) {
  const unreadCount = inboxItems.filter(i => !i.isRead).length;
  const activeCount = workspaces.filter(w => w.status === "active").length;
  const dynamicValues = [
    `${Math.round((schedules.length / 5) * 100)}%`,
    String(activeCount),
    String(unreadCount),
    "1",
  ];

  return (
    <div className="summary-grid">
      {CARD_DEFS.map((card, i) => (
        <MiniCard key={card.title} card={card} val={dynamicValues[i]} delay={0.08 + i * 0.07} />
      ))}
    </div>
  );
}

interface MiniCardDef {
  value: string; title: string; text: string;
  iconBg: string;
  transform: string;
  borderRadius: string;
}

function MiniCard({ card, val, delay }: { card: MiniCardDef; val: string; delay: number }) {
  const isSmall = val.length > 2;
  const ref = useRef<HTMLDivElement>(null);

  function handleMouseEnter() {
    if (ref.current) ref.current.style.boxShadow = "0 24px 48px rgba(74,83,97,0.18)";
  }
  function handleMouseLeave() {
    if (ref.current) ref.current.style.boxShadow = "0 20px 50px rgba(74,83,97,0.12)";
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
      className="h-full"
    >
      <div
        ref={ref}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="relative grid p-[18px] h-full glass-card mini-card"
        style={{
          alignContent: "space-between",
          borderRadius: card.borderRadius,
          transform: card.transform,
        }}
      >
        {/* 装饰块 */}
        <div className="mini-card__deco" />

        {/* 头部: 图标圆点 + 数字 */}
        <div className="flex items-start justify-between gap-3">
          <span className="mini-card__icon" style={{ background: card.iconBg }} />
          <span className={`font-bold leading-[0.9] mini-number ${isSmall ? "mini-number--sm" : "mini-number--lg"}`}>
            {val}
          </span>
        </div>

        {/* 底部: 标题 + 副文 */}
        <div>
          <p className="m-0 mini-title">{card.title}</p>
          <p className="m-0 mt-1.5 mini-text">{card.text}</p>
        </div>
      </div>
    </motion.div>
  );
}
