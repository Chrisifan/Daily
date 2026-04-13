import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { Ref } from 'react';
import { getStoredSettings } from '../../shared/services/settingsService';
import {
  Inbox,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plus,
  Clock,
  MapPin,
  AlertCircle,
  Phone,
  Focus,
  Coffee,
  Plane,
  Utensils,
  Dumbbell,
  Moon,
  Calendar,
  BookOpen,
  BriefcaseBusiness,
  ShoppingBag,
  House,
  Music4,
  HeartPulse,
} from 'lucide-react';
import {
  format,
  startOfWeek,
  addDays,
  isSameDay,
  parseISO,
  differenceInMinutes,
  startOfDay,
  areIntervalsOverlapping,
} from 'date-fns';
import { formatTime } from '../../shared/utils/date';
import type { ScheduleItem, ScheduleIcon } from '../../domain/schedule/types';
import { DatePicker } from '../../shared/ui/DatePicker';
import { useAnchoredOverlay } from '../../shared/ui/useAnchoredOverlay';
import { PRIORITY_STYLES } from '../../shared/constants/priority';
import {
  buildDateFromRoutineMinutes,
  normalizeRoutineEndMinutes,
  parseRoutineTime,
} from '../../shared/utils/routineTime';

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
  study: BookOpen,
  work: BriefcaseBusiness,
  shopping: ShoppingBag,
  home: House,
  music: Music4,
  health: HeartPulse,
};

interface CalendarViewProps {
  schedules: ScheduleItem[];
  onEditSchedule?: (schedule: ScheduleItem) => void;
  onAddSchedule?: (date?: Date) => void;
}

interface TimelineSchedule extends ScheduleItem {
  isVirtual?: boolean;
  virtualKind?: 'routineStart' | 'routineEnd';
}

const WEEKDAY_KEYS = [
  'calendar.weekdays.0',
  'calendar.weekdays.1',
  'calendar.weekdays.2',
  'calendar.weekdays.3',
  'calendar.weekdays.4',
  'calendar.weekdays.5',
  'calendar.weekdays.6',
] as const;

const CARD_PADDING = 16;
const SLOT_HEIGHT = 32;
const NODE_SIZE = 32;

function getEndTime(startAt: string, durationMinutes: number): Date {
  const start = parseISO(startAt);
  return new Date(start.getTime() + durationMinutes * 60 * 1000);
}

function formatBoundaryTime(
  date: Date,
  uses24HourTime: boolean,
  treatMidnightAsEndOfDay: boolean = false
): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  if (uses24HourTime && treatMidnightAsEndOfDay && hours === 0 && minutes === 0) {
    return '24:00';
  }
  return formatTime(date);
}

export function CalendarView({ schedules, onEditSchedule, onAddSchedule }: CalendarViewProps) {
  const { t, i18n } = useTranslation();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [completedSchedules, setCompletedSchedules] = useState<Set<string>>(new Set());
  const [now, setNow] = useState<Date>(new Date());
  const pickerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const timelineViewportRef = useRef<HTMLDivElement>(null);
  const [timelineViewportHeight, setTimelineViewportHeight] = useState(0);
  const {
    anchorRef: datePickerTriggerRef,
    contentRef: datePickerContentRef,
    side: datePickerSide,
    style: datePickerStyle,
  } = useAnchoredOverlay({
    open: showDatePicker,
    gap: 8,
    matchTriggerWidth: 'min',
  });

  const dateFormatStr = useMemo(() => {
    const settings = getStoredSettings();
    const formatMap: Record<string, string> = {
      'YYYY-MM-DD': 'yyyy-MM-dd',
      'MM/DD/YYYY': 'MM/dd/yyyy',
      'DD/MM/YYYY': 'dd/MM/yyyy',
    };
    return formatMap[settings.dateFormat] || 'yyyy-MM-dd';
  }, [i18n.language]);
  const settings = useMemo(() => getStoredSettings(), [i18n.language]);
  const uses24HourTime = settings.timeFormat === 'HH:mm';
  const routineStartMinutes = useMemo(
    () => parseRoutineTime(settings.routineStartTime),
    [settings.routineStartTime]
  );
  const routineEndMinutes = useMemo(
    () =>
      normalizeRoutineEndMinutes(routineStartMinutes, parseRoutineTime(settings.routineEndTime)),
    [routineStartMinutes, settings.routineEndTime]
  );

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
  const isRoutineOnlyDay = daySchedules.length === 0;

  const routineBoundarySchedules = useMemo<TimelineSchedule[]>(() => {
    const createdAt = new Date().toISOString();
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const routineStartDate = buildDateFromRoutineMinutes(selectedDate, routineStartMinutes);
    const routineEndDate = buildDateFromRoutineMinutes(selectedDate, routineEndMinutes);

    return [
      {
        id: `routine-start-${format(selectedDate, 'yyyy-MM-dd')}`,
        source: 'system_calendar',
        title: t('calendar.routineStartTitle'),
        icon: 'clock',
        startAt: format(routineStartDate, "yyyy-MM-dd'T'HH:mm:ss"),
        timezone,
        durationMinutes: 0,
        repeatMode: 'daily',
        priority: 'low',
        isFlexible: false,
        createdAt,
        updatedAt: createdAt,
        isVirtual: true,
        virtualKind: 'routineStart',
      },
      {
        id: `routine-end-${format(selectedDate, 'yyyy-MM-dd')}`,
        source: 'system_calendar',
        title: t('calendar.routineEndTitle'),
        icon: 'sleep',
        startAt: format(routineEndDate, "yyyy-MM-dd'T'HH:mm:ss"),
        timezone,
        durationMinutes: 0,
        repeatMode: 'daily',
        priority: 'medium',
        isFlexible: false,
        createdAt,
        updatedAt: createdAt,
        isVirtual: true,
        virtualKind: 'routineEnd',
      },
    ];
  }, [routineEndMinutes, routineStartMinutes, selectedDate, t]);

  const timelineSchedules = useMemo<TimelineSchedule[]>(() => {
    return [...routineBoundarySchedules, ...daySchedules].sort(
      (a, b) => parseISO(a.startAt).getTime() - parseISO(b.startAt).getTime()
    );
  }, [daySchedules, routineBoundarySchedules]);

  const { visibleStartMinutes, visibleEndMinutes, visibleTotalSlots } = useMemo(() => {
    const dayStart = startOfDay(selectedDate);
    let minMinutes = routineStartMinutes;
    let maxMinutes = routineEndMinutes;

    timelineSchedules.forEach((schedule) => {
      const startDate = parseISO(schedule.startAt);
      const endDate = getEndTime(schedule.startAt, schedule.durationMinutes);
      const startMinutes = differenceInMinutes(startDate, dayStart);
      const endMinutes = differenceInMinutes(endDate, dayStart);
      minMinutes = Math.min(minMinutes, startMinutes);
      maxMinutes = Math.max(maxMinutes, Math.max(startMinutes, endMinutes));
    });

    const alignedStart = Math.floor(minMinutes / 30) * 30;
    const alignedEnd = Math.max(alignedStart + 30, Math.ceil(maxMinutes / 30) * 30);

    return {
      visibleStartMinutes: alignedStart,
      visibleEndMinutes: alignedEnd,
      visibleTotalSlots: Math.max(1, (alignedEnd - alignedStart) / 30),
    };
  }, [routineEndMinutes, routineStartMinutes, selectedDate, timelineSchedules]);

  const getSlotIndex = useCallback(
    (date: Date): number => {
      const dayStart = startOfDay(selectedDate);
      const minutes = differenceInMinutes(date, dayStart);
      return Math.max(
        0,
        Math.min(Math.floor((minutes - visibleStartMinutes) / 30), visibleTotalSlots)
      );
    },
    [selectedDate, visibleStartMinutes, visibleTotalSlots]
  );

  const getSlotEndIndex = useCallback(
    (date: Date): number => {
      const dayStart = startOfDay(selectedDate);
      const minutes = differenceInMinutes(date, dayStart);
      return Math.max(
        0,
        Math.min(Math.ceil((minutes - visibleStartMinutes) / 30), visibleTotalSlots)
      );
    },
    [selectedDate, visibleStartMinutes, visibleTotalSlots]
  );

  const slotToTop = useCallback((slot: number): number => {
    return slot * SLOT_HEIGHT + CARD_PADDING;
  }, []);

  const topToSlot = useCallback(
    (top: number): number => {
      return Math.max(
        0,
        Math.min(Math.floor((top - CARD_PADDING) / SLOT_HEIGHT), Math.max(visibleTotalSlots - 1, 0))
      );
    },
    [visibleTotalSlots]
  );

  const compressedSlotMap = useMemo(() => {
    const map: { [key: string]: number } = {};

    if (daySchedules.length === 0 && timelineSchedules.length > 0) {
      timelineSchedules.forEach((schedule) => {
        map[schedule.id] = getSlotIndex(parseISO(schedule.startAt));
      });
      map['_end'] = visibleTotalSlots;
      return map;
    }

    let cumulativeCompressionSlots = 0;
    const VIRTUAL_START_SLOT = 0;
    const VIRTUAL_END_SLOT = visibleTotalSlots;
    const MIN_GAP_PIXELS = 24;
    let prevEndSlot = VIRTUAL_START_SLOT;

    timelineSchedules.forEach((schedule) => {
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
      prevEndSlot =
        schedule.durationMinutes === 0
          ? currStartSlot
          : getSlotEndIndex(getEndTime(schedule.startAt, schedule.durationMinutes));
    });

    const lastEndSlot =
      timelineSchedules.length > 0
        ? timelineSchedules[timelineSchedules.length - 1].durationMinutes === 0
          ? getSlotIndex(parseISO(timelineSchedules[timelineSchedules.length - 1].startAt))
          : getSlotEndIndex(
              getEndTime(
                timelineSchedules[timelineSchedules.length - 1].startAt,
                timelineSchedules[timelineSchedules.length - 1].durationMinutes
              )
            )
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
  }, [daySchedules.length, getSlotEndIndex, getSlotIndex, timelineSchedules, visibleTotalSlots]);

  const scheduleDisplayLayout = useMemo(() => {
    const layoutMap: Record<
      string,
      {
        displayStartSlot: number;
        displayEndSlot: number;
        slotOffset: number;
        overlapsPrevious: boolean;
        overlapsNext: boolean;
      }
    > = {};

    let previousDisplayEndSlot = 0;

    timelineSchedules.forEach((schedule, index) => {
      const compressedStartSlot = compressedSlotMap[schedule.id] ?? 0;
      const startSlot = getSlotIndex(parseISO(schedule.startAt));
      const endSlot =
        schedule.durationMinutes === 0
          ? startSlot + 1
          : getSlotEndIndex(getEndTime(schedule.startAt, schedule.durationMinutes));
      const durationSlots = Math.max(endSlot - startSlot, 1);
      const previousSchedule = index > 0 ? timelineSchedules[index - 1] : null;
      const overlapsPrevious =
        !!previousSchedule &&
        !schedule.isVirtual &&
        !previousSchedule.isVirtual &&
        differenceInMinutes(
          parseISO(schedule.startAt),
          getEndTime(previousSchedule.startAt, previousSchedule.durationMinutes)
        ) < 0;
      const displayStartSlot =
        index === 0
          ? compressedStartSlot
          : overlapsPrevious
            ? previousDisplayEndSlot
            : Math.max(compressedStartSlot, previousDisplayEndSlot);
      const displayEndSlot = displayStartSlot + durationSlots;

      layoutMap[schedule.id] = {
        displayStartSlot,
        displayEndSlot,
        slotOffset: displayStartSlot - compressedStartSlot,
        overlapsPrevious,
        overlapsNext: false,
      };

      if (previousSchedule && overlapsPrevious && layoutMap[previousSchedule.id]) {
        layoutMap[previousSchedule.id].overlapsNext = true;
      }

      previousDisplayEndSlot = displayEndSlot;
    });

    return {
      layoutMap,
      endSlot: Math.max(compressedSlotMap['_end'] ?? visibleTotalSlots, previousDisplayEndSlot),
    };
  }, [compressedSlotMap, getSlotEndIndex, getSlotIndex, timelineSchedules, visibleTotalSlots]);

  const compressedTimelineHeight = useMemo(() => {
    const endSlot = scheduleDisplayLayout.endSlot;
    return endSlot * SLOT_HEIGHT + CARD_PADDING * 2;
  }, [scheduleDisplayLayout.endSlot]);

  const timelineContentHeight = useMemo(() => {
    if (isRoutineOnlyDay) {
      return '100%';
    }
    return Math.max(compressedTimelineHeight, timelineViewportHeight);
  }, [compressedTimelineHeight, isRoutineOnlyDay, timelineViewportHeight]);

  const timelineEdgeOffset = useMemo(() => {
    if (isRoutineOnlyDay || timelineViewportHeight <= compressedTimelineHeight) {
      return 0;
    }
    return (timelineViewportHeight - compressedTimelineHeight) / 2;
  }, [compressedTimelineHeight, isRoutineOnlyDay, timelineViewportHeight]);

  const scheduleOverlaps = useMemo(() => {
    const overlaps: { [key: string]: string[] } = {};
    for (let i = 0; i < timelineSchedules.length; i++) {
      for (let j = i + 1; j < timelineSchedules.length; j++) {
        const a = timelineSchedules[i];
        const b = timelineSchedules[j];
        if (a.isVirtual || b.isVirtual) {
          continue;
        }
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
  }, [timelineSchedules]);

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
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showDatePicker]);

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    const viewport = timelineViewportRef.current;
    if (!viewport) return;

    const updateTimelineViewportHeight = () => {
      const styles = window.getComputedStyle(viewport);
      const paddingTop = Number.parseFloat(styles.paddingTop) || 0;
      const paddingBottom = Number.parseFloat(styles.paddingBottom) || 0;
      setTimelineViewportHeight(Math.max(viewport.clientHeight - paddingTop - paddingBottom, 0));
    };

    updateTimelineViewportHeight();

    const resizeObserver = new ResizeObserver(updateTimelineViewportHeight);
    resizeObserver.observe(viewport);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('.event-capsule')) return;
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect) return;
    const y = e.clientY - rect.top;
    const clickedMinutes = isRoutineOnlyDay
      ? (() => {
          const ratio = rect.height > 0 ? y / rect.height : 0;
          const rawMinutes =
            visibleStartMinutes + ratio * (visibleEndMinutes - visibleStartMinutes);
          const snappedMinutes = Math.round(rawMinutes / 30) * 30;
          return Math.max(visibleStartMinutes, Math.min(visibleEndMinutes, snappedMinutes));
        })()
      : visibleStartMinutes + topToSlot(y) * 30;
    const clickedDate = buildDateFromRoutineMinutes(selectedDate, clickedMinutes);
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

  const splitScheduleIntoSegments = useCallback((schedule: TimelineSchedule) => {
    const startDate = parseISO(schedule.startAt);
    const endDate = getEndTime(schedule.startAt, schedule.durationMinutes);
    const totalMinutes = schedule.durationMinutes;
    const segments: { startAt: Date; endAt: Date; durationMinutes: number }[] = [];

    if (totalMinutes === 0 || totalMinutes <= LONG_SCHEDULE_THRESHOLD_HOURS * 60) {
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
    const segments: Array<{
      schedule: TimelineSchedule;
      segment: { startAt: Date; endAt: Date; durationMinutes: number };
      segmentIndex: number;
      totalSegments: number;
    }> = [];
    timelineSchedules.forEach((schedule) => {
      const segs = splitScheduleIntoSegments(schedule);
      segs.forEach((seg, idx) => {
        segments.push({ schedule, segment: seg, segmentIndex: idx, totalSegments: segs.length });
      });
    });
    return segments;
  }, [splitScheduleIntoSegments, timelineSchedules]);

  return (
    <div className="flex flex-row w-full" style={{ minHeight: 'calc(100vh - 48px)' }}>
      <div className="flex flex-col justify-center items-center w-84 lg:w-96 p-4 lg:p-5 shrink-0">
        <div className="space-y-6">
          <div className="flex flex-col items-center text-center gap-3">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: 'var(--color-primary)', opacity: 0.1 }}
            >
              <Inbox className="w-6 h-6" style={{ color: 'var(--color-primary)' }} />
            </div>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
              {t('calendar.title')}
            </h3>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              {t('calendar.subtitle')}
            </p>
          </div>
        </div>

        <div className="space-y-2 mt-12">
          <button
            onClick={() => onAddSchedule?.()}
            className="py-2.5 px-4 rounded-xl text-white text-sm font-medium flex items-center justify-center gap-2 transition-all hover:brightness-110"
            style={{
              background:
                'linear-gradient(135deg, var(--color-primary), var(--color-primary-hover, var(--color-primary)))',
              boxShadow: '0 4px 12px color-mix(in srgb, var(--color-primary) 25%, transparent)',
            }}
          >
            <Plus className="w-4 h-4" />
            {t('calendar.addSchedule')}
          </button>
        </div>
      </div>

      <div className="flex flex-col flex-1 min-w-0">
        <div className="px-4 py-3 lg:px-6 lg:py-4">
          <header className="flex items-center justify-between gap-3 mb-2 px-2">
            <div className="flex items-center gap-2">
              <div className="relative" ref={pickerRef}>
                <button
                  ref={datePickerTriggerRef as Ref<HTMLButtonElement>}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDatePicker(!showDatePicker);
                  }}
                  className="flex items-center gap-1 text-base lg:text-xl font-bold tracking-tight transition-colors"
                  style={{ color: 'var(--color-text)' }}
                >
                  {format(selectedDate, dateFormatStr)}
                  <ChevronDown
                    className={`w-4 h-4 lg:w-5 lg:h-5 transition-transform ${showDatePicker ? 'rotate-180' : ''}`}
                    style={{ color: 'var(--color-text-secondary)' }}
                  />
                </button>

                <AnimatePresence>
                  {showDatePicker && (
                    <DatePicker
                      ref={datePickerContentRef as Ref<HTMLDivElement>}
                      value={selectedDate}
                      side={datePickerSide}
                      panelStyle={datePickerStyle}
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
              <div
                className="flex items-center rounded-lg p-0.5"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <button
                  onClick={handlePrevWeek}
                  className="w-7 h-7 rounded-md flex items-center justify-center transition-colors"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setSelectedDate(new Date())}
                  className="px-2 h-7 rounded-md text-xs font-medium transition-colors"
                  style={{ color: 'var(--color-primary)' }}
                >
                  {t('calendar.today')}
                </button>
                <button
                  onClick={handleNextWeek}
                  className="w-7 h-7 rounded-md flex items-center justify-center transition-colors"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </header>

          <div className="grid grid-cols-7 gap-1 px-2">
            {Array.from({ length: 7 }, (_, i) => {
              const day = addDays(startOfWeek(selectedDate, { weekStartsOn: 0 }), i);
              const daySchedules = schedules
                .filter((s) => {
                  if (!s.startAt) return false;
                  const start = parseISO(s.startAt);
                  return isSameDay(start, day);
                })
                .sort((a, b) => {
                  const pOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
                  return pOrder[a.priority] - pOrder[b.priority];
                })
                .slice(0, 3);
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
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    {t(WEEKDAY_KEYS[i])}
                  </span>
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold transition-all relative"
                    style={{
                      color: isActive
                        ? 'white'
                        : isDayToday
                          ? 'var(--color-primary)'
                          : 'var(--color-text)',
                      backgroundColor: isActive ? 'var(--color-primary)' : 'transparent',
                      boxShadow:
                        isDayToday && !isActive ? 'inset 0 0 0 2px var(--color-primary)' : 'none',
                    }}
                  >
                    {format(day, 'd')}
                  </div>
                  <div className="flex items-center justify-center gap-0.5 h-3 mt-0.5 min-h-[12px]">
                    {daySchedules.map((s, idx) => (
                      <span
                        key={idx}
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{
                          backgroundColor: PRIORITY_STYLES[s.priority].border,
                        }}
                      />
                    ))}
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
            ref={timelineViewportRef}
            style={{
              backgroundColor: 'var(--color-surface)',
              boxShadow: 'var(--shadow-md)',
              maxHeight: 'calc(100vh - 200px)',
              overflowY: 'auto',
            }}
          >
            <div className="flex" style={{ height: timelineContentHeight }}>
              <div
                className="flex-1 relative cursor-pointer"
                ref={timelineRef}
                onClick={handleTimelineClick}
              >
                <div
                  className="absolute w-0.5 h-full"
                  style={{
                    left: 0,
                    background:
                      'linear-gradient(180deg, transparent 0%, var(--color-primary) 5%, var(--color-primary) 95%, transparent 100%)',
                  }}
                />

                {isRoutineOnlyDay ? (
                  <div
                    className="absolute"
                    style={{
                      top: CARD_PADDING,
                      right: 0,
                      bottom: CARD_PADDING,
                      left: -24,
                    }}
                  >
                    <div
                      className="absolute left-12 rounded-2xl px-3 py-2 pointer-events-none"
                      style={{
                        top: '50%',
                        transform: 'translateY(-50%)',
                        backgroundColor:
                          'color-mix(in srgb, var(--color-primary) 10%, transparent)',
                        border:
                          '1px solid color-mix(in srgb, var(--color-primary) 16%, var(--color-border))',
                      }}
                    >
                      <p
                        className="text-[11px] font-medium"
                        style={{ color: 'var(--color-primary)' }}
                      >
                        {t('calendar.routineFallback')}
                      </p>
                    </div>

                    {timelineSchedules.map((schedule, index) => {
                      const scheduleDate = parseISO(schedule.startAt);
                      const isRoutineEnd = schedule.virtualKind === 'routineEnd';
                      const colors = PRIORITY_STYLES[schedule.priority];
                      const IconComponent = ICON_MAP[schedule.icon] || Clock;
                      const iconBadgeBackground = `color-mix(in srgb, ${colors.border} 16%, white 84%)`;
                      const iconBadgeBorder = `1px solid color-mix(in srgb, ${colors.border} 32%, white 68%)`;
                      const iconBadgeShadow = `0 6px 14px color-mix(in srgb, ${colors.border} 24%, transparent)`;
                      const timeLabel = formatBoundaryTime(
                        scheduleDate,
                        uses24HourTime,
                        isRoutineEnd
                      );

                      return (
                        <div
                          key={schedule.id}
                          className="absolute left-0 right-0"
                          style={{
                            top: index === 0 ? 0 : 'auto',
                            bottom: index === 0 ? 'auto' : 0,
                            height: SLOT_HEIGHT,
                          }}
                        >
                          <div
                            className="absolute -left-3 flex flex-col items-end"
                            style={{
                              transform: 'translateX(-100%)',
                              width: '56px',
                              top: '50%',
                              marginTop: '-8px',
                            }}
                          >
                            <span
                              className="block w-full text-right tabular-nums text-[10px] font-medium whitespace-nowrap"
                              style={{ color: 'var(--color-text)' }}
                            >
                              {timeLabel}
                            </span>
                          </div>

                          <div
                            className="absolute flex h-8 w-8 items-center justify-center rounded-full"
                            style={{
                              left: 11,
                              background: 'var(--color-surface)',
                              border: `2px solid ${colors.border}`,
                            }}
                          >
                            <div
                              className="flex h-7 w-7 items-center justify-center rounded-full"
                              style={{
                                background: iconBadgeBackground,
                                border: iconBadgeBorder,
                                boxShadow: iconBadgeShadow,
                              }}
                            >
                              <IconComponent
                                className="w-4 h-4"
                                color={colors.border}
                                strokeWidth={2.4}
                              />
                            </div>
                          </div>

                          <div
                            className="absolute left-24 right-8 flex items-center"
                            style={{ top: 0, height: SLOT_HEIGHT }}
                          >
                            <div className="min-w-0">
                              <h4
                                className="text-sm font-semibold truncate"
                                style={{ color: 'var(--color-text)' }}
                              >
                                {schedule.title}
                              </h4>
                              <div className="mt-0.5 flex items-center gap-2">
                                <span
                                  className="text-[11px] tabular-nums"
                                  style={{ color: 'var(--color-text-secondary)' }}
                                >
                                  {timeLabel}
                                </span>
                                <span
                                  className="text-[10px]"
                                  style={{ color: 'var(--color-text-muted)' }}
                                >
                                  {t('calendar.routinePreset')}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div
                    className="absolute -left-[24px] right-0"
                    style={{
                      top: timelineEdgeOffset,
                      height: compressedTimelineHeight,
                    }}
                  >
                    {allScheduleSegments.map((seg, index) => {
                      const { schedule, segment, segmentIndex, totalSegments } = seg;
                      const startDate = segment.startAt;
                      const endDate = segment.endAt;
                      const scheduleLayout = scheduleDisplayLayout.layoutMap[schedule.id];
                      const compressedStartSlot =
                        (compressedSlotMap[schedule.id] ?? 0) + (scheduleLayout?.slotOffset ?? 0);
                      const startSlot = getSlotIndex(startDate);
                      const endSlot =
                        schedule.durationMinutes === 0 ? startSlot + 1 : getSlotEndIndex(endDate);
                      const durationSlots = Math.max(endSlot - startSlot, 1);
                      const colors = PRIORITY_STYLES[schedule.priority];
                      const IconComponent = ICON_MAP[schedule.icon] || Clock;
                      const isVirtualSchedule = schedule.isVirtual === true;
                      const hasOverlap =
                        !isVirtualSchedule &&
                        ((scheduleLayout?.overlapsPrevious ?? false) ||
                          (scheduleLayout?.overlapsNext ?? false));
                      const overlappingIds = scheduleOverlaps[schedule.id] || [];
                      const startTop = slotToTop(compressedStartSlot);
                      const nodeHeight = durationSlots * SLOT_HEIGHT;
                      const nodeWidth = NODE_SIZE;
                      const nodeTop = startTop - nodeHeight / 2;
                      const isFirstSegment = segmentIndex === 0;
                      const isMultiSegment = totalSegments > 1;
                      const globalIndex = timelineSchedules.indexOf(schedule);
                      const prevSchedule =
                        globalIndex > 0 ? timelineSchedules[globalIndex - 1] : null;
                      const nextSchedule =
                        globalIndex < timelineSchedules.length - 1
                          ? timelineSchedules[globalIndex + 1]
                          : null;
                      const prevCompressedSlot = prevSchedule
                        ? (scheduleDisplayLayout.layoutMap[prevSchedule.id]?.displayStartSlot ??
                          compressedSlotMap[prevSchedule.id])
                        : 0;
                      const isDashed =
                        globalIndex > 0 &&
                        !isVirtualSchedule &&
                        !prevSchedule?.isVirtual &&
                        compressedStartSlot - prevCompressedSlot > MAX_GAP_SLOTS;
                      const gapMinutes =
                        globalIndex > 0 && prevSchedule
                          ? differenceInMinutes(
                              parseISO(schedule.startAt),
                              getEndTime(prevSchedule.startAt, prevSchedule.durationMinutes)
                            )
                          : 0;
                      const nextGapMinutes = nextSchedule
                        ? differenceInMinutes(
                            parseISO(nextSchedule.startAt),
                            getEndTime(schedule.startAt, schedule.durationMinutes)
                          )
                        : 1;
                      const showGapHint =
                        !isVirtualSchedule && !prevSchedule?.isVirtual && gapMinutes >= 60;
                      const sharesTimeWithPrev =
                        (scheduleLayout?.overlapsPrevious ?? false) || (!!prevSchedule && gapMinutes < 0);
                      const sharesTimeWithNext =
                        (scheduleLayout?.overlapsNext ?? false) || (!!nextSchedule && nextGapMinutes <= 0);
                      const startTimeShiftUp = globalIndex > 0 && gapMinutes === 0;

                      const tzOffset = now.getTimezoneOffset() * 60000;
                      const nowLocal = new Date(now.getTime() - tzOffset);
                      const startDateLocal = new Date(startDate.getTime() - tzOffset);
                      const endDateLocal = new Date(endDate.getTime() - tzOffset);
                      const isUpcoming = nowLocal < startDateLocal;
                      const isEnded = nowLocal > endDateLocal;
                      const isCompleted = completedSchedules.has(schedule.id);
                      const elapsedRatio =
                        !isUpcoming && !isEnded
                          ? Math.min(
                              ((nowLocal.getTime() - startDateLocal.getTime()) /
                                (endDateLocal.getTime() - startDateLocal.getTime())) *
                                100,
                              100
                            )
                          : 100;
                      const surfaceColor = 'var(--color-surface)';
                      const progressBackground = isUpcoming
                        ? surfaceColor
                        : isEnded
                          ? colors.solidBackground
                          : `linear-gradient(to bottom, ${colors.solidBackground} 0%, ${colors.solidBackground} ${elapsedRatio}%, ${surfaceColor} ${elapsedRatio}%, ${surfaceColor} 100%)`;
                      const capsuleBorder = isUpcoming ? `2px solid ${colors.border}` : 'none';
                      const iconBadgeBackground = isUpcoming
                        ? `color-mix(in srgb, ${colors.border} 14%, white 86%)`
                        : isEnded || isCompleted || elapsedRatio < 50
                          ? `color-mix(in srgb, ${colors.border} 88%, black 12%)`
                          : `color-mix(in srgb, ${colors.border} 16%, white 84%)`;
                      const iconBadgeBorder =
                        isUpcoming || (!isEnded && elapsedRatio >= 50)
                          ? `1px solid color-mix(in srgb, ${colors.border} 32%, white 68%)`
                          : 'none';
                      const iconBadgeShadow = isUpcoming
                        ? `0 4px 12px color-mix(in srgb, ${colors.border} 18%, transparent)`
                        : `0 6px 14px color-mix(in srgb, ${colors.border} 30%, transparent)`;
                      const iconColor =
                        isUpcoming || (!isEnded && elapsedRatio >= 50)
                          ? colors.border
                          : colors.selectedColor;

                      return (
                        <div key={`${schedule.id}-seg-${segmentIndex}`}>
                          {(index === 0 ||
                            (index > 0 &&
                              allScheduleSegments[index - 1].schedule.id !== schedule.id)) && (
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
                                        ? 'repeating-linear-gradient(180deg, transparent 0, transparent 5px, var(--color-border) 5px, var(--color-border) 9px)'
                                        : 'linear-gradient(180deg, var(--color-primary) 0%, var(--color-primary) 100%)',
                                    }}
                                  />
                                  {showGapHint && (
                                    <div
                                      className="absolute left-16 flex items-center gap-2"
                                      style={{
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      <span
                                        className="text-[10px]"
                                        style={{ color: 'var(--color-text-muted)' }}
                                      >
                                        {t('calendar.freeMinutes', { minutes: gapMinutes })}
                                      </span>
                                      <span
                                        className="text-[10px]"
                                        style={{ color: 'var(--color-text-muted)', opacity: 0.7 }}
                                      >
                                        {t('calendar.suggestSchedule')}
                                      </span>
                                      <button
                                        onClick={() => onAddSchedule?.(parseISO(schedule.startAt))}
                                        className="px-2 py-0.5 rounded text-[10px] font-medium transition-colors"
                                        style={{
                                          backgroundColor:
                                            'color-mix(in srgb, var(--color-primary) 10%, transparent)',
                                          color: 'var(--color-primary)',
                                        }}
                                      >
                                        {t('calendar.addIt')}
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
                              <div
                                className="w-full h-0.5"
                                style={{
                                  backgroundColor:
                                    'color-mix(in srgb, var(--color-primary) 30%, transparent)',
                                }}
                              />
                            </div>
                          )}

                          {isFirstSegment && (
                            <motion.button
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ duration: 0.2, delay: globalIndex * 0.05 }}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!isVirtualSchedule) {
                                  onEditSchedule?.(schedule);
                                }
                              }}
                              className={`event-capsule absolute transition-all ${isVirtualSchedule ? '' : 'cursor-pointer hover:brightness-95 active:scale-95'}`}
                              style={{
                                top: nodeTop,
                                height: Math.max(nodeHeight, SLOT_HEIGHT),
                                width: nodeWidth,
                                left: 8,
                                background: progressBackground,
                                border: capsuleBorder,
                                borderRadius: '9999px',
                                zIndex: colors.zIndex,
                              }}
                            >
                              {!sharesTimeWithPrev && (
                                <div
                                  className="absolute -left-3 flex flex-col items-end"
                                  style={{
                                    transform: 'translateX(-100%)',
                                    top: startTimeShiftUp ? '-12px' : '0',
                                    width: '56px',
                                  }}
                                >
                                  <span
                                    className="block w-full text-right tabular-nums text-[10px] font-medium whitespace-nowrap"
                                    style={{ color: 'var(--color-text)' }}
                                  >
                                    {formatBoundaryTime(
                                      startDate,
                                      uses24HourTime,
                                      schedule.durationMinutes === 0 &&
                                        schedule.virtualKind === 'routineEnd'
                                    )}
                                  </span>
                                </div>
                              )}
                              {isFirstSegment &&
                                schedule.durationMinutes > 0 &&
                                !sharesTimeWithNext && (
                                <div
                                  className="absolute -left-3 bottom-0 flex flex-col items-end"
                                  style={{ transform: 'translateX(-100%)', width: '56px' }}
                                >
                                  <span
                                    className="block w-full text-right tabular-nums text-[10px] font-medium whitespace-nowrap"
                                    style={{ color: 'var(--color-text)' }}
                                  >
                                    {formatBoundaryTime(
                                      endDate,
                                      uses24HourTime,
                                      schedule.virtualKind === 'routineEnd'
                                    )}
                                  </span>
                                </div>
                              )}
                              <div
                                className="w-full h-full rounded-full flex items-center justify-center"
                                style={{
                                  border: `2px solid ${colors.border}`,
                                }}
                              >
                                <div
                                  className="w-7 h-7 rounded-full flex items-center justify-center"
                                  style={{
                                    background: iconBadgeBackground,
                                    border: iconBadgeBorder,
                                    boxShadow: iconBadgeShadow,
                                  }}
                                >
                                  <IconComponent
                                    className="w-4 h-4"
                                    color={iconColor}
                                    strokeWidth={2.4}
                                  />
                                </div>
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
                                  style={{
                                    color: completedSchedules.has(schedule.id)
                                      ? 'var(--color-text-muted)'
                                      : 'var(--color-text)',
                                  }}
                                >
                                  {isMultiSegment
                                    ? `${schedule.title} (${segmentIndex * 2 + 1}-${Math.min((segmentIndex + 1) * 2, 24)}h)`
                                    : schedule.title}
                                </h4>
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span
                                  className="text-[11px]"
                                  style={{ color: 'var(--color-text-secondary)' }}
                                >
                                  {schedule.durationMinutes === 0
                                    ? formatBoundaryTime(
                                        startDate,
                                        uses24HourTime,
                                        schedule.virtualKind === 'routineEnd'
                                      )
                                    : `${formatBoundaryTime(startDate, uses24HourTime)} - ${formatBoundaryTime(endDate, uses24HourTime, schedule.virtualKind === 'routineEnd')}`}
                                </span>
                                {schedule.durationMinutes > 0 ? (
                                  <span
                                    className="text-[10px]"
                                    style={{ color: 'var(--color-text-muted)' }}
                                  >
                                    {t('calendar.duration', { minutes: schedule.durationMinutes })}
                                  </span>
                                ) : (
                                  <span
                                    className="text-[10px]"
                                    style={{ color: 'var(--color-text-muted)' }}
                                  >
                                    {t('calendar.routinePreset')}
                                  </span>
                                )}
                                {schedule.location && isFirstSegment && (
                                  <div className="flex items-center gap-1">
                                    <MapPin
                                      className="w-3 h-3"
                                      style={{ color: 'var(--color-text-muted)' }}
                                    />
                                    <span
                                      className="text-[10px] truncate"
                                      style={{ color: 'var(--color-text-secondary)' }}
                                    >
                                      {schedule.location}
                                    </span>
                                  </div>
                                )}
                              </div>
                              {hasOverlap && isFirstSegment && (
                                <div className="mt-1 flex items-center gap-1">
                                  <AlertCircle
                                    className="w-3 h-3"
                                    style={{ color: 'color-mix(in srgb, var(--color-primary) 70%, #3b82f6)' }}
                                  />
                                  <span
                                    className="text-[10px] font-medium"
                                    style={{ color: 'color-mix(in srgb, var(--color-primary) 70%, #3b82f6)' }}
                                  >
                                    {t('calendar.overlapTask')}
                                  </span>
                                  {overlappingIds.length > 0 && (
                                    <span
                                      className="text-[10px]"
                                      style={{ color: 'var(--color-text-muted)' }}
                                    >
                                      {t('calendar.overlap', { count: overlappingIds.length })}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            {isFirstSegment && !isVirtualSchedule && (
                              <motion.button
                                onClick={() => toggleScheduleComplete(schedule.id)}
                                whileTap={{ scale: 0.85 }}
                                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 ml-3"
                                style={{
                                  backgroundColor: completedSchedules.has(schedule.id)
                                    ? colors.border
                                    : 'transparent',
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

                    {[visibleStartMinutes, visibleEndMinutes].map((minuteValue, index) => {
                      const slot =
                        index === 0 ? 0 : scheduleDisplayLayout.endSlot;
                      const top = slotToTop(slot);
                      const nodeTop = top;
                      const boundaryDate = buildDateFromRoutineMinutes(selectedDate, minuteValue);
                      const hasBoundarySchedule = timelineSchedules.some((schedule) => {
                        const start = parseISO(schedule.startAt);
                        const scheduleMinutes = differenceInMinutes(
                          start,
                          startOfDay(selectedDate)
                        );
                        return scheduleMinutes === minuteValue;
                      });
                      if (hasBoundarySchedule) return null;
                      return (
                        <div
                          key={`virtual-${minuteValue}`}
                          className="absolute -left-3 flex flex-col items-end"
                          style={{ top: nodeTop, transform: 'translateX(-100%)', width: '56px' }}
                        >
                          <span
                            className="block w-full text-right tabular-nums text-[10px] font-medium whitespace-nowrap"
                            style={{ color: 'var(--color-text)' }}
                          >
                            {formatBoundaryTime(boundaryDate, uses24HourTime, index === 1)}
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
