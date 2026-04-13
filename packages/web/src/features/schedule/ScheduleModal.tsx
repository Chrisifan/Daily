import { useState, useEffect, useMemo, useRef } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ChevronDown,
  Repeat,
  Clock,
  Phone,
  Focus,
  Coffee,
  Plane,
  Utensils,
  Dumbbell,
  Moon,
  Calendar,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Ref } from 'react';
import type { ScheduleItem, Priority, RepeatMode, ScheduleIcon } from '../../domain/schedule/types';
import { format, parse } from 'date-fns';
import { DatePicker } from '../../shared/ui/DatePicker';
import { getStoredSettings } from '../../shared/services/settingsService';
import { DropdownContent } from '../../shared/ui/DropdownContent';
import { useAnchoredOverlay } from '../../shared/ui/useAnchoredOverlay';
import {
  createRoutineSelectableTimeOptions,
  formatRoutineTimeLabel,
  normalizeRoutineEndMinutes,
  parseRoutineTime,
} from '../../shared/utils/routineTime';

const DURATION_OPTIONS: { value: number; labelKey: string }[] = [
  { value: 15, labelKey: 'schedule.durationOptions.15min' },
  { value: 30, labelKey: 'schedule.durationOptions.30min' },
  { value: 60, labelKey: 'schedule.durationOptions.1hour' },
  { value: 120, labelKey: 'schedule.durationOptions.2hours' },
  { value: 240, labelKey: 'schedule.durationOptions.4hours' },
];

const ICON_OPTIONS: { value: ScheduleIcon; icon: typeof Clock }[] = [
  { value: 'clock', icon: Clock },
  { value: 'meeting', icon: Calendar },
  { value: 'call', icon: Phone },
  { value: 'focus', icon: Focus },
  { value: 'break', icon: Coffee },
  { value: 'travel', icon: Plane },
  { value: 'meal', icon: Utensils },
  { value: 'exercise', icon: Dumbbell },
  { value: 'sleep', icon: Moon },
];

interface TimeSelectProps {
  value: string;
  onChange: (time: string) => void;
  options: string[];
  durationMinutes: number;
  is12Hour: boolean;
}

const TIME_ALIGNMENT_MINUTES = 15;

function minutesToTimeValue(totalMinutes: number): string {
  const normalizedMinutes = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = Math.floor(normalizedMinutes / 60);
  const minutes = normalizedMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

function buildTimeRangeLabel(
  startTime: string,
  durationMinutes: number,
  is12Hour: boolean
): string {
  const startMinutes = parseRoutineTime(startTime);
  const endMinutes = startMinutes + durationMinutes;
  const displayFormat = is12Hour ? 'hh:mm A' : 'HH:mm';

  return `${formatRoutineTimeLabel(startTime, displayFormat)}-${formatRoutineTimeLabel(
    minutesToTimeValue(endMinutes),
    displayFormat,
    !is12Hour && endMinutes % (24 * 60) === 0
  )}`;
}

function TimeSelect({ value, onChange, options, durationMinutes, is12Hour }: TimeSelectProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selectedIndex = Math.max(options.indexOf(value), 0);
  const visibleRange = 2;
  const visibleSlots = Array.from({ length: visibleRange * 2 + 1 }, (_, offset) => {
    const optionIndex = selectedIndex - visibleRange + offset;
    return optionIndex >= 0 && optionIndex < options.length ? options[optionIndex] : null;
  });

  const stepSelection = (direction: 1 | -1) => {
    const nextIndex = selectedIndex + direction;
    if (nextIndex >= 0 && nextIndex < options.length) {
      onChange(options[nextIndex]);
    }
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (options.length <= 1) return;
    if (event.deltaY > 0) {
      stepSelection(1);
    } else if (event.deltaY < 0) {
      stepSelection(-1);
    }
  };

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const handleNativeWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (options.length <= 1) return;
      if (event.deltaY > 0) {
        stepSelection(1);
      } else if (event.deltaY < 0) {
        stepSelection(-1);
      }
    };

    element.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => {
      element.removeEventListener('wheel', handleNativeWheel);
    };
  }, [options, selectedIndex]);

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden rounded-[24px] px-4 py-3 shadow-[var(--shadow-md)]"
      onWheel={handleWheel}
      onWheelCapture={(event) => event.stopPropagation()}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          event.stopPropagation();
          stepSelection(-1);
        }
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          event.stopPropagation();
          stepSelection(1);
        }
      }}
      style={{
        border: '1px solid var(--color-border)',
        background:
          'linear-gradient(180deg, color-mix(in srgb, var(--color-surface) 96%, transparent), color-mix(in srgb, var(--color-surface-elevated, var(--color-surface)) 92%, var(--color-bg) 8%))',
        overscrollBehavior: 'contain',
        touchAction: 'none',
      }}
    >
      <div
        className="pointer-events-none absolute inset-x-4 top-1/2 h-10 -translate-y-1/2 rounded-full"
        style={{
          background:
            'linear-gradient(135deg, var(--color-primary), color-mix(in srgb, var(--color-primary-hover, var(--color-primary)) 88%, white 12%))',
          boxShadow: '0 10px 24px color-mix(in srgb, var(--color-primary) 24%, transparent)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-8"
        style={{
          background:
            'linear-gradient(180deg, var(--color-surface) 0%, color-mix(in srgb, var(--color-surface) 72%, transparent) 55%, transparent 100%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-8"
        style={{
          background:
            'linear-gradient(0deg, var(--color-surface) 0%, color-mix(in srgb, var(--color-surface) 72%, transparent) 55%, transparent 100%)',
        }}
      />
      <div className="relative flex flex-col items-center">
        {visibleSlots.map((time, index) => {
          const isSelected = time === value;
          const distance = Math.abs(index - visibleRange);
          const opacity = isSelected ? 1 : Math.max(0.18, 1 - distance * 0.28);
          const scale = isSelected ? 1 : 1 - distance * 0.07;

          return (
            <div key={time ?? `empty-${index}`} className="flex h-9 items-center justify-center">
              {time ? (
                <button
                  type="button"
                  onClick={() => onChange(time)}
                  className={`relative flex items-center justify-center rounded-full px-6 text-center transition-all ${
                    isSelected ? 'h-10 min-w-[min(100%,18rem)]' : 'h-9 min-w-[6rem]'
                  }`}
                  style={{
                    opacity,
                    transform: `scale(${scale})`,
                    color: isSelected ? 'var(--color-surface)' : 'var(--color-text-secondary)',
                  }}
                >
                  <span
                    className={`tracking-[-0.02em] ${isSelected ? 'text-[15px] font-semibold' : 'text-[14px] font-medium'}`}
                  >
                    {isSelected
                      ? buildTimeRangeLabel(time, durationMinutes, is12Hour)
                      : formatRoutineTimeLabel(time, is12Hour ? 'hh:mm A' : 'HH:mm')}
                  </span>
                </button>
              ) : (
                <div className="h-9" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface DurationSelectProps {
  value: number;
  onChange: (duration: number) => void;
  maxDurationMinutes?: number;
  t: (key: string, options?: Record<string, unknown>) => string;
}

function DurationSelect({ value, onChange, maxDurationMinutes, t }: DurationSelectProps) {
  return (
    <div
      className="rounded-[24px] p-2"
      style={{
        border: '1px solid var(--color-border)',
        background:
          'linear-gradient(180deg, color-mix(in srgb, var(--color-surface) 96%, transparent), color-mix(in srgb, var(--color-surface-elevated, var(--color-surface)) 92%, var(--color-bg) 8%))',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div className="grid grid-cols-5 gap-2">
        {DURATION_OPTIONS.map((opt) => {
          const isDisabled = maxDurationMinutes !== undefined && opt.value > maxDurationMinutes;
          const isSelected = opt.value === value;

          return (
            <button
              type="button"
              key={opt.value}
              disabled={isDisabled}
              onClick={() => !isDisabled && onChange(opt.value)}
              className="relative flex h-11 items-center justify-center rounded-full px-2 text-sm font-medium transition-all"
              style={{
                background: isSelected
                  ? 'linear-gradient(135deg, var(--color-primary), color-mix(in srgb, var(--color-primary-hover, var(--color-primary)) 88%, white 12%))'
                  : 'transparent',
                color: isSelected
                  ? 'var(--color-surface)'
                  : isDisabled
                    ? 'var(--color-text-muted)'
                    : 'var(--color-text-secondary)',
                boxShadow: isSelected
                  ? '0 10px 24px color-mix(in srgb, var(--color-primary) 22%, transparent)'
                  : 'none',
                opacity: isDisabled ? 0.45 : 1,
                cursor: isDisabled ? 'not-allowed' : 'pointer',
              }}
            >
              <span>{t(opt.labelKey)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface RepeatSelectProps {
  value: RepeatMode;
  onChange: (mode: RepeatMode) => void;
  t: (key: string) => string;
}

function RepeatSelect({ value, onChange, t }: RepeatSelectProps) {
  const repeatModes: RepeatMode[] = [
    'none',
    'daily',
    'weekly',
    'biweekly',
    'monthly',
    'quarterly',
    'semi_annually',
    'annually',
  ];

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="w-full px-4 py-2.5 rounded-xl bg-white/60 border border-gray-200/80 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-transparent transition-all flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <Repeat className="w-4 h-4 text-gray-400" />
            <span>{t(`schedule.repeatModes.${value}`)}</span>
          </div>
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownContent className="bg-white/95 backdrop-blur-xl rounded-xl shadow-lg border border-black/5 z-50 overflow-y-auto">
        {repeatModes.map((mode) => (
          <DropdownMenu.Item
            key={mode}
            onSelect={() => onChange(mode)}
            className={`px-4 py-2 text-left text-sm cursor-pointer transition-colors flex items-center justify-between ${
              mode === value
                ? 'bg-blue-50 text-blue-600 font-medium'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            <span>{t(`schedule.repeatModes.${mode}`)}</span>
          </DropdownMenu.Item>
        ))}
      </DropdownContent>
    </DropdownMenu.Root>
  );
}

interface IconSelectProps {
  value: ScheduleIcon;
  onChange: (icon: ScheduleIcon) => void;
  t: (key: string) => string;
}

function IconSelect({ value, onChange, t }: IconSelectProps) {
  const selectedOption = ICON_OPTIONS.find((opt) => opt.value === value);
  const SelectedIcon = selectedOption?.icon || Clock;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="w-full px-4 py-2.5 rounded-xl bg-white/60 border border-gray-200/80 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-transparent transition-all flex items-center gap-2"
        >
          <SelectedIcon className="w-4 h-4" style={{ color: '#6366f1' }} />
          <span>{t(`schedule.iconLabels.${value}`)}</span>
          <ChevronDown className="w-4 h-4 text-gray-400 ml-auto" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownContent className="bg-white/95 backdrop-blur-xl rounded-xl shadow-lg border border-black/5 z-50 overflow-y-auto">
        {ICON_OPTIONS.map((opt) => {
          const IconComponent = opt.icon;
          return (
            <DropdownMenu.Item
              key={opt.value}
              onSelect={() => onChange(opt.value)}
              className={`px-4 py-2 text-left text-sm cursor-pointer transition-colors flex items-center gap-2 ${
                opt.value === value
                  ? 'bg-blue-50 text-blue-600 font-medium'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <IconComponent className="w-4 h-4" />
              <span>{t(`schedule.iconLabels.${opt.value}`)}</span>
            </DropdownMenu.Item>
          );
        })}
      </DropdownContent>
    </DropdownMenu.Root>
  );
}

interface ScheduleModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (
    data: Omit<ScheduleItem, 'id' | 'source' | 'createdAt' | 'updatedAt'>
  ) => Promise<void> | void;
  onDelete?: () => void;
  initialData?: Partial<ScheduleItem>;
  mode?: 'create' | 'edit';
}

function getInitialValues(initialData?: Partial<ScheduleItem>) {
  if (initialData?.startAt) {
    const start = new Date(initialData.startAt);
    return {
      title: initialData.title || '',
      icon: (initialData.icon || 'clock') as ScheduleIcon,
      notes: initialData.notes || '',
      priority: (initialData.priority || 'medium') as Priority,
      location: initialData.location || '',
      startDate: format(start, 'yyyy-MM-dd'),
      startTime: format(start, 'HH:mm'),
      durationMinutes: initialData.durationMinutes || 30,
      repeatMode: (initialData.repeatMode || 'none') as RepeatMode,
    };
  }
  const now = new Date();
  return {
    title: '',
    icon: 'clock' as ScheduleIcon,
    notes: '',
    priority: 'medium' as Priority,
    location: '',
    startDate: format(now, 'yyyy-MM-dd'),
    startTime: '09:00',
    durationMinutes: 30,
    repeatMode: 'none' as RepeatMode,
  };
}

export function ScheduleModal({
  open,
  onClose,
  onSubmit,
  onDelete,
  initialData,
  mode = 'create',
}: ScheduleModalProps) {
  const { t } = useTranslation();
  const settings = getStoredSettings();
  const is12Hour = settings.timeFormat === 'hh:mm A';
  const initialValues = getInitialValues(initialData);
  const [title, setTitle] = useState(initialValues.title);
  const [icon, setIcon] = useState<ScheduleIcon>(initialValues.icon);
  const [notes, setNotes] = useState(initialValues.notes);
  const [startDate, setStartDate] = useState(initialValues.startDate);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [startTime, setStartTime] = useState(initialValues.startTime);
  const [durationMinutes, setDurationMinutes] = useState(initialValues.durationMinutes);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>(initialValues.repeatMode);
  const [priority, setPriority] = useState<Priority>(initialValues.priority);
  const [location, setLocation] = useState(initialValues.location);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    anchorRef: datePickerTriggerRef,
    contentRef: datePickerContentRef,
    side: datePickerSide,
    style: datePickerStyle,
  } = useAnchoredOverlay({
    open: showDatePicker,
    gap: 8,
    matchTriggerWidth: 'equal',
  });

  useEffect(() => {
    if (open) {
      const values = getInitialValues(initialData);
      setTitle(values.title);
      setIcon(values.icon);
      setNotes(values.notes);
      setStartDate(values.startDate);
      setStartTime(values.startTime);
      setDurationMinutes(values.durationMinutes);
      setRepeatMode(values.repeatMode);
      setPriority(values.priority);
      setLocation(values.location);
      setIsSubmitting(false);
      setSubmitError(null);
    }
  }, [open, initialData]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.date-picker-wrapper')) {
        setShowDatePicker(false);
      }
    };
    if (showDatePicker) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showDatePicker]);

  const parsedStartMinutes = useMemo(() => {
    const candidatePatterns =
      settings.timeFormat === 'hh:mm A' ? ['hh:mm a', 'HH:mm'] : ['HH:mm', 'hh:mm a'];

    for (const pattern of candidatePatterns) {
      const parsedStart = parse(startTime, pattern, new Date());
      if (!Number.isNaN(parsedStart.getTime())) {
        return parsedStart.getHours() * 60 + parsedStart.getMinutes();
      }
    }

    return null;
  }, [settings.timeFormat, startTime]);

  const routineEndBoundaryMinutes = useMemo(() => {
    return Math.min(
      normalizeRoutineEndMinutes(
        parseRoutineTime(settings.routineStartTime),
        parseRoutineTime(settings.routineEndTime)
      ),
      24 * 60
    );
  }, [settings.routineEndTime, settings.routineStartTime]);

  const maxDurationMinutes = useMemo(() => {
    if (parsedStartMinutes === null) {
      return 24 * 60;
    }
    return Math.max(routineEndBoundaryMinutes - parsedStartMinutes, 0);
  }, [parsedStartMinutes, routineEndBoundaryMinutes]);

  useEffect(() => {
    if (maxDurationMinutes <= 0 || durationMinutes <= maxDurationMinutes) {
      return;
    }

    const nextDuration =
      [...DURATION_OPTIONS].reverse().find((option) => option.value <= maxDurationMinutes)?.value ??
      maxDurationMinutes;

    setDurationMinutes(nextDuration);
  }, [durationMinutes, maxDurationMinutes]);

  const availableTimeSlots = useMemo(() => {
    return createRoutineSelectableTimeOptions(
      settings.routineStartTime,
      settings.routineEndTime,
      TIME_ALIGNMENT_MINUTES
    );
  }, [settings.routineEndTime, settings.routineStartTime]);

  const selectableTimeSlots = useMemo(() => {
    const validTimeSlots = availableTimeSlots.filter(
      (time) => routineEndBoundaryMinutes - parseRoutineTime(time) >= durationMinutes
    );
    const selectedStartMinutes = parseRoutineTime(startTime);
    const nextSelectableStartMinutes =
      selectedStartMinutes + durationMinutes + TIME_ALIGNMENT_MINUTES;

    return validTimeSlots.filter((time) => {
      if (time === startTime) {
        return true;
      }

      const timeMinutes = parseRoutineTime(time);
      return timeMinutes >= nextSelectableStartMinutes || timeMinutes < selectedStartMinutes;
    });
  }, [availableTimeSlots, durationMinutes, routineEndBoundaryMinutes, startTime]);

  useEffect(() => {
    if (selectableTimeSlots.length === 0 || selectableTimeSlots.includes(startTime)) {
      return;
    }

    const fallbackTime =
      selectableTimeSlots.find((time) => parseRoutineTime(time) >= parseRoutineTime(startTime)) ??
      selectableTimeSlots[selectableTimeSlots.length - 1];

    setStartTime(fallbackTime);
  }, [selectableTimeSlots, startTime]);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    if (!startDate) return;

    const parsePattern = 'yyyy-MM-dd HH:mm';
    const parsedStartAt = parse(`${startDate} ${startTime}`, parsePattern, new Date());
    if (Number.isNaN(parsedStartAt.getTime())) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    if (durationMinutes > maxDurationMinutes) {
      setSubmitError(t('schedule.exceedRoutine'));
      setIsSubmitting(false);
      return;
    }

    const startAt = parsedStartAt.toISOString();
    const repeatGroupId = repeatMode !== 'none' ? `group-${Date.now()}` : undefined;

    try {
      await onSubmit({
        title: title.trim(),
        icon,
        notes: notes.trim() || undefined,
        startAt,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        durationMinutes,
        repeatMode,
        repeatGroupId,
        location: location.trim() || undefined,
        priority,
        isFlexible: false,
      });
    } catch (error) {
      console.error('Failed to submit schedule:', error);
      setSubmitError(t('schedule.submitFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const isValid = Boolean(
    title.trim() && startDate && startTime && selectableTimeSlots.includes(startTime)
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/40 backdrop-blur-sm cursor-default"
            onClick={onClose}
            aria-label={t('common.close')}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-lg bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 overflow-hidden"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200/50">
              <h2 className="text-lg font-semibold text-gray-800">
                {mode === 'create' ? t('schedule.newSchedule') : t('schedule.editSchedule')}
              </h2>
              <button
                onClick={onClose}
                className="p-1 rounded-full hover:bg-gray-200/50 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
              <div>
                <label
                  htmlFor="schedule-title"
                  className="block text-sm font-medium text-gray-700 mb-1.5"
                >
                  {t('schedule.title')} <span className="text-red-500">*</span>
                </label>
                <input
                  id="schedule-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t('schedule.titlePlaceholder')}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/60 border border-gray-200/80 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {t('schedule.icon')}
                </label>
                <IconSelect value={icon} onChange={setIcon} t={t} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {t('schedule.date')} <span className="text-red-500">*</span>
                </label>
                <div className="relative date-picker-wrapper">
                  <button
                    type="button"
                    ref={datePickerTriggerRef as Ref<HTMLButtonElement>}
                    onClick={() => setShowDatePicker(!showDatePicker)}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/60 border border-gray-200/80 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-transparent transition-all flex items-center justify-between"
                  >
                    <span>{startDate}</span>
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  </button>
                  <AnimatePresence>
                    {showDatePicker && (
                      <DatePicker
                        ref={datePickerContentRef as Ref<HTMLDivElement>}
                        value={parse(startDate, 'yyyy-MM-dd', new Date())}
                        side={datePickerSide}
                        panelStyle={datePickerStyle}
                        onChange={(date) => {
                          setStartDate(format(date, 'yyyy-MM-dd'));
                          setShowDatePicker(false);
                        }}
                        onClose={() => setShowDatePicker(false)}
                      />
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    {t('schedule.startTime')} <span className="text-red-500">*</span>
                  </label>
                  <TimeSelect
                    value={startTime}
                    onChange={setStartTime}
                    options={selectableTimeSlots}
                    durationMinutes={durationMinutes}
                    is12Hour={is12Hour}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    {t('schedule.duration')}
                  </label>
                  <DurationSelect
                    value={durationMinutes}
                    onChange={setDurationMinutes}
                    maxDurationMinutes={maxDurationMinutes}
                    t={t}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {t('schedule.repeat')}
                </label>
                <RepeatSelect value={repeatMode} onChange={setRepeatMode} t={t} />
              </div>

              <div>
                <span className="block text-sm font-medium text-gray-700 mb-1.5">
                  {t('schedule.priority')}
                </span>
                <div className="flex gap-2">
                  {(['low', 'medium', 'high'] as Priority[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        priority === p
                          ? p === 'high'
                            ? 'bg-red-100 text-red-700 border-2 border-red-300'
                            : p === 'medium'
                              ? 'bg-yellow-100 text-yellow-700 border-2 border-yellow-300'
                              : 'bg-green-100 text-green-700 border-2 border-green-300'
                          : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-150'
                      }`}
                    >
                      {t(`schedule.priorityLabels.${p}`)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label
                  htmlFor="schedule-location"
                  className="block text-sm font-medium text-gray-700 mb-1.5"
                >
                  {t('schedule.location')}
                </label>
                <input
                  id="schedule-location"
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder={t('schedule.locationPlaceholder')}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/60 border border-gray-200/80 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label
                  htmlFor="schedule-notes"
                  className="block text-sm font-medium text-gray-700 mb-1.5"
                >
                  {t('schedule.notes')}
                </label>
                <textarea
                  id="schedule-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t('schedule.notesPlaceholder')}
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/60 border border-gray-200/80 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-transparent transition-all resize-none"
                />
              </div>
            </div>

            <div className="flex justify-between px-6 py-4 border-t border-gray-200/50 bg-gray-50/50">
              <div>
                {mode === 'edit' && onDelete && (
                  <button
                    onClick={onDelete}
                    className="px-5 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                  >
                    {t('schedule.deleteSchedule')}
                  </button>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                {submitError && (
                  <p className="text-xs" style={{ color: 'var(--color-error, #ef4444)' }}>
                    {submitError}
                  </p>
                )}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-200/50 transition-colors"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!isValid || isSubmitting}
                    className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all"
                    style={{
                      minWidth: 96,
                      color:
                        isValid && !isSubmitting
                          ? 'var(--color-surface)'
                          : 'var(--color-text-secondary)',
                      background:
                        isValid && !isSubmitting
                          ? 'linear-gradient(135deg, var(--color-primary), color-mix(in srgb, var(--color-primary) 82%, black))'
                          : 'linear-gradient(180deg, color-mix(in srgb, var(--color-surface) 96%, transparent) 0%, color-mix(in srgb, var(--color-surface) 84%, var(--color-bg) 16%) 100%)',
                      border:
                        isValid && !isSubmitting
                          ? '1px solid color-mix(in srgb, var(--color-primary) 70%, black)'
                          : '1px solid var(--color-border)',
                      boxShadow:
                        isValid && !isSubmitting
                          ? '0 10px 22px color-mix(in srgb, var(--color-primary) 28%, transparent)'
                          : 'var(--shadow-sm)',
                      cursor: isValid && !isSubmitting ? 'pointer' : 'not-allowed',
                      opacity: 1,
                    }}
                  >
                    {isSubmitting
                      ? t('settings.saving')
                      : mode === 'create'
                        ? t('schedule.create')
                        : t('schedule.save')}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
