import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronDown, ChevronRight } from "lucide-react";
import {
  format,
  startOfWeek,
  addDays,
  isSameDay,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
} from "date-fns";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
const MONTHS = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];

interface DatePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  onClose?: () => void;
}

export function DatePicker({ value, onChange, onClose }: DatePickerProps) {
  const [pickerMode, setPickerMode] = useState<'day' | 'month'>('day');
  const [pickerYear, setPickerYear] = useState(value.getFullYear());
  const [pickerMonth] = useState(value.getMonth());

  const monthStart = startOfMonth(new Date(pickerYear, pickerMonth));
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = startOfWeek(monthEnd, { weekStartsOn: 0 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: addDays(calendarEnd, 41) });

  const weeks = useMemo(() => {
    const result: Date[][] = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      result.push(calendarDays.slice(i, i + 7));
    }
    return result;
  }, [calendarDays]);

  const handleDaySelect = (day: Date) => {
    onChange(day);
    onClose?.();
  };

  const handleMonthSelect = (month: number) => {
    onChange(new Date(pickerYear, month, value.getDate()));
    setPickerMode('day');
  };

  const handleYearChange = (delta: number) => {
    const newYear = pickerYear + delta;
    setPickerYear(newYear);
    if (value.getFullYear() === pickerYear) {
      onChange(new Date(newYear, value.getMonth(), value.getDate()));
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -4, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.98 }}
      transition={{ duration: 0.12 }}
      className="absolute top-full left-0 mt-2 p-3 rounded-xl shadow-lg border z-[60] w-max"
      style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)", backdropFilter: "blur(16px)" }}
      onClick={(e) => e.stopPropagation()}
    >
      {pickerMode === 'day' ? (
        <>
          <div className="flex items-center justify-between gap-4 mb-2">
            <button
              onClick={() => setPickerMode('month')}
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md transition-colors"
              style={{ color: "var(--color-primary)", backgroundColor: "color-mix(in srgb, var(--color-primary) 10%, transparent)" }}
            >
              {pickerYear}年{MONTHS[pickerMonth]}
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {WEEKDAYS.map((d) => (
              <div key={d} className="text-center text-[10px] py-1" style={{ color: "var(--color-text-secondary)" }}>
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {weeks.slice(0, 6).map((week, wi) =>
              week.map((day, di) => {
                const isCurrentMonth = isSameMonth(day, monthStart);
                const isSelected = isSameDay(day, value);
                const isDayToday = isSameDay(day, new Date());
                return (
                  <button
                    key={`${wi}-${di}`}
                    onClick={() => handleDaySelect(day)}
                    className="w-7 h-7 rounded-md text-xs font-medium transition-all"
                    style={{
                      backgroundColor: isSelected ? "var(--color-primary)" : isDayToday ? "color-mix(in srgb, var(--color-primary) 10%, transparent)" : "transparent",
                      color: isSelected ? "white" : isDayToday ? "var(--color-primary)" : isCurrentMonth ? "var(--color-text)" : "var(--color-text-muted)",
                    }}
                  >
                    {format(day, "d")}
                  </button>
                );
              })
            )}
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between gap-4 mb-2">
            <button
              onClick={() => handleYearChange(-1)}
              className="w-6 h-6 flex items-center justify-center rounded-md transition-colors"
              style={{ color: "var(--color-text-secondary)", backgroundColor: "color-mix(in srgb, var(--color-primary) 6%, transparent)" }}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>{pickerYear}年</span>
            <button
              onClick={() => handleYearChange(1)}
              className="w-6 h-6 flex items-center justify-center rounded-md transition-colors"
              style={{ color: "var(--color-text-secondary)", backgroundColor: "color-mix(in srgb, var(--color-primary) 6%, transparent)" }}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-4 gap-1">
            {MONTHS.map((month, idx) => {
              const isSelected = value.getMonth() === idx && pickerYear === value.getFullYear();
              return (
                <button
                  key={month}
                  onClick={() => handleMonthSelect(idx)}
                  className="px-2 py-1.5 text-xs font-medium rounded-md transition-all"
                  style={{
                    backgroundColor: isSelected ? "var(--color-primary)" : "color-mix(in srgb, var(--color-primary) 6%, transparent)",
                    color: isSelected ? "white" : "var(--color-text)",
                  }}
                >
                  {month}
                </button>
              );
            })}
          </div>
        </>
      )}
    </motion.div>
  );
}
