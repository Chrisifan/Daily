import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { getGreeting, getCurrentTimeString, getCurrentDateString } from "../../shared/utils/date";
import type { WeatherSnapshot } from "../../domain/weather/types";
import type { WeatherStatus } from "../../shared/hooks/useWeather";

interface MainCardProps {
  weather: WeatherSnapshot;
  weatherStatus?: WeatherStatus;
  onRefresh?: () => void;
}

const METRICS = [
  { value: "3",  label: "笔记" },
  { value: "1",  label: "今日日志" },
  { value: "13", label: "项目" },
  { value: "3",  label: "待办" },
  { value: "1",  label: "工作时间" },
];

const METRIC_BG = [
  "rgba(246,219,150,0.42)",
  "rgba(170,212,255,0.42)",
  "rgba(187,233,194,0.44)",
  "rgba(255,205,214,0.48)",
  "rgba(228,205,255,0.44)",
];

export function MainCard({ weather, weatherStatus = "success", onRefresh }: MainCardProps) {
  const [currentTime, setCurrentTime] = useState(getCurrentTimeString());
  const greeting = getGreeting();
  const currentDate = getCurrentDateString();
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(getCurrentTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  // tilt-card 3D 鼠标交互（对齐 home.js）
  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const ry = (x - 0.5) * 5;
    const rx = (0.5 - y) * 5;
    el.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-2px)`;
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
      transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
    >
      {/* hero-card */}
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="relative overflow-hidden h-full grid p-6 gap-4 glass-card hero-card"
      >
        {/* orb 装饰 */}
        <div className="hero-orb hero-orb--one" />
        <div className="hero-orb hero-orb--two" />
  
        {/* 行 1: eyebrow + 标题 + 日期 */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <p className="m-0 eyebrow">
              {weather.city} · {weather.description}模式
            </p>
            {weatherStatus === "locating" && (
              <span className="weather-status-hint">定位中…</span>
            )}
            {weatherStatus === "fetching" && (
              <span className="weather-status-hint">获取天气…</span>
            )}
            {weatherStatus === "error" && onRefresh && (
              <button onClick={onRefresh} title="重新获取天气" className="btn-retry">
                重试
              </button>
            )}
            {weatherStatus === "success" && onRefresh && (
              <button
                onClick={onRefresh}
                title="刷新天气"
                className="btn-refresh"
              >
                ↻
              </button>
            )}
          </div>
          <h1 className="m-0 font-bold leading-[0.98] hero-title">
            {greeting}，Sifan.
          </h1>
          <p className="m-0 mt-1 text-sm hero-subtitle">{currentDate}</p>
        </div>
  
        {/* 行 2: metric-strip 5列 */}
        <div className="metric-strip">
          {METRICS.map((item, i) => (
            <div
              key={item.label}
              className="metric-item"
              style={{ background: METRIC_BG[i] }}
            >
              <span className="metric-value">{item.value}</span>
              <span className="metric-label">{item.label}</span>
            </div>
          ))}
        </div>
  
        {/* 行 3 (1fr): 大时钟 + 副文 */}
        <div className="flex flex-col justify-end">
          <p className="m-0 font-bold leading-[0.88] display-time">{currentTime}</p>
          <p className="m-0 mt-1 text-sm hero-subtitle">
            当前位置天气会驱动首页风景与提示策略
          </p>
        </div>
  
        {/* 行 4: 操作按钮 */}
        <div className="flex items-center gap-2.5">
          <button className="text-sm font-medium text-white px-4 py-2.5 btn-primary">
            进入工作台
          </button>
          <button className="text-sm font-medium px-4 py-2.5 btn-secondary">
            查看概览
          </button>
        </div>
      </div>
    </motion.div>
  );
}
