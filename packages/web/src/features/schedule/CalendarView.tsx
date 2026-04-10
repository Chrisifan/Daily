import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Inbox, ChevronLeft, ChevronRight, ChevronDown, Plus, Clock, MapPin, AlertCircle, Phone, Focus, Coffee, Plane, Utensils, Dumbbell, Moon, Calendar } from "lucide-react";
import {
  format,
  startOfWeek,
  addDays,
  isSameDay,
  parseISO,
  differenceInMinutes,
  startOfDay,
  areIntervalsOverlapping,
} from "date-fns";
import type { ScheduleItem, ScheduleIcon } from "../../domain/schedule/types";
import { DatePicker } from "../../shared/ui/DatePicker";

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

const CARD_PADDING = 16;
const SLOT_HEIGHT = 32;
const HOURS_IN_DAY = 24;
const TOTAL_SLOTS = HOURS_IN_DAY * 2;
const NODE_SIZE = 32;

const PRIORITY_COLORS = {
  high: { bg: "rgba(239,68,68,0.85)", border: "#ef4444", text: "#dc2626", ring: "#fca5a5", zIndex: 50 },
  medium: { bg: "rgba(251,191,36,0.85)", border: "#f59e0b", text: "#d97706", ring: "#fcd34d", zIndex: 40 },
  low: { bg: "rgba(16,185,129,0.85)", border: "#10b981", text: "#059669", ring: "#6ee7b7", zIndex: 30 },
};

function getEndTime(startAt: string, durationMinutes: number): Date {
  const start = parseISO(startAt);
  return new Date(start.getTime() + durationMinutes * 60 * 1000);
}

function formatEndTime(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  if (hours === 0 && minutes === 0) {
    return '24:00';
  }
  return format(date, 'HH:mm');
}

export function CalendarView({ schedules, onEditSchedule, onAddSchedule }: CalendarViewProps) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [completedSchedules, setCompletedSchedules] = useState<Set<string>>(new Set());
  const [now, setNow] = useState<Date>(new Date());
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

  const LONG_SCHEDULE_THRESHOLD_HOURS = 2;
  const MAX_GAP_SLOTS = LONG_SCHEDULE_THRESHOLD_HOURS * 2;

  const daySchedules = useMemo(() => {
    return schedules
      .filter((s) => {
        if (!s.startAt) return false;
        const start = parseISO(s.startAt);
        return isSameDay(start, selectedDate);
      })
      .sort((a, b) => parseISO(a.startAt).getTime() - parseISO(b.startAt).getTime());
  }, [schedules, selectedDate]);

  const compressedSlotMap = useMemo(() => {
    const map: { [key: string]: number } = {};
    let cumulativeCompressionSlots = 0;
    const VIRTUAL_START_SLOT = 0;
    const VIRTUAL_END_SLOT = TOTAL_SLOTS;
    const MIN_GAP_PIXELS = 24;
    let prevEndSlot = VIRTUAL_START_SLOT;

    daySchedules.forEach((schedule) => {
      const currStartSlot = getSlotIndex(parseISO(schedule.startAt));
      const gapSlots = currStartSlot - prevEndSlot;
      const gapPixels = gapSlots * SLOT_HEIGHT;

      if (gapSlots > MAX_GAP_SLOTS) {
        cumulativeCompressionSlots += gapSlots - MAX_GAP_SLOTS;
      } else if (gapSlots >= 0 && gapPixels < MIN_GAP_PIXELS) {
        const adjustment = MIN_GAP_PIXELS / SLOT_HEIGHT - gapSlots;
        cumulativeCompressionSlots -= adjustment;
      }
      map[schedule.id] = currStartSlot - cumulativeCompressionSlots;
      prevEndSlot = getSlotIndex(getEndTime(schedule.startAt, schedule.durationMinutes));
    });

    const lastEndSlot = daySchedules.length > 0
      ? getSlotIndex(getEndTime(daySchedules[daySchedules.length - 1].startAt, daySchedules[daySchedules.length - 1].durationMinutes))
      : VIRTUAL_START_SLOT;
    const endGap = VIRTUAL_END_SLOT - lastEndSlot;
    const endGapPixels = endGap * SLOT_HEIGHT;
    if (endGap > MAX_GAP_SLOTS) {
      cumulativeCompressionSlots += endGap - MAX_GAP_SLOTS;
    } else if (endGap >= 0 && endGapPixels < MIN_GAP_PIXELS) {
      const adjustment = MIN_GAP_PIXELS / SLOT_HEIGHT - endGap;
      cumulativeCompressionSlots -= adjustment;
    }
    map['_end'] = VIRTUAL_END_SLOT - cumulativeCompressionSlots;

    return map;
  }, [daySchedules, getSlotIndex]);

  const compressedTimelineHeight = useMemo(() => {
    const endSlot = compressedSlotMap['_end'] ?? TOTAL_SLOTS;
    return endSlot * SLOT_HEIGHT + CARD_PADDING * 2;
  }, [compressedSlotMap]);

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

  const handlePrevWeek = () => setSelectedDate(addDays(selectedDate, -7));
  const handleNextWeek = () => setSelectedDate(addDays(selectedDate, 7));
  const handleDaySelect = (day: Date) => setSelectedDate(day);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowDatePicker(false);
      }
    };
    if (showDatePicker) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [showDatePicker]);

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(tick);
  }, []);

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

  const toggleScheduleComplete = useCallback((scheduleId: string) => {
    setCompletedSchedules((prev) => {
      const next = new Set(prev);
      if (next.has(scheduleId)) {
        next.delete(scheduleId);
      } else {
        next.add(scheduleId);
      }
      return next;
    });
  }, []);

const splitScheduleIntoSegments = useCallback((schedule: ScheduleItem) => {
    const startDate = parseISO(schedule.startAt);
    const endDate = getEndTime(schedule.startAt, schedule.durationMinutes);
    const totalMinutes = schedule.durationMinutes;
    const segments: { startAt: Date; endAt: Date; durationMinutes: number }[] = [];

    if (totalMinutes <= LONG_SCHEDULE_THRESHOLD_HOURS * 60) {
      segments.push({ startAt: startDate, endAt: endDate, durationMinutes: totalMinutes });
    } else {
      let currentStart = startDate;
      let remainingMinutes = totalMinutes;

      while (remainingMinutes > 0) {
        const segmentDuration = Math.min(remainingMinutes, LONG_SCHEDULE_THRESHOLD_HOURS * 60);
        const segmentEnd = new Date(currentStart.getTime() + segmentDuration * 60 * 1000);
        segments.push({
          startAt: currentStart,
          endAt: segmentEnd,
          durationMinutes: segmentDuration,
        });
        currentStart = segmentEnd;
        remainingMinutes -= segmentDuration;
      }
    }

    return segments;
  }, []);

  const allScheduleSegments = useMemo(() => {
    const segments: Array<{ schedule: ScheduleItem; segment: { startAt: Date; endAt: Date; durationMinutes: number }; segmentIndex: number; totalSegments: number }> = [];
    daySchedules.forEach((schedule) => {
      const segs = splitScheduleIntoSegments(schedule);
      segs.forEach((seg, idx) => {
        segments.push({ schedule, segment: seg, segmentIndex: idx, totalSegments: segs.length });
      });
    });
    return segments;
  }, [daySchedules, splitScheduleIntoSegments]);

  return (
    <div className="flex flex-row w-full" style={{ minHeight: "calc(100vh - 48px)" }}>
      <div className="flex flex-col justify-center items-center w-84 lg:w-96 p-4 lg:p-5 shrink-0">
        <div className="space-y-6">
          <div className="flex flex-col items-center text-center gap-3">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: "var(--color-primary)", opacity: 0.1 }}
            >
              <Inbox className="w-6 h-6" style={{ color: "var(--color-primary)" }} />
            </div>
            <h3 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
              日程助手
            </h3>
            <p className="text-xs leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
              轻松掌控每一天的时间流向
            </p>
          </div>
        </div>

        <div className="space-y-2 mt-12">
          <button
            onClick={() => onAddSchedule?.(selectedDate)}
            className="py-2.5 px-4 rounded-xl text-white text-sm font-medium flex items-center justify-center gap-2 transition-all hover:brightness-110"
            style={{ background: "linear-gradient(135deg, var(--color-primary), var(--color-primary-hover, var(--color-primary)))", boxShadow: "0 4px 12px color-mix(in srgb, var(--color-primary) 25%, transparent)" }}
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
                  style={{ color: "var(--color-text)" }}
                >
                  {format(selectedDate, "yyyy年M月d日")}
                  <ChevronDown
                    className={`w-4 h-4 lg:w-5 lg:h-5 transition-transform ${showDatePicker ? 'rotate-180' : ''}`}
                    style={{ color: "var(--color-text-secondary)" }}
                  />
                </button>

                <AnimatePresence>
                  {showDatePicker && (
                    <DatePicker
                      value={selectedDate}
                      onChange={(date) => {
                        setSelectedDate(date);
                        setShowDatePicker(false);
                      }}
                      onClose={() => setShowDatePicker(false)}
                    />
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <div className="flex items-center rounded-lg p-0.5" style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
                <button
                  onClick={handlePrevWeek}
                  className="w-7 h-7 rounded-md flex items-center justify-center transition-colors"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setSelectedDate(new Date())}
                  className="px-2 h-7 rounded-md text-xs font-medium transition-colors"
                  style={{ color: "var(--color-primary)" }}
                >
                  今天
                </button>
                <button
                  onClick={handleNextWeek}
                  className="w-7 h-7 rounded-md flex items-center justify-center transition-colors"
                  style={{ color: "var(--color-text-secondary)" }}
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
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    周{WEEKDAYS[i]}
                  </span>
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold transition-all"
                    style={{
                      color: isActive || isDayToday ? "white" : "var(--color-text)",
                      backgroundColor: isActive || isDayToday ? "var(--color-primary)" : "transparent"
                    }}
                  >
                    {format(day, "d")}
                  </div>
                  <div className="flex items-center gap-0.5 h-3 mt-0.5">
                    {daySchedulesCount > 0 && (
                      <>
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: isActive || isDayToday ? "rgba(255,255,255,0.9)" : "var(--color-primary)" }}
                        />
                        {daySchedulesCount > 1 && (
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: isActive || isDayToday ? "rgba(255,255,255,0.5)" : "color-mix(in srgb, var(--color-primary) 50%, transparent)" }}
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
            className="flex-1 rounded-3xl overflow-hidden px-32 py-8"
            style={{
              backgroundColor: "var(--color-surface)",
              boxShadow: "var(--shadow-md)",
              maxHeight: "calc(100vh - 200px)",
              overflowY: "auto",
            }}
          >
            <div className="flex" style={{ height: compressedTimelineHeight }}>
              <div
                className="flex-1 relative cursor-pointer"
                ref={timelineRef}
                onClick={handleTimelineClick}
              >
                  <div
                    className="absolute w-0.5 h-full"
                    style={{
                      left: 0,
                      background: "linear-gradient(180deg, transparent 0%, var(--color-primary) 5%, var(--color-primary) 95%, transparent 100%)",
                    }}
                  />

                {daySchedules.length === 0 ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div
                      className="w-16 h-16 rounded-full flex items-center justify-center mb-3"
                      style={{ backgroundColor: "color-mix(in srgb, var(--color-primary) 8%, transparent)" }}
                    >
                      <Clock className="w-8 h-8" style={{ color: "var(--color-primary)", opacity: 0.4 }} />
                    </div>
                    <p className="text-sm font-medium" style={{ color: "var(--color-text-muted)" }}>
                      今天没有日程安排
                    </p>
                    <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)", opacity: 0.7 }}>
                      点击时间轴添加第一个日程
                    </p>
                  </div>
                ) : (
                  <div className="absolute inset-0 -left-[24px]">
                    {allScheduleSegments.map((seg, index) => {
                      const { schedule, segment, segmentIndex, totalSegments } = seg;
                      const startDate = segment.startAt;
                      const endDate = segment.endAt;
                      const compressedStartSlot = compressedSlotMap[schedule.id];
                      const startSlot = getSlotIndex(startDate);
                      const endSlot = getSlotIndex(endDate);
                      const durationSlots = Math.max(endSlot - startSlot, 1);
                      const colors = PRIORITY_COLORS[schedule.priority];
                      const IconComponent = ICON_MAP[schedule.icon] || Clock;
                      const hasOverlap = scheduleOverlaps[schedule.id]?.length > 0;
                      const overlappingIds = scheduleOverlaps[schedule.id] || [];
                      const startTop = slotToTop(compressedStartSlot);
                      const nodeHeight = durationSlots * SLOT_HEIGHT;
                      const nodeWidth = NODE_SIZE;
                      const nodeTop = startTop - nodeHeight / 2;
                      const isFirstSegment = segmentIndex === 0;
                      const isMultiSegment = totalSegments > 1;
                      const globalIndex = daySchedules.indexOf(schedule);
                      const prevSchedule = globalIndex > 0 ? daySchedules[globalIndex - 1] : null;
                      const nextSchedule = globalIndex < daySchedules.length - 1 ? daySchedules[globalIndex + 1] : null;
                      const prevCompressedSlot = prevSchedule ? compressedSlotMap[prevSchedule.id] : 0;
                      const isDashed = globalIndex > 0 && (compressedStartSlot - prevCompressedSlot) > MAX_GAP_SLOTS;
                      const gapMinutes = globalIndex > 0 && prevSchedule
                        ? differenceInMinutes(parseISO(schedule.startAt), getEndTime(prevSchedule.startAt, prevSchedule.durationMinutes))
                        : 0;
                      const nextGapMinutes = nextSchedule
                        ? differenceInMinutes(parseISO(nextSchedule.startAt), getEndTime(schedule.startAt, schedule.durationMinutes))
                        : 1;
                      const showGapHint = gapMinutes >= 60;
                      const sharesTimeWithPrev = prevSchedule
                        && gapMinutes < 0;
                      const sharesTimeWithNext = nextSchedule
                        && nextGapMinutes <= 0;
                      const startTimeShiftUp = globalIndex > 0 && gapMinutes === 0;

                      const tzOffset = now.getTimezoneOffset() * 60000;
                      const nowLocal = new Date(now.getTime() - tzOffset);
                      const startDateLocal = new Date(startDate.getTime() - tzOffset);
                      const endDateLocal = new Date(endDate.getTime() - tzOffset);
                      const isUpcoming = nowLocal < startDateLocal;
                      const isEnded = nowLocal > endDateLocal;
                      const elapsedRatio = !isUpcoming && !isEnded
                        ? Math.min((nowLocal.getTime() - startDateLocal.getTime()) / (endDateLocal.getTime() - startDateLocal.getTime()) * 100, 100)
                        : 100;
                      const progressBackground = isUpcoming
                        ? 'rgba(255,255,255,1)'
                        : isEnded
                        ? colors.bg
                        : `linear-gradient(to bottom, ${colors.bg} 0%, ${colors.bg} ${elapsedRatio}%, rgba(255,255,255,1) ${elapsedRatio}%, rgba(255,255,255,1) 100%)`;
                      const capsuleBorder = isUpcoming ? `2px solid ${colors.border}` : 'none';
                      const iconColor = isUpcoming
                        ? colors.text
                        : isEnded || elapsedRatio < 50
                        ? '#ffffff'
                        : colors.text;

                      return (
                        <div key={`${schedule.id}-seg-${segmentIndex}`}>
                          {(index === 0 || (index > 0 && allScheduleSegments[index - 1].schedule.id !== schedule.id)) && (
                            <>
                              {globalIndex > 0 && (
                                <div
                                  className="absolute"
                                  style={{
                                    top: slotToTop(prevCompressedSlot),
                                    height: startTop - slotToTop(prevCompressedSlot),
                                    left: 24,
                                  }}
                                >
                                  <div
                                    className="w-0.5 h-full"
                                    style={{
                                      background: isDashed
                                        ? "repeating-linear-gradient(180deg, transparent 0, transparent 5px, var(--color-border) 5px, var(--color-border) 9px)"
                                        : "linear-gradient(180deg, var(--color-primary) 0%, var(--color-primary) 100%)",
                                    }}
                                  />
                                  {showGapHint && (
                                    <div
                                      className="absolute left-16 flex items-center gap-2"
                                      style={{ top: '50%', transform: 'translateY(-50%)', whiteSpace: 'nowrap' }}
                                    >
                                      <span className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                                        空闲 <span className="font-medium" style={{ color: "var(--color-primary)" }}>{gapMinutes}</span> 分钟
                                      </span>
                                      <span className="text-[10px]" style={{ color: "var(--color-text-muted)", opacity: 0.7 }}>
                                        安排一个日程?
                                      </span>
                                      <button
                                        onClick={() => onAddSchedule?.(parseISO(schedule.startAt))}
                                        className="px-2 py-0.5 rounded text-[10px] font-medium transition-colors"
                                        style={{ backgroundColor: "color-mix(in srgb, var(--color-primary) 10%, transparent)", color: "var(--color-primary)" }}
                                      >
                                        添加日程
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </>
                          )}

                          {segmentIndex > 0 && (
                            <div
                              className="absolute w-full pointer-events-none"
                              style={{
                                top: startTop - SLOT_HEIGHT / 2,
                                height: SLOT_HEIGHT,
                                left: 24,
                              }}
                            >
                              <div className="w-full h-0.5" style={{ backgroundColor: "color-mix(in srgb, var(--color-primary) 30%, transparent)" }} />
                            </div>
                          )}

                          {isFirstSegment && (
                            <motion.button
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ duration: 0.2, delay: globalIndex * 0.05 }}
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditSchedule?.(schedule);
                              }}
                              className="event-capsule absolute cursor-pointer transition-all hover:brightness-95 active:scale-95"
                              style={{
                                top: nodeTop,
                                height: Math.max(nodeHeight, SLOT_HEIGHT),
                                width: nodeWidth,
                                left: 8,
                                background: progressBackground,
                                border: capsuleBorder,
                                borderRadius: "9999px",
                                zIndex: colors.zIndex,
                              }}
                            >
                              {!sharesTimeWithPrev && (
                                <div
                                  className="absolute -left-3 flex flex-col items-end"
                                  style={{
                                    transform: 'translateX(-100%)',
                                    top: startTimeShiftUp ? '-12px' : '0',
                                  }}
                                >
                                  <span className="text-[10px] font-medium" style={{ color: "var(--color-text)" }}>
                                    {format(startDate, 'HH:mm')}
                                  </span>
                                </div>
                              )}
                              {isFirstSegment && !sharesTimeWithNext && (
                                <div className="absolute -left-3 bottom-0 flex flex-col items-end" style={{ transform: 'translateX(-100%)' }}>
                                  <span className="text-[10px] font-medium" style={{ color: "var(--color-text)" }}>
                                    {formatEndTime(endDate)}
                                  </span>
                                </div>
                              )}
                              <div
                                className="w-full h-full rounded-full flex items-center justify-center"
                                style={{
                                  backgroundColor: isUpcoming ? 'transparent' : colors.bg,
                                  border: `2px solid ${colors.border}`,
                                }}
                              >
                                <IconComponent className="w-4 h-4" style={{ color: iconColor }} />
                              </div>
                            </motion.button>
                          )}

                          <div
                            className="absolute left-24 right-8 flex items-center justify-between"
                            style={{ top: nodeTop, height: Math.max(nodeHeight, SLOT_HEIGHT) }}
                          >
                            <div className="flex flex-col justify-center flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h4
                                  className="text-sm font-semibold truncate"
                                  style={{ color: completedSchedules.has(schedule.id) ? "var(--color-text-muted)" : "var(--color-text)" }}
                                >
                                  {isMultiSegment ? `${schedule.title} (${segmentIndex * 2 + 1}-${Math.min((segmentIndex + 1) * 2, 24)}时)` : schedule.title}
                                </h4>
                                {hasOverlap && isFirstSegment && (
                                  <span
                                    className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium shrink-0"
                                    style={{ backgroundColor: "color-mix(in srgb, var(--color-error, #ef4444) 10%, transparent)", color: "var(--color-error, #ef4444)" }}
                                  >
                                    <AlertCircle className="w-3 h-3" />
                                    重叠 {overlappingIds.length} 个
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[11px]" style={{ color: "var(--color-text-secondary)" }}>
                                  {format(startDate, 'HH:mm')} - {formatEndTime(endDate)}
                                </span>
                                <span className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                                  ({schedule.durationMinutes}分钟)
                                </span>
                                {schedule.location && isFirstSegment && (
                                  <div className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3" style={{ color: "var(--color-text-muted)" }} />
                                    <span className="text-[10px] truncate" style={{ color: "var(--color-text-secondary)" }}>
                                      {schedule.location}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                            {isFirstSegment && (
                              <motion.button
                                onClick={() => toggleScheduleComplete(schedule.id)}
                                whileTap={{ scale: 0.85 }}
                                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 ml-3"
                                style={{
                                  backgroundColor: completedSchedules.has(schedule.id) ? colors.border : 'transparent',
                                  border: `2px solid ${colors.border}`,
                                }}
                              >
                                <motion.div
                                  initial={false}
                                  animate={{
                                    scale: completedSchedules.has(schedule.id) ? 1 : 0,
                                    opacity: completedSchedules.has(schedule.id) ? 1 : 0,
                                  }}
                                  transition={{ duration: 0.15 }}
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: colors.border }}
                                />
                              </motion.button>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {[0, 24].map((hour) => {
                      const slot = hour === 0 ? 0 : (compressedSlotMap['_end'] ?? TOTAL_SLOTS);
                      const top = slotToTop(slot);
                      const nodeTop = top;
                      const hasScheduleAt0 = hour === 0 && daySchedules.some(s => {
                        const start = parseISO(s.startAt);
                        return start.getHours() === 0 && start.getMinutes() === 0;
                      });
                      const hasScheduleAt24 = hour === 24 && daySchedules.some(s => {
                        const end = getEndTime(s.startAt, s.durationMinutes);
                        return end.getHours() === 0 && end.getMinutes() === 0;
                      });
                      if (hasScheduleAt0 || hasScheduleAt24) return null;
                      return (
                        <div
                          key={`virtual-${hour}`}
                          className="absolute -left-3 flex flex-col items-end"
                          style={{ top: nodeTop, transform: 'translateX(-60%)' }}
                        >
                          <span className="text-[10px] font-medium" style={{ color: "var(--color-text)" }}>
                            {hour === 0 ? '00:00' : '24:00'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}