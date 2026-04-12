import { format, isToday, isTomorrow, isYesterday, differenceInHours } from "date-fns";
import { zhCN, enUS } from "date-fns/locale";
import i18n from "../../i18n";
import { getStoredSettings } from "../services/settingsService";

const DATE_FORMAT_MAP: Record<string, string> = {
  "YYYY-MM-DD": "yyyy-MM-dd",
  "MM/DD/YYYY": "MM/dd/yyyy",
  "DD/MM/YYYY": "dd/MM/yyyy",
};

function getLocale() {
  const lang = i18n.language || "zh";
  return lang.startsWith("zh") ? zhCN : enUS;
}

function getDateFormat(): string {
  const settings = getStoredSettings();
  return DATE_FORMAT_MAP[settings.dateFormat] || "yyyy-MM-dd";
}

function getTimeFormat(): string {
  const settings = getStoredSettings();
  return settings.timeFormat === "hh:mm A" ? "hh:mm a" : "HH:mm";
}

export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, getDateFormat(), { locale: getLocale() });
}

export function formatTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, getTimeFormat(), { locale: getLocale() });
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, `${getDateFormat()} ${getTimeFormat()}`, { locale: getLocale() });
}

export function getRelativeDateLabel(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const isZh = i18n.language.startsWith("zh");

  if (isToday(d)) return isZh ? "今天" : "Today";
  if (isTomorrow(d)) return isZh ? "明天" : "Tomorrow";
  if (isYesterday(d)) return isZh ? "昨天" : "Yesterday";

  return format(d, isZh ? "M月d日" : "MMM d", { locale: getLocale() });
}

export function getGreeting(): string {
  const hour = new Date().getHours();
  const isZh = i18n.language.startsWith("zh");

  if (hour < 6) return isZh ? "夜深了" : "Good night";
  if (hour < 9) return isZh ? "早上好" : "Good morning";
  if (hour < 12) return isZh ? "上午好" : "Good morning";
  if (hour < 14) return isZh ? "中午好" : "Good afternoon";
  if (hour < 18) return isZh ? "下午好" : "Good afternoon";
  return isZh ? "晚上好" : "Good evening";
}

export function getCurrentTimeString(): string {
  return format(new Date(), getTimeFormat(), { locale: getLocale() });
}

export function getCurrentDateString(): string {
  const now = new Date();
  const isZh = i18n.language.startsWith("zh");
  const locale = getLocale();
  const dateFormat = getDateFormat();

  if (isZh) {
    const weekDays = ["日", "一", "二", "三", "四", "五", "六"];
    const weekDay = weekDays[now.getDay()];
    const formatted = format(now, dateFormat, { locale });
    return `${formatted} 星期${weekDay}`;
  } else {
    const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const weekDay = weekDays[now.getDay()];
    const formatted = format(now, dateFormat, { locale });
    return `${formatted} ${weekDay}`;
  }
}

export function isUpcoming(date: string | Date, hours: number = 2): boolean {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diff = differenceInHours(d, now);
  return diff >= 0 && diff <= hours;
}

export function sortByDate<T extends { startAt?: string; dueAt?: string; receivedAt?: string }>(
  items: T[],
  key: "startAt" | "dueAt" | "receivedAt" = "startAt"
): T[] {
  return [...items].sort((a, b) => {
    const dateA = a[key] ? new Date(a[key]!).getTime() : 0;
    const dateB = b[key] ? new Date(b[key]!).getTime() : 0;
    return dateA - dateB;
  });
}

export function filterTodayItems<T extends { startAt?: string; dueAt?: string }>(
  items: T[],
  key: "startAt" | "dueAt" = "startAt"
): T[] {
  return items.filter(item => {
    if (!item[key]) return false;
    const date = new Date(item[key]!);
    return isToday(date);
  });
}
