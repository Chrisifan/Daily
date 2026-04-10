import { format, isToday, isTomorrow, isYesterday, differenceInHours } from "date-fns";
import { zhCN } from "date-fns/locale";

export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "yyyy年MM月dd日", { locale: zhCN });
}

export function formatTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "HH:mm", { locale: zhCN });
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "MM月dd日 HH:mm", { locale: zhCN });
}

export function getRelativeDateLabel(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  
  if (isToday(d)) return "今天";
  if (isTomorrow(d)) return "明天";
  if (isYesterday(d)) return "昨天";
  
  return format(d, "MM月dd日", { locale: zhCN });
}

export function getGreeting(): string {
  const hour = new Date().getHours();
  
  if (hour < 6) return "夜深了";
  if (hour < 9) return "早上好";
  if (hour < 12) return "上午好";
  if (hour < 14) return "中午好";
  if (hour < 18) return "下午好";
  return "晚上好";
}

export function getCurrentTimeString(): string {
  return format(new Date(), "HH:mm");
}

export function getCurrentDateString(): string {
  const now = new Date();
  const weekDays = ["日", "一", "二", "三", "四", "五", "六"];
  const weekDay = weekDays[now.getDay()];
  return format(now, `yyyy年MM月dd日 星期${weekDay}`, { locale: zhCN });
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
