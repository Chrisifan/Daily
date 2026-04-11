import { Link, useLocation } from "react-router-dom";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";

// SVG 图标
const IconHome = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/>
    <polyline points="9 21 9 13 15 13 15 21"/>
  </svg>
);
const IconSchedule = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
    <line x1="8" y1="15" x2="8" y2="15" strokeWidth="2.5"/>
    <line x1="12" y1="15" x2="12" y2="15" strokeWidth="2.5"/>
    <line x1="16" y1="15" x2="16" y2="15" strokeWidth="2.5"/>
  </svg>
);
const IconWorkspace = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1"/>
    <rect x="14" y="3" width="7" height="7" rx="1"/>
    <rect x="3" y="14" width="7" height="7" rx="1"/>
    <rect x="14" y="14" width="7" height="7" rx="1"/>
  </svg>
);
const IconIntegrations = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="5" r="3"/>
    <circle cx="6" cy="12" r="3"/>
    <circle cx="18" cy="19" r="3"/>
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
  </svg>
);

const IconSettings = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);

function TrafficLights() {
  const { t } = useTranslation();
  const handleClose = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    await getCurrentWindow().close();
  }, []);

  const handleMinimize = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    await getCurrentWindow().minimize();
  }, []);

  const handleMaximize = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    await getCurrentWindow().toggleMaximize();
  }, []);

  const buttons = [
    { color: "#ff5f57", icon: "✕", action: handleClose,  title: t("common.close") },
    { color: "#ffbd2e", icon: "−", action: handleMinimize, title: t("common.minimize") },
    { color: "#28c840", icon: "⤢", action: handleMaximize, title: t("common.maximize") },
  ];

  return (
    <div className="traffic-lights">
      {buttons.map((btn, i) => (
        <button
          key={i}
          onClick={btn.action}
          title={btn.title}
          className="traffic-btn"
          style={{ background: btn.color }}
        >
          <span className="traffic-btn__icon">{btn.icon}</span>
        </button>
      ))}
    </div>
  );
}

interface AppNavProps {
  onSettingsClick?: () => void;
}

export function AppNav({ onSettingsClick }: AppNavProps) {
  const { t } = useTranslation();
  const location = useLocation();

  const isActive = (to: string) =>
    to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);

  const NAV_LINKS = [
    { label: t("nav.home"),         to: "/",            Icon: IconHome },
    { label: t("nav.schedule"),      to: "/schedule",    Icon: IconSchedule },
    { label: t("nav.workspace"),    to: "/workspaces",  Icon: IconWorkspace },
    { label: t("nav.integrations"), to: "/integrations", Icon: IconIntegrations },
  ];

  return (
    <div className="nav-root">
      <div className="nav-traffic-row" data-tauri-drag-region>
        <TrafficLights />
      </div>

      <header className="nav-header" data-tauri-drag-region>
        <Link to="/" className="nav-brand">
          <span className="nav-brand__badge">D</span>
          <span className="nav-brand__name">Daily</span>
        </Link>

        <nav className="nav-capsule">
          {NAV_LINKS.map(({ label, to, Icon }) => {
            const active = isActive(to);
            return (
              <Link
                key={to}
                to={to}
                className={`nav-link${active ? " nav-link--active" : ""}`}
                data-tooltip={label}
              >
                <Icon />
              </Link>
            );
          })}
          <button
            onClick={onSettingsClick}
            className="nav-link"
            data-tooltip={t("nav.settings")}
          >
            <IconSettings />
          </button>
        </nav>
      </header>
    </div>
  );
}
