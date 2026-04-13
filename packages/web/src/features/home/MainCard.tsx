import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { getGreeting, getCurrentTimeString, getCurrentDateString } from "../../shared/utils/date";
import type { WeatherSnapshot } from "../../domain/weather/types";
import type { WeatherStatus } from "../../shared/hooks/useWeather";
import { WeatherBackground } from "../../shared/ui/WeatherBackground";

interface MainCardProps {
  weather: WeatherSnapshot;
  weatherStatus?: WeatherStatus;
  onRefresh?: () => void;
  onOpenSettings?: () => void;
}

const METRIC_KEYS = ["home.metrics.notes", "home.metrics.todayLog", "home.metrics.projects", "home.metrics.todos", "home.metrics.workHours"] as const;
const METRIC_VALUES = ["3", "1", "13", "3", "1"];

const METRIC_STYLES = [
  { bg: "rgba(63, 86, 214, 0.08)", border: "rgba(63, 86, 214, 0.15)", text: "var(--color-primary)" },
  { bg: "rgba(34, 197, 94, 0.08)", border: "rgba(34, 197, 94, 0.15)", text: "var(--color-success)" },
  { bg: "rgba(245, 158, 11, 0.08)", border: "rgba(245, 158, 11, 0.15)", text: "var(--color-warning)" },
  { bg: "rgba(239, 68, 68, 0.08)", border: "rgba(239, 68, 68, 0.15)", text: "var(--color-error)" },
  { bg: "rgba(59, 130, 246, 0.08)", border: "rgba(59, 130, 246, 0.15)", text: "var(--color-info)" },
];

export function MainCard({ weather, weatherStatus = "success", onRefresh, onOpenSettings }: MainCardProps) {
  const { t } = useTranslation();
  const [currentTime, setCurrentTime] = useState(getCurrentTimeString());
  const greeting = getGreeting();
  const currentDate = getCurrentDateString();
  const cardRef = useRef<HTMLDivElement>(null);

  const isUnconfigured = weatherStatus === "unconfigured";

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(getCurrentTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const ry = (x - 0.5) * 5;
    const rx = (0.5 - y) * 5;
    el.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-2px)`;
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
      transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="relative overflow-hidden h-full grid p-5 gap-5 hero-card"
      >
        <div
          className="hero-card__atmosphere"
          data-weather-condition={weather.condition}
          aria-hidden="true"
        >
          <div className="hero-card__weather">
            <WeatherBackground condition={weather.condition} />
          </div>
        </div>
  
        <div className="relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              {isUnconfigured ? (
                <button 
                  onClick={onOpenSettings}
                  className="m-0 eyebrow"
                  style={{ 
                    color: "var(--color-primary)", 
                    cursor: "pointer",
                    textDecoration: "underline",
                    background: "none",
                    border: "none",
                    padding: 0,
                    font: "inherit"
                  }}
                >
                  {t("home.weather.needsLocation")}
                </button>
              ) : (
                <p className="m-0 eyebrow">
                  {weather.city} · {t(weather.description)}
                </p>
              )}
              {weatherStatus === "locating" && (
                <span className="weather-status-hint">{t("home.weather.locating")}</span>
              )}
              {weatherStatus === "fetching" && (
                <span className="weather-status-hint">{t("home.weather.fetching")}</span>
              )}
              {weatherStatus === "error" && onRefresh && (
                <button onClick={onRefresh} title={t("home.weather.retry")} className="btn-retry">
                  {t("home.weather.retry")}
                </button>
              )}
              {weatherStatus === "success" && onRefresh && !isUnconfigured && (
                <button
                  onClick={onRefresh}
                  title={t("home.weather.refresh")}
                  className="btn-refresh"
                >
                  ↻
                </button>
              )}
            </div>
            <h1 className="m-0 font-bold leading-[0.98] hero-title">
              {greeting}, Sifan
            </h1>
          </div>
  
          <div className="metric-strip mt-6">
            {METRIC_KEYS.map((key, i) => (
              <div
                key={key}
                className="metric-item"
                style={{ 
                  background: METRIC_STYLES[i].bg,
                  borderColor: METRIC_STYLES[i].border
                }}
              >
                <span className="metric-value" style={{ color: METRIC_STYLES[i].text }}>{METRIC_VALUES[i]}</span>
                <span className="metric-label">{t(key)}</span>
              </div>
            ))}
          </div>
  
          <div className="absolute top-3 right-4 text-right">
            <p className="m-0 font-bold leading-[0.88] text-3xl md:text-4xl" style={{ color: "var(--color-text)" }}>{currentTime}</p>
            <p className="m-0 mt-1 mb-3 text-xs hero-subtitle">{currentDate}</p>
          </div>
  
          <div className="flex items-center gap-2 mt-4">
            <button className="text-xs font-medium text-white px-3 py-1.5 btn-primary">
              {t("home.actions.enterWorkspace")}
            </button>
            <button className="text-xs font-medium px-3 py-1.5 btn-secondary">
              {t("home.actions.viewOverview")}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
