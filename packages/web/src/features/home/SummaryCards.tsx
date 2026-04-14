import { motion } from "framer-motion";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import type { ScheduleItem } from "../../domain/schedule/types";
import type { InboxItem } from "../../domain/inbox/types";
import type { Workspace } from "../../domain/workspace/types";

interface SummaryCardsProps {
  schedules: ScheduleItem[];
  workspaces: Workspace[];
  inboxItems: InboxItem[];
}

const CARD_SHAPES = {
  left: {
    transform: "rotate(-0.9deg)",
    borderRadius: "30px 24px 24px 24px",
  },
  right: {
    transform: "translateY(8px) rotate(1deg)",
    borderRadius: "24px 30px 24px 24px",
  },
} as const;

const CARD_DEFS = [
  {
    value: "40%",
    titleKey: "home.summary.schedulePlanning",
    textKey: "home.summary.viewFullCalendar",
    iconBg: "rgba(63, 86, 214, 0.15)",
    ...CARD_SHAPES.left,
  },
  {
    value: "4",
    titleKey: "home.summary.projectTracking",
    textKey: "home.summary.activeProjects",
    iconBg: "rgba(34, 197, 94, 0.15)",
    ...CARD_SHAPES.right,
  },
  {
    value: "2",
    titleKey: "home.summary.emailSync",
    textKey: "home.summary.newEmails",
    iconBg: "rgba(245, 158, 11, 0.15)",
    ...CARD_SHAPES.left,
  },
  {
    value: "1",
    titleKey: "home.summary.workspace",
    textKey: "home.summary.enterActiveWorkspace",
    iconBg: "rgba(139, 92, 246, 0.15)",
    ...CARD_SHAPES.right,
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
        <MiniCard key={card.titleKey} showDeco={i === 0} card={card} val={dynamicValues[i]} delay={0.08 + i * 0.07} />
      ))}
    </div>
  );
}

interface MiniCardDef {
  value: string;
  titleKey: string;
  textKey: string;
  iconBg: string;
  transform: string;
  borderRadius: string;
}

function MiniCard({ card, val, delay, showDeco = false }: { card: MiniCardDef; val: string; delay: number; showDeco?: boolean }) {
  const { t } = useTranslation();
  const isSmall = val.length > 2;
  const ref = useRef<HTMLDivElement>(null);

  function handleMouseEnter() {
    if (ref.current) ref.current.style.boxShadow = "var(--shadow-xl)";
  }
  function handleMouseLeave() {
    if (ref.current) ref.current.style.boxShadow = "var(--shadow-md)";
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
        className="relative grid p-4.5 h-full mini-card"
        style={{
          alignContent: "space-between",
          borderRadius: card.borderRadius,
          transform: card.transform,
          boxShadow: "var(--shadow-md)",
        }}
      >
        {showDeco && <div className="mini-card__deco" />}

        <div className="flex items-start justify-between gap-3">
          <span className="mini-card__icon" style={{ background: card.iconBg }} />
          <span className={`font-bold leading-[0.9] mini-number ${isSmall ? "mini-number--sm" : "mini-number--lg"}`}>
            {val}
          </span>
        </div>

        <div>
          <p className="m-0 mini-title">{t(card.titleKey)}</p>
          <p className="m-0 mt-1.5 mini-text">{t(card.textKey)}</p>
        </div>
      </div>
    </motion.div>
  );
}
