import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Inbox, ChevronLeft, ChevronRight, ChevronDown, Plus, Clock, MapPin, AlertCircle, Phone, Focus, Coffee, Plane, Utensils, Dumbbell, Moon, Calendar } from "lucide-react";
import {
  format,
  startOfWeek,
  addDays,
  isSameDay,
  parseISO,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  differenceInMinutes,
  startOfDay,
  areIntervalsOverlapping,
} from "date-fns";
import type { ScheduleItem, ScheduleIcon } from "../../domain/schedule/types";

const ICON_MAP: Record<ScheduleIcon, typeof Clock> = {
  clock: Clock,
  meeting: Calendar,
  call: Phone,
  focus: Focus,
  break: Coffee,
  travel: Plane,
  meal: Utensils,
  exercise: Dumbbell,
  sleep: Moon,
};

interface CalendarViewProps {
  schedules: ScheduleItem[];
  onEditSchedule?: (schedule: ScheduleItem) => void;
  onAddSchedule?: (date?: Date) => void;
}

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
const MONTHS = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];

const TIMELINE_LEFT_WIDTH = 36;
const TIMELINE_RIGHT_WIDTH = 32;
const CARD_PADDING = 16;
const SLOT_HEIGHT = 32;
const HOURS_IN_DAY = 24;
const TOTAL_SLOTS = HOURS_IN_DAY * 2;
const TIMELINE_HEIGHT = TOTAL_SLOTS * SLOT_HEIGHT;
const NODE_SIZE = 32;

const PRIORITY_COLORS = {
  high: { bg: "rgba(239,68,68,0.12)", border: "#ef4444", text: "#dc2626", ring: "#fca5a5" },
  medium: { bg: "rgba(99,102,241,0.12)", border: "#6366f1", text: "#4f46e5", ring: "#a5b4fc" },
  low: { bg: "rgba(16,185,129,0.12)", border: "#10b981", text: "#059669", ring: "#6ee7b7" },
};

const GAP_MESSAGES = [
  "暂停结束。继续前进！",
  "间歇结束。接下来是什么？",
  "休息片刻。继续加油！",
  "空档时间。规划一下？",
];

function getGapMessage(index: number): string {
  return GAP_MESSAGES[index % GAP_MESSAGES.length];
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}分钟`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}小时${mins}分` : `${hours}小时`;
}

function getEndTime(startAt: string, durationMinutes: number): Date {
  const start = parseISO(startAt);
  return new Date(start.getTime() + durationMinutes * 60 * 1000);
}

export function CalendarView({ schedules, onEditSchedule, onAddSchedule }: CalendarViewProps) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<'day' | 'month'>('day');
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
  const [pickerMonth, setPickerMonth] = useState(new Date().getMonth());
  const pickerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const getSlotIndex = useCallback((date: Date): number => {
    const dayStart = startOfDay(selectedDate);
    const minutes = differenceInMinutes(date, dayStart);
    return Math.max(0, Math.min(Math.floor(minutes / 30), TOTAL_SLOTS - 1));
  }, [selectedDate]);

  const slotToTop = useCallback((slot: number): number => {
    return slot * SLOT_HEIGHT + CARD_PADDING;
  }, []);

  const topToSlot = useCallback((top: number): number => {
    return Math.max(0, Math.min(Math.floor((top - CARD_PADDING) / SLOT_HEIGHT), TOTAL_SLOTS - 1));
  }, []);

  const daySchedules = useMemo(() => {
    return schedules
      .filter((s) => {
        if (!s.startAt) return false;
        const start = parseISO(s.startAt);
        return isSameDay(start, selectedDate);
      })
      .sort((a, b) => parseISO(a.startAt).getTime() - parseISO(b.startAt).getTime());
  }, [schedules, selectedDate]);

  const scheduleOverlaps = useMemo(() => {
    const overlaps: { [key: string]: string[] } = {};
    for (let i = 0; i < daySchedules.length; i++) {
      for (let j = i + 1; j < daySchedules.length; j++) {
        const a = daySchedules[i];
        const b = daySchedules[j];
        const aStart = parseISO(a.startAt);
        const aEnd = getEndTime(a.startAt, a.durationMinutes);
        const bStart = parseISO(b.startAt);
        const bEnd = getEndTime(b.startAt, b.durationMinutes);
        if (areIntervalsOverlapping({ start: aStart, end: aEnd }, { start: bStart, end: bEnd })) {
          if (!overlaps[a.id]) overlaps[a.id] = [];
          if (!overlaps[b.id]) overlaps[b.id] = [];
          overlaps[a.id].push(b.id);
          overlaps[b.id].push(a.id);
        }
      }
    }
    return overlaps;
  }, [daySchedules]);

  const currentTimeSlot = useMemo(() => {
    const now = new Date();
    if (isSameDay(now, selectedDate)) {
      return getSlotIndex(now);
    }
    return -1;
  }, [selectedDate, getSlotIndex]);

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

  const handlePrevWeek = () => setSelectedDate(addDays(selectedDate, -7));
  const handleNextWeek = () => setSelectedDate(addDays(selectedDate, 7));

  const handleDaySelect = (day: Date) => {
    setSelectedDate(day);
    setShowDatePicker(false);
  };

  const handleMonthSelect = (month: number) => {
    setSelectedDate(new Date(pickerYear, month, selectedDate.getDate()));
    setPickerMode('day');
  };

  const handleYearChange = (delta: number) => {
    const newYear = pickerYear + delta;
    setPickerYear(newYear);
    if (selectedDate.getFullYear() === pickerYear) {
      setSelectedDate(new Date(newYear, selectedDate.getMonth(), selectedDate.getDate()));
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowDatePicker(false);
        setPickerMode('day');
      }
    };
    if (showDatePicker) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [showDatePicker]);

  useEffect(() => {
    setPickerYear(selectedDate.getFullYear());
    setPickerMonth(selectedDate.getMonth());
  }, [selectedDate]);

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('.event-capsule')) return;
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect) return;
    const y = e.clientY - rect.top;
    const slotIndex = topToSlot(y);
    const hours = Math.floor(slotIndex / 2);
    const minutes = (slotIndex % 2) * 30;
    const clickedDate = new Date(selectedDate);
    clickedDate.setHours(hours, minutes, 0, 0);
    onAddSchedule?.(clickedDate);
  };

  const timeSlots = useMemo(() => {
    const slots = [];
    for (let i = 0; i < 24; i++) {
      slots.push({
        hour: i,
        label: `${i.toString().padStart(2, '0')}:00`,
        keyTimes: i === 0 || daySchedules.some(s => {
          const startHour = parseISO(s.startAt).getHours();
          const endTime = getEndTime(s.startAt, s.durationMinutes);
          const endHour = endTime.getHours();
          return startHour === i || (endHour === i && endTime.getMinutes() > 0);
        }),
      });
    }
    return slots;
  }, [daySchedules]);

  return (
    <div className="flex flex-row w-full" style={{ minHeight: "calc(100vh - 48px)" }}>
      <div className="flex flex-col justify-center items-center w-64 lg:w-72 p-4 lg:p-5 shrink-0">
        <div className="space-y-6">
          <div className="flex flex-col items-center text-center gap-3">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: "rgba(99,102,241,0.1)" }}
            >
              <Inbox className="w-6 h-6" style={{ color: "#6366f1" }} />
            </div>
            <h3 className="text-sm font-semibold" style={{ color: "#1f2329" }}>
              日程助手
            </h3>
            <p className="text-xs leading-relaxed" style={{ color: "rgba(31,35,41,0.5)" }}>
              轻松掌控每一天的时间流向
            </p>
          </div>
        </div>

        <div className="space-y-2 mt-12">
          <button
            onClick={() => onAddSchedule?.(selectedDate)}
            className="py-2.5 px-4 rounded-xl text-white text-sm font-medium flex items-center justify-center gap-2 transition-all hover:brightness-110"
            style={{ background: "linear-gradient(135deg, #818cf8, #6366f1)", boxShadow: "0 4px 12px rgba(99,102,241,0.25)" }}
          >
            <Plus className="w-4 h-4" />
            添加日程
          </button>
        </div>
      </div>

      <div className="flex flex-col flex-1 min-w-0">
        <div className="px-4 py-3 lg:px-6 lg:py-4">
          <header className="flex items-center justify-between gap-3 mb-2 px-2">
            <div className="flex items-center gap-2">
              <div className="relative" ref={pickerRef}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDatePicker(!showDatePicker);
                  }}
                  className="flex items-center gap-1 text-base lg:text-xl font-bold tracking-tight transition-colors"
                  style={{ color: "#1f2329" }}
                >
                  {format(selectedDate, "yyyy年M月d日")}
                  <ChevronDown
                    className={`w-4 h-4 lg:w-5 lg:h-5 transition-transform ${showDatePicker ? 'rotate-180' : ''}`}
                    style={{ color: "rgba(31,35,41,0.5)" }}
                  />
                </button>

                <AnimatePresence>
                  {showDatePicker && (
                    <motion.div
                      initial={{ opacity: 0, y: -4, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.98 }}
                      transition={{ duration: 0.12 }}
                      className="absolute top-full left-0 mt-2 p-3 bg-white/95 backdrop-blur-xl rounded-xl shadow-lg border border-black/5 z-50 w-max"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {pickerMode === 'day' ? (
                        <>
                          <div className="flex items-center justify-between gap-4 mb-2">
                            <button
                              onClick={() => setPickerMode('month')}
                              className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md transition-colors"
                              style={{ color: "#6366f1", backgroundColor: "rgba(99,102,241,0.1)" }}
                            >
                              {pickerYear}年{MONTHS[pickerMonth]}
                              <ChevronDown className="w-3 h-3" />
                            </button>
                          </div>

                          <div className="grid grid-cols-7 gap-0.5 mb-1">
                            {WEEKDAYS.map((d) => (
                              <div key={d} className="text-center text-[10px] py-1" style={{ color: "rgba(31,35,41,0.5)" }}>
                                {d}
                              </div>
                            ))}
                          </div>

                          <div className="grid grid-cols-7 gap-0.5">
                            {weeks.slice(0, 6).map((week, wi) =>
                              week.map((day, di) => {
                                const isCurrentMonth = isSameMonth(day, monthStart);
                                const isSelected = isSameDay(day, selectedDate);
                                const isDayToday = isSameDay(day, new Date());
                                return (
                                  <button
                                    key={`${wi}-${di}`}
                                    onClick={() => handleDaySelect(day)}
                                    className="w-7 h-7 rounded-md text-xs font-medium transition-all"
                                    style={{
                                      backgroundColor: isSelected ? "#6366f1" : isDayToday ? "rgba(99,102,241,0.1)" : "transparent",
                                      color: isSelected ? "white" : isDayToday ? "#6366f1" : isCurrentMonth ? "#1f2329" : "rgba(31,35,41,0.3)",
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
                              style={{ color: "rgba(31,35,41,0.5)", backgroundColor: "rgba(99,102,241,0.06)" }}
                            >
                              <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="text-sm font-semibold" style={{ color: "#1f2329" }}>{pickerYear}年</span>
                            <button
                              onClick={() => handleYearChange(1)}
                              className="w-6 h-6 flex items-center justify-center rounded-md transition-colors"
                              style={{ color: "rgba(31,35,41,0.5)", backgroundColor: "rgba(99,102,241,0.06)" }}
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="grid grid-cols-4 gap-1">
                            {MONTHS.map((month, idx) => {
                              const isSelected = selectedDate.getMonth() === idx && pickerYear === selectedDate.getFullYear();
                              return (
                                <button
                                  key={month}
                                  onClick={() => handleMonthSelect(idx)}
                                  className="px-2 py-1.5 text-xs font-medium rounded-md transition-all"
                                  style={{
                                    backgroundColor: isSelected ? "#6366f1" : "rgba(99,102,241,0.06)",
                                    color: isSelected ? "white" : "#1f2329",
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
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <div className="flex items-center rounded-lg p-0.5" style={{ backgroundColor: "rgba(255,255,255,0.6)", backdropFilter: "blur(8px)" }}>
                <button
                  onClick={handlePrevWeek}
                  className="w-7 h-7 rounded-md flex items-center justify-center transition-colors"
                  style={{ color: "rgba(31,35,41,0.5)" }}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setSelectedDate(new Date())}
                  className="px-2 h-7 rounded-md text-xs font-medium transition-colors"
                  style={{ color: "#6366f1" }}
                >
                  今天
                </button>
                <button
                  onClick={handleNextWeek}
                  className="w-7 h-7 rounded-md flex items-center justify-center transition-colors"
                  style={{ color: "rgba(31,35,41,0.5)" }}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </header>

          <div className="grid grid-cols-7 gap-1 px-2">
            {Array.from({ length: 7 }, (_, i) => {
              const day = addDays(startOfWeek(selectedDate, { weekStartsOn: 0 }), i);
              const daySchedulesCount = schedules.filter((s) => {
                if (!s.startAt) return false;
                const start = parseISO(s.startAt);
                return isSameDay(start, day);
              }).length;
              const isActive = isSameDay(day, selectedDate);
              const isDayToday = isSameDay(day, new Date());

              return (
                <button
                  key={i}
                  onClick={() => handleDaySelect(day)}
                  className="flex flex-col items-center py-1.5 transition-all"
                >
                  <span
                    className="text-[10px] font-medium mb-0.5"
                    style={{ color: "rgba(31,35,41,0.5)" }}
                  >
                    周{WEEKDAYS[i]}
                  </span>
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold transition-all"
                    style={{
                      color: isActive || isDayToday ? "white" : "#1f2329",
                      backgroundColor: isActive || isDayToday ? "#6366f1" : "transparent"
                    }}
                  >
                    {format(day, "d")}
                  </div>
                  <div className="flex items-center gap-0.5 h-3 mt-0.5">
                    {daySchedulesCount > 0 && (
                      <>
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: isActive || isDayToday ? "rgba(255,255,255,0.9)" : "#6366f1" }}
                        />
                        {daySchedulesCount > 1 && (
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: isActive || isDayToday ? "rgba(255,255,255,0.5)" : "rgba(99,102,241,0.5)" }}
                          />
                        )}
                      </>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 flex flex-col px-4 pb-4 lg:px-6 lg:pb-6">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex-1 rounded-3xl overflow-hidden px-12"
            style={{
              backgroundColor: "rgba(255,255,255,0.95)",
              boxShadow: "0 4px 24px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
              maxHeight: "calc(100vh - 200px)",
              overflowY: "auto",
            }}
          >
            <div className="h-6 flex items-center justify-center pt-1 cursor-grab active:cursor-grabbing">
              <div className="w-10 h-1 rounded-full" style={{ backgroundColor: "rgba(0,0,0,0.1)" }} />
            </div>

            <div className="flex" style={{ height: TIMELINE_HEIGHT + CARD_PADDING * 2 }}>
              <div
                className="shrink-0 flex flex-col py-4"
                style={{ width: TIMELINE_LEFT_WIDTH, height: TIMELINE_HEIGHT + CARD_PADDING * 2 }}
              >
                {timeSlots.map(({ hour, label, keyTimes }) => (
                  <div
                    key={hour}
                    className="flex items-start justify-end pr-3 relative"
                    style={{ height: SLOT_HEIGHT * 2 }}
                  >
                    {keyTimes && (
                      <span
                        className="text-[11px] font-medium shrink-0"
                        style={{
                          color: hour === 0 ? "rgba(99,102,241,0.6)" : "rgba(31,35,41,0.4)",
                          fontWeight: hour === 0 ? "600" : "400",
                        }}
                      >
                        {label}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <div
                className="flex-1 relative cursor-pointer"
                ref={timelineRef}
                onClick={handleTimelineClick}
              >
                <div
                  className="absolute w-0.5 h-full"
                  style={{
                    left: TIMELINE_LEFT_WIDTH,
                    background: "linear-gradient(180deg, transparent 0%, rgba(99,102,241,0.2) 5%, rgba(99,102,241,0.2) 95%, transparent 100%)",
                  }}
                />

                {currentTimeSlot >= 0 && (
                  <div
                    className="absolute right-0 flex items-center z-20 pointer-events-none"
                    style={{ top: slotToTop(currentTimeSlot), left: TIMELINE_LEFT_WIDTH }}
                  >
                    <div className="flex-1 h-0.5" style={{ backgroundColor: "#ef4444" }} />
                    <span className="text-[10px] font-medium text-red-500 mr-2 -mt-3">
                      {format(new Date(), "HH:mm")}
                    </span>
                  </div>
                )}

                {daySchedules.length === 0 ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div
                      className="w-16 h-16 rounded-full flex items-center justify-center mb-3"
                      style={{ backgroundColor: "rgba(99,102,241,0.08)" }}
                    >
                      <Clock className="w-8 h-8" style={{ color: "rgba(99,102,241,0.4)" }} />
                    </div>
                    <p className="text-sm font-medium" style={{ color: "rgba(31,35,41,0.4)" }}>
                      今天没有日程安排
                    </p>
                    <p className="text-xs mt-1" style={{ color: "rgba(31,35,41,0.3)" }}>
                      点击时间轴添加第一个日程
                    </p>
                  </div>
                ) : (
                  <div className="absolute inset-0 -left-[24px]">
                    {daySchedules.map((schedule, index) => {
                      const startDate = parseISO(schedule.startAt);
                      const endDate = getEndTime(schedule.startAt, schedule.durationMinutes);
                      const startSlot = getSlotIndex(startDate);
                      const endSlot = getSlotIndex(endDate);
                      const durationSlots = Math.max(endSlot - startSlot, 1);
                      const colors = PRIORITY_COLORS[schedule.priority];
                      const IconComponent = ICON_MAP[schedule.icon] || Clock;
                      const hasOverlap = scheduleOverlaps[schedule.id]?.length > 0;
                      const overlappingIds = scheduleOverlaps[schedule.id] || [];
                      const startTop = slotToTop(startSlot);
                      const nodeHeight = durationSlots * SLOT_HEIGHT;
                      const nodeWidth = NODE_SIZE;
                      const nodeTop = startTop - nodeHeight / 2;
                      const prevEndSlot = index > 0 ? getSlotIndex(getEndTime(daySchedules[index - 1].startAt, daySchedules[index - 1].durationMinutes)) : 0;
                      const isDashed = index > 0 && (startSlot - prevEndSlot) > 1;

                      return (
                        <div key={schedule.id}>
                          {index > 0 && (
                            <div
                              className="absolute flex flex-col items-center"
                              style={{
                                top: slotToTop(prevEndSlot),
                                height: startTop - slotToTop(prevEndSlot),
                                width: 2,
                                left: TIMELINE_LEFT_WIDTH + 24,
                              }}
                            >
                              <div
                                className="w-px flex-1"
                                style={{
                                  background: isDashed
                                    ? "repeating-linear-gradient(180deg, rgba(99,102,241,0.25) 0, rgba(99,102,241,0.25) 4px, transparent 4px, transparent 8px)"
                                    : "linear-gradient(180deg, rgba(99,102,241,0.25) 0%, rgba(99,102,241,0.25) 100%)",
                                  left: TIMELINE_LEFT_WIDTH + 8,
                                }}
                              />
                              {isDashed && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.9 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  transition={{ delay: 0.1 }}
                                  className="px-2 py-0.5 rounded text-[10px] whitespace-nowrap"
                                  style={{
                                    backgroundColor: "rgba(99,102,241,0.08)",
                                    color: "rgba(99,102,241,0.7)",
                                    left: TIMELINE_LEFT_WIDTH + 8
                                  }}
                                >
                                  {getGapMessage(index - 1)}
                                </motion.div>
                              )}
                            </div>
                          )}

                          <motion.button
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.2, delay: index * 0.05 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditSchedule?.(schedule);
                            }}
                            className="event-capsule absolute cursor-pointer transition-all hover:brightness-95 active:scale-95"
                            style={{
                              top: nodeTop,
                              height: nodeHeight,
                              width: nodeWidth,
                              left: TIMELINE_LEFT_WIDTH + 8,
                            }}
                          >
                            <div
                              className="w-full h-full rounded-full flex items-center justify-center"
                              style={{
                                backgroundColor: colors.bg,
                                border: `2px solid ${colors.border}`,
                                boxShadow: `0 0 0 4px ${colors.ring}`,
                              }}
                            >
                              <IconComponent className="w-4 h-4" style={{ color: colors.text }} />
                            </div>
                            {hasOverlap && (
                              <div
                                className="absolute -top-1 -right-1 w-3 h-3 rounded-full flex items-center justify-center"
                                style={{ backgroundColor: "#ef4444" }}
                              >
                                <AlertCircle className="w-2 h-2 text-white" />
                              </div>
                            )}
                          </motion.button>

                          <div
                            className="absolute left-20 right-4 flex flex-col justify-center"
                            style={{ top: nodeTop, height: nodeHeight }}
                          >
                            <div className="flex items-center gap-2">
                              <h4
                                className="text-sm font-semibold truncate"
                                style={{ color: "#1f2329" }}
                              >
                                {schedule.title}
                              </h4>
                              {hasOverlap && (
                                <span
                                  className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium shrink-0"
                                  style={{ backgroundColor: "rgba(239,68,68,0.1)", color: "#ef4444" }}
                                >
                                  <AlertCircle className="w-3 h-3" />
                                  重叠
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[11px]" style={{ color: colors.text }}>
                                {formatDuration(schedule.durationMinutes)}
                              </span>
                              {schedule.location && (
                                <div className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3" style={{ color: "rgba(31,35,41,0.3)" }} />
                                  <span className="text-[10px] truncate" style={{ color: "rgba(31,35,41,0.45)" }}>
                                    {schedule.location}
                                  </span>
                                </div>
                              )}
                            </div>
                            {hasOverlap && (
                              <div
                                className="mt-1 px-2 py-0.5 rounded text-[10px]"
                                style={{ backgroundColor: "rgba(239,68,68,0.08)", color: "rgba(239,68,68,0.7)" }}
                              >
                                与 {overlappingIds.length} 个日程重叠
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div
                className="shrink-0 flex flex-col items-center py-4"
                style={{ width: TIMELINE_RIGHT_WIDTH }}
              >
                {daySchedules.length === 0 ? (
                  <div
                    className="w-6 h-6 rounded-full"
                    style={{ border: "2px solid rgba(99,102,241,0.2)" }}
                  />
                ) : (
                  daySchedules.map((schedule, index) => {
                    const colors = PRIORITY_COLORS[schedule.priority];
                    const hasOverlap = scheduleOverlaps[schedule.id]?.length > 0;
                    const startSlot = getSlotIndex(parseISO(schedule.startAt));
                    const endSlot = getSlotIndex(getEndTime(schedule.startAt, schedule.durationMinutes));
                    const durationSlots = Math.max(endSlot - startSlot, 1);
                    const nodeHeight = durationSlots * SLOT_HEIGHT;
                    const nodeTop = slotToTop(startSlot) - nodeHeight / 2;
                    return (
                      <motion.div
                        key={schedule.id}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.2, delay: index * 0.05 + 0.1 }}
                        className="flex items-center justify-center"
                        style={{ height: nodeHeight, marginTop: index === 0 ? nodeTop : 0 }}
                      >
                        <div
                          className={`w-6 h-6 rounded-full ${hasOverlap ? 'animate-pulse' : ''}`}
                          style={{
                            border: `2px solid ${hasOverlap ? '#ef4444' : colors.ring}`,
                            backgroundColor: hasOverlap ? 'rgba(239,68,68,0.1)' : 'transparent',
                          }}
                        />
                      </motion.div>
                    );
                  })
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}