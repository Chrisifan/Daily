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
  BookOpen,
  BriefcaseBusiness,
  ShoppingBag,
  House,
  Music4,
  HeartPulse,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Ref } from 'react';
import type { ScheduleItem, Priority, RepeatMode, ScheduleIcon } from '../../domain/schedule/types';
import type { Workspace } from '../../domain/workspace/types';
import { format, parse } from 'date-fns';
import { DatePicker } from '../../shared/ui/DatePicker';
import { getStoredSettings } from '../../shared/services/settingsService';
import { DropdownContent } from '../../shared/ui/DropdownContent';
import { SegmentedControl } from '../../shared/ui/SegmentedControl';
import { useToast } from '../../shared/ui/ToastProvider';
import { useAnchoredOverlay } from '../../shared/ui/useAnchoredOverlay';
import { PRIORITY_STYLES } from '../../shared/constants/priority';
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
  { value: 'study', icon: BookOpen },
  { value: 'work', icon: BriefcaseBusiness },
  { value: 'shopping', icon: ShoppingBag },
  { value: 'home', icon: House },
  { value: 'music', icon: Music4 },
  { value: 'health', icon: HeartPulse },
];

const PRIORITY_OPTIONS: { value: Priority; labelKey: string }[] = [
  { value: 'low', labelKey: 'schedule.priorityLabels.low' },
  { value: 'medium', labelKey: 'schedule.priorityLabels.medium' },
  { value: 'high', labelKey: 'schedule.priorityLabels.high' },
];

interface TimeSelectProps {
  value: string;
  onChange: (time: string) => void;
  options: string[];
  disabledOptions?: ReadonlySet<string>;
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

function TimeSelect({
  value,
  onChange,
  options,
  disabledOptions,
  durationMinutes,
  is12Hour,
}: TimeSelectProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wheelDeltaAccumulatorRef = useRef(0);
  const lastWheelStepTimestampRef = useRef(0);
  const selectedIndex = Math.max(options.indexOf(value), 0);
  const visibleRange = 2;
  const visibleSlots = Array.from({ length: visibleRange * 2 + 1 }, (_, offset) => {
    const optionIndex = selectedIndex - visibleRange + offset;
    return optionIndex >= 0 && optionIndex < options.length ? options[optionIndex] : null;
  });
  const wheelStepThreshold = 32;
  const wheelStepCooldownMs = 120;
  const isOptionDisabled = (time: string) => disabledOptions?.has(time) ?? false;

  const stepSelection = (direction: 1 | -1) => {
    for (
      let nextIndex = selectedIndex + direction;
      nextIndex >= 0 && nextIndex < options.length;
      nextIndex += direction
    ) {
      const nextValue = options[nextIndex];
      if (!isOptionDisabled(nextValue)) {
        onChange(nextValue);
        return;
      }
    }
  };

  const resetWheelState = () => {
    wheelDeltaAccumulatorRef.current = 0;
    lastWheelStepTimestampRef.current = 0;
  };

  const handleWheelDelta = (deltaY: number, deltaMode: number, timeStamp: number) => {
    if (options.length <= 1 || deltaY === 0) return;

    const normalizedDelta =
      deltaMode === WheelEvent.DOM_DELTA_LINE
        ? deltaY * 16
        : deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? deltaY * window.innerHeight
          : deltaY;

    wheelDeltaAccumulatorRef.current += normalizedDelta;

    if (Math.abs(wheelDeltaAccumulatorRef.current) < wheelStepThreshold) {
      return;
    }

    if (timeStamp - lastWheelStepTimestampRef.current < wheelStepCooldownMs) {
      return;
    }

    stepSelection(wheelDeltaAccumulatorRef.current > 0 ? 1 : -1);
    wheelDeltaAccumulatorRef.current = 0;
    lastWheelStepTimestampRef.current = timeStamp;
  };

  const handleWheelCapture = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    handleWheelDelta(event.deltaY, event.deltaMode, event.timeStamp);
  };

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const handleNativeWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      handleWheelDelta(event.deltaY, event.deltaMode, event.timeStamp);
    };

    element.addEventListener('wheel', handleNativeWheel, { passive: false, capture: true });
    return () => {
      element.removeEventListener('wheel', handleNativeWheel, true);
    };
  }, [options, selectedIndex]);

  return (
    <div
      ref={containerRef}
      data-time-select-root="true"
      className="relative overflow-hidden rounded-[24px] px-4 py-3 shadow-[var(--shadow-md)]"
      onWheelCapture={handleWheelCapture}
      onPointerEnter={() => containerRef.current?.focus()}
      onPointerLeave={resetWheelState}
      onBlur={resetWheelState}
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
          const isDisabled = time ? isOptionDisabled(time) : false;
          const opacity = isSelected
            ? 1
            : isDisabled
              ? Math.max(0.12, 0.48 - distance * 0.16)
              : Math.max(0.18, 1 - distance * 0.28);
          const scale = isSelected ? 1 : 1 - distance * 0.07;

          return (
            <div key={time ?? `empty-${index}`} className="flex h-9 items-center justify-center">
              {time ? (
                <button
                  type="button"
                  disabled={isDisabled}
                  onClick={() => {
                    if (!isDisabled) {
                      onChange(time);
                    }
                  }}
                  className={`relative flex items-center justify-center rounded-full px-6 text-center transition-all ${
                    isSelected ? 'h-10 min-w-[min(100%,18rem)]' : 'h-9 min-w-[6rem]'
                  }`}
                  style={{
                    opacity,
                    transform: `scale(${scale})`,
                    color: isSelected
                      ? 'var(--color-surface)'
                      : isDisabled
                        ? 'var(--color-text-muted)'
                        : 'var(--color-text-secondary)',
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
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
  const selectedOption = DURATION_OPTIONS.find((opt) => opt.value === value);

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="flex h-8 w-full items-center justify-between rounded-xl border border-gray-200/80 bg-white/60 px-4 text-gray-800 transition-all focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-transparent"
        >
          <span className="text-[13px] font-medium text-[var(--color-text-secondary)]">
            {selectedOption ? t(selectedOption.labelKey) : value}
          </span>
          <ChevronDown className="h-4 w-4 text-gray-400" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownContent className="z-50 overflow-y-auto rounded-xl border border-black/5 bg-white/95 shadow-lg backdrop-blur-xl">
        {DURATION_OPTIONS.map((opt) => {
          const isDisabled = maxDurationMinutes !== undefined && opt.value > maxDurationMinutes;
          const isSelected = opt.value === value;

          return (
            <DropdownMenu.Item
              key={opt.value}
              disabled={isDisabled}
              onSelect={() => !isDisabled && onChange(opt.value)}
              className="flex h-8 items-center px-3 text-sm outline-none transition-colors data-[disabled]:pointer-events-none"
              style={{
                color: isSelected
                  ? 'var(--color-primary)'
                  : isDisabled
                    ? 'var(--color-text-muted)'
                    : 'var(--color-text)',
                background: isSelected
                  ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)'
                  : 'transparent',
                opacity: isDisabled ? 0.45 : 1,
              }}
            >
              {t(opt.labelKey)}
            </DropdownMenu.Item>
          );
        })}
      </DropdownContent>
    </DropdownMenu.Root>
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
          className="flex h-8 w-full items-center justify-between rounded-xl border border-gray-200/80 bg-white/60 px-4 text-gray-800 transition-all focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-transparent"
        >
          <div className="flex items-center gap-2">
            <Repeat className="w-4 h-4 text-gray-400" />
            <span className="text-[13px]">{t(`schedule.repeatModes.${value}`)}</span>
          </div>
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownContent className="bg-white/95 backdrop-blur-xl rounded-xl shadow-lg border border-black/5 z-50 overflow-y-auto">
        {repeatModes.map((mode) => (
          <DropdownMenu.Item
            key={mode}
            onSelect={() => onChange(mode)}
            className={`flex h-8 items-center justify-between px-4 text-left text-sm cursor-pointer transition-colors ${
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

interface WorkspaceSelectProps {
  value?: string;
  onChange: (workspaceId?: string) => void;
  workspaces: Workspace[];
  t: (key: string) => string;
}

function WorkspaceSelect({ value, onChange, workspaces, t }: WorkspaceSelectProps) {
  const selectedWorkspace = workspaces.find((workspace) => workspace.id === value);

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="flex h-8 w-full items-center justify-between rounded-xl border border-gray-200/80 bg-white/60 px-4 text-gray-800 transition-all focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-transparent"
        >
          <div className="flex min-w-0 items-center gap-2">
            {selectedWorkspace ? (
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: selectedWorkspace.color }}
              />
            ) : (
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: 'var(--color-border)' }}
              />
            )}
            <span className="truncate text-[13px] font-medium text-[var(--color-text-secondary)]">
              {selectedWorkspace ? selectedWorkspace.name : t('schedule.workspacePlaceholder')}
            </span>
          </div>
          <ChevronDown className="h-4 w-4 text-gray-400" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownContent className="z-50 overflow-y-auto rounded-xl border border-black/5 bg-white/95 shadow-lg backdrop-blur-xl">
        <DropdownMenu.Item
          onSelect={() => onChange(undefined)}
          className="flex h-8 items-center gap-2 px-3 text-sm outline-none transition-colors"
          style={{
            color: value === undefined ? 'var(--color-primary)' : 'var(--color-text)',
            background:
              value === undefined
                ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)'
                : 'transparent',
          }}
        >
          <span
            className="h-2.5 w-2.5 rounded-full shrink-0"
            style={{ backgroundColor: 'var(--color-border)' }}
          />
          {t('schedule.noWorkspace')}
        </DropdownMenu.Item>
        {workspaces.map((workspace) => {
          const isSelected = workspace.id === value;

          return (
            <DropdownMenu.Item
              key={workspace.id}
              onSelect={() => onChange(workspace.id)}
              className="flex h-8 items-center gap-2 px-3 text-sm outline-none transition-colors"
              style={{
                color: isSelected ? 'var(--color-primary)' : 'var(--color-text)',
                background: isSelected
                  ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)'
                  : 'transparent',
              }}
            >
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: workspace.color }}
              />
              <span className="truncate">{workspace.name}</span>
            </DropdownMenu.Item>
          );
        })}
      </DropdownContent>
    </DropdownMenu.Root>
  );
}

function IconSelect({ value, onChange, t }: IconSelectProps) {
  const [open, setOpen] = useState(false);
  const selectedOption = ICON_OPTIONS.find((opt) => opt.value === value);
  const SelectedIcon = selectedOption?.icon || Clock;

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="flex h-8 w-full items-center gap-3 rounded-xl border border-gray-200/80 bg-white/60 px-3 text-gray-800 transition-all focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-transparent"
        >
          <span
            className="flex h-6 w-6 items-center justify-center rounded-full"
            style={{
              border: '1px solid color-mix(in srgb, var(--color-border) 82%, white 18%)',
              background:
                'linear-gradient(180deg, color-mix(in srgb, white 92%, var(--color-surface) 8%), color-mix(in srgb, var(--color-surface) 94%, var(--color-bg) 6%))',
              boxShadow: '0 8px 18px color-mix(in srgb, black 10%, transparent)',
            }}
          >
            <SelectedIcon className="h-3.5 w-3.5" style={{ color: 'var(--color-primary)' }} />
          </span>
          <div className="min-w-0 flex-1 text-left">
            <p className="truncate text-[13px] font-medium text-gray-800">{t(`schedule.iconLabels.${value}`)}</p>
          </div>
          <ChevronDown className="ml-auto h-4 w-4 text-gray-400" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownContent
        className="z-50 overflow-hidden rounded-[28px] border border-black/5 bg-white/95 shadow-lg backdrop-blur-xl"
        style={{
          width: 'var(--radix-popper-anchor-width)',
          minWidth: 'var(--radix-popper-anchor-width)',
          maxWidth: 'min(var(--radix-popper-available-width), calc(100vw - 2rem))',
          maxHeight: 'min(var(--radix-popper-available-height), 24rem)',
        }}
      >
        <div
          className="overflow-y-auto overflow-x-hidden p-4"
          style={{
            maxHeight: 'min(var(--radix-popper-available-height), 24rem)',
          }}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-5 gap-1.5">
              {ICON_OPTIONS.map((opt) => {
                const IconComponent = opt.icon;
                const isSelected = opt.value === value;

                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    className="group flex flex-col items-center gap-1 rounded-[18px] px-1 py-1.5 text-center transition-all"
                    style={{
                      background: isSelected
                        ? 'linear-gradient(180deg, color-mix(in srgb, var(--color-primary) 14%, white 86%), color-mix(in srgb, var(--color-surface) 90%, var(--color-primary) 10%))'
                        : 'transparent',
                    }}
                  >
                    <span
                      className="flex items-center justify-center rounded-full transition-all"
                      style={{
                        width: '3rem',
                        height: '3rem',
                        border: isSelected
                          ? '1px solid color-mix(in srgb, var(--color-primary) 34%, white 66%)'
                          : '1px solid color-mix(in srgb, var(--color-border) 82%, white 18%)',
                        background:
                          'linear-gradient(180deg, color-mix(in srgb, white 94%, var(--color-surface) 6%), color-mix(in srgb, var(--color-surface) 92%, var(--color-bg) 8%))',
                        boxShadow: isSelected
                          ? '0 12px 28px color-mix(in srgb, var(--color-primary) 18%, transparent)'
                          : '0 10px 22px color-mix(in srgb, black 10%, transparent)',
                      }}
                    >
                      <IconComponent
                        className="h-4.5 w-4.5"
                        style={{
                          color: isSelected ? 'var(--color-primary)' : 'var(--color-text)',
                        }}
                      />
                    </span>
                    <span
                      className="text-[10px] font-medium leading-tight"
                      style={{
                        color: isSelected ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                      }}
                    >
                      {t(`schedule.iconLabels.${opt.value}`)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </DropdownContent>
    </DropdownMenu.Root>
  );
}

interface PrioritySelectProps {
  value: Priority;
  onChange: (priority: Priority) => void;
  t: (key: string) => string;
}

function PrioritySelect({ value, onChange, t }: PrioritySelectProps) {
  return (
    <SegmentedControl
      value={value}
      onChange={(nextValue) => onChange(nextValue as Priority)}
      options={PRIORITY_OPTIONS.map((opt) => ({
        value: opt.value,
        label: t(opt.labelKey),
        selectedBackground: PRIORITY_STYLES[opt.value].selectedBackground,
        selectedColor: PRIORITY_STYLES[opt.value].selectedColor,
        selectedBoxShadow: PRIORITY_STYLES[opt.value].selectedBoxShadow,
      }))}
    />
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
  schedules?: ScheduleItem[];
  workspaces?: Workspace[];
  mode?: 'create' | 'edit';
}

type ModalStep = 1 | 2;

function getInitialValues(initialData?: Partial<ScheduleItem>) {
  if (initialData?.startAt) {
    const start = new Date(initialData.startAt);
    return {
      title: initialData.title || '',
      icon: (initialData.icon || 'clock') as ScheduleIcon,
      notes: initialData.notes || '',
      priority: (initialData.priority || 'medium') as Priority,
      location: initialData.location || '',
      workspaceId: initialData.workspaceId,
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
    workspaceId: undefined,
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
  schedules = [],
  workspaces = [],
  mode = 'create',
}: ScheduleModalProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const settings = getStoredSettings();
  const is12Hour = settings.timeFormat === 'hh:mm A';
  const initialValues = getInitialValues(initialData);
  const [currentStep, setCurrentStep] = useState<ModalStep>(1);
  const [stepDirection, setStepDirection] = useState<1 | -1>(1);
  const [title, setTitle] = useState(initialValues.title);
  const [icon, setIcon] = useState<ScheduleIcon>(initialValues.icon);
  const [notes, setNotes] = useState(initialValues.notes);
  const [workspaceId, setWorkspaceId] = useState<string | undefined>(initialValues.workspaceId);
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
      setWorkspaceId(values.workspaceId);
      setStartDate(values.startDate);
      setStartTime(values.startTime);
      setDurationMinutes(values.durationMinutes);
      setRepeatMode(values.repeatMode);
      setPriority(values.priority);
      setLocation(values.location);
      setCurrentStep(1);
      setStepDirection(1);
      setShowDatePicker(false);
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

  const handleModalWheelCapture = (event: React.WheelEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest('[data-time-select-root="true"]')) {
      event.preventDefault();
    }
  };

  const goToStep = (nextStep: ModalStep) => {
    if (nextStep === currentStep) {
      return;
    }

    setStepDirection(nextStep > currentStep ? 1 : -1);
    setCurrentStep(nextStep);
    setShowDatePicker(false);
    setSubmitError(null);
  };

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

  const disabledStartTimeOptions = useMemo(() => {
    const disabledTimes = new Set<string>();

    schedules.forEach((schedule) => {
      if (schedule.id === initialData?.id) {
        return;
      }

      const scheduleDate = format(new Date(schedule.startAt), 'yyyy-MM-dd');
      if (scheduleDate !== startDate) {
        return;
      }

      disabledTimes.add(format(new Date(schedule.startAt), 'HH:mm'));
    });

    return disabledTimes;
  }, [initialData?.id, schedules, startDate]);

  const enabledSelectableTimeSlots = useMemo(() => {
    return selectableTimeSlots.filter((time) => !disabledStartTimeOptions.has(time));
  }, [disabledStartTimeOptions, selectableTimeSlots]);

  useEffect(() => {
    if (
      selectableTimeSlots.length === 0 ||
      (selectableTimeSlots.includes(startTime) && !disabledStartTimeOptions.has(startTime))
    ) {
      return;
    }

    const fallbackTime =
      enabledSelectableTimeSlots.find(
        (time) => parseRoutineTime(time) >= parseRoutineTime(startTime)
      ) ?? enabledSelectableTimeSlots[enabledSelectableTimeSlots.length - 1];

    if (fallbackTime) {
      setStartTime(fallbackTime);
    }
  }, [disabledStartTimeOptions, enabledSelectableTimeSlots, selectableTimeSlots, startTime]);

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
        workspaceId,
        startAt,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        durationMinutes,
        repeatMode,
        repeatGroupId,
        location: location.trim() || undefined,
        priority,
        isFlexible: false,
      });
      toast.success(mode === 'create' ? t('feedback.scheduleCreated') : t('feedback.scheduleUpdated'));
    } catch (error) {
      console.error('Failed to submit schedule:', error);
      setSubmitError(t('schedule.submitFailed'));
      toast.error(mode === 'create' ? t('feedback.scheduleCreateFailed') : t('feedback.scheduleUpdateFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const isValid = Boolean(
    title.trim() &&
      startDate &&
      startTime &&
      selectableTimeSlots.includes(startTime) &&
      !disabledStartTimeOptions.has(startTime)
  );
  const canProceedToScheduling = Boolean(title.trim());
  const primaryButtonDisabled =
    currentStep === 1 ? !canProceedToScheduling : !isValid || isSubmitting;
  const stepPanelVariants = {
    enter: (direction: 1 | -1) => ({
      opacity: 0,
      x: direction > 0 ? 36 : -36,
      filter: 'blur(8px)',
    }),
    center: {
      opacity: 1,
      x: 0,
      filter: 'blur(0px)',
      transition: {
        duration: 0.24,
        ease: [0.22, 1, 0.36, 1] as const,
      },
    },
    exit: (direction: 1 | -1) => ({
      opacity: 0,
      x: direction > 0 ? -36 : 36,
      filter: 'blur(6px)',
      transition: {
        duration: 0.18,
        ease: [0.4, 0, 1, 1] as const,
      },
    }),
  };

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
            aria-label={t('common.close')}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-[34rem] rounded-3xl border border-white/50 bg-white/80 shadow-2xl backdrop-blur-xl overflow-visible"
          >
            <div className="border-b border-gray-200/50 px-5 py-3.5">
              <div className="flex items-center justify-between gap-4">
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
            </div>

            <div className="relative h-[440px] overflow-visible" onWheelCapture={handleModalWheelCapture}>
              <AnimatePresence custom={stepDirection} initial={false} mode="wait">
                {currentStep === 1 ? (
                  <motion.div
                    key="details-step"
                    custom={stepDirection}
                    variants={stepPanelVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    className="absolute inset-0 grid content-start gap-3 px-5 py-4"
                  >
                    <div>
                      <label
                        htmlFor="schedule-title"
                        className="mb-1 block text-sm font-medium text-gray-700"
                      >
                        {t('schedule.title')} <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="schedule-title"
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder={t('schedule.titlePlaceholder')}
                        className="h-8 w-full rounded-xl border border-gray-200/80 bg-white/60 px-4 text-[13px] text-gray-800 placeholder-gray-400 transition-all focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        {t('schedule.icon')}
                      </label>
                      <IconSelect value={icon} onChange={setIcon} t={t} />
                    </div>

                    <div>
                      <span className="mb-1 block text-sm font-medium text-gray-700">
                        {t('schedule.priority')}
                      </span>
                      <PrioritySelect value={priority} onChange={setPriority} t={t} />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        {t('schedule.workspace')}
                      </label>
                      <WorkspaceSelect
                        value={workspaceId}
                        onChange={setWorkspaceId}
                        workspaces={workspaces}
                        t={t}
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="schedule-location"
                        className="mb-1 block text-sm font-medium text-gray-700"
                      >
                        {t('schedule.location')}
                      </label>
                      <input
                        id="schedule-location"
                        type="text"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder={t('schedule.locationPlaceholder')}
                        className="h-8 w-full rounded-xl border border-gray-200/80 bg-white/60 px-4 text-[13px] text-gray-800 placeholder-gray-400 transition-all focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="schedule-notes"
                        className="mb-1 block text-sm font-medium text-gray-700"
                      >
                        {t('schedule.notes')}
                      </label>
                      <textarea
                        id="schedule-notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder={t('schedule.notesPlaceholder')}
                        rows={1}
                        className="min-h-8 w-full rounded-xl border border-gray-200/80 bg-white/60 px-4 py-1.5 text-[13px] text-gray-800 placeholder-gray-400 transition-all focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-transparent resize-none"
                      />
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="schedule-step"
                    custom={stepDirection}
                    variants={stepPanelVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    className="absolute inset-0 grid content-start gap-3 px-5 py-4"
                  >
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        {t('schedule.date')} <span className="text-red-500">*</span>
                      </label>
                      <div className="relative date-picker-wrapper">
                        <button
                          type="button"
                          ref={datePickerTriggerRef as Ref<HTMLButtonElement>}
                          onClick={() => setShowDatePicker(!showDatePicker)}
                          className="flex h-8 w-full items-center justify-between rounded-xl border border-gray-200/80 bg-white/60 px-4 text-[13px] text-gray-800 transition-all focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-transparent"
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

                    <div className="space-y-3">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                          {t('schedule.startTime')} <span className="text-red-500">*</span>
                        </label>
                        <TimeSelect
                          value={startTime}
                          onChange={setStartTime}
                          options={selectableTimeSlots}
                          disabledOptions={disabledStartTimeOptions}
                          durationMinutes={durationMinutes}
                          is12Hour={is12Hour}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
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
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        {t('schedule.repeat')}
                      </label>
                      <RepeatSelect value={repeatMode} onChange={setRepeatMode} t={t} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex justify-between px-5 py-3.5 border-t border-gray-200/50 bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div
                  className="rounded-full px-3 py-1.5"
                  style={{
                    border: '1px solid var(--color-border)',
                    background:
                      'linear-gradient(180deg, color-mix(in srgb, var(--color-surface) 96%, transparent), color-mix(in srgb, var(--color-surface-elevated, var(--color-surface)) 92%, var(--color-bg) 8%))',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  <span className="text-[11px] font-semibold tracking-[0.18em] text-gray-400">
                    {currentStep} / 2
                  </span>
                </div>
                {mode === 'edit' && onDelete && (
                  <button
                    onClick={onDelete}
                    className="px-4 py-2 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
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
                  {currentStep === 2 && (
                    <button
                      type="button"
                      onClick={() => goToStep(1)}
                      className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all"
                      style={{
                        minWidth: 96,
                        color: 'var(--color-text-secondary)',
                        background:
                          'linear-gradient(180deg, color-mix(in srgb, var(--color-surface) 96%, transparent) 0%, color-mix(in srgb, var(--color-surface) 84%, var(--color-bg) 16%) 100%)',
                        border: '1px solid var(--color-border)',
                        boxShadow: 'var(--shadow-sm)',
                      }}
                    >
                      {t('common.back')}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (currentStep === 1) {
                        goToStep(2);
                        return;
                      }

                      handleSubmit();
                    }}
                    disabled={primaryButtonDisabled}
                    className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all"
                    style={{
                      minWidth: 96,
                      color: !primaryButtonDisabled
                        ? 'var(--color-surface)'
                        : 'var(--color-text-secondary)',
                      background: !primaryButtonDisabled
                        ? 'linear-gradient(135deg, var(--color-primary), color-mix(in srgb, var(--color-primary) 82%, black))'
                        : 'linear-gradient(180deg, color-mix(in srgb, var(--color-surface) 96%, transparent) 0%, color-mix(in srgb, var(--color-surface) 84%, var(--color-bg) 16%) 100%)',
                      border: !primaryButtonDisabled
                        ? '1px solid color-mix(in srgb, var(--color-primary) 70%, black)'
                        : '1px solid var(--color-border)',
                      boxShadow: !primaryButtonDisabled
                        ? '0 10px 22px color-mix(in srgb, var(--color-primary) 28%, transparent)'
                        : 'var(--shadow-sm)',
                      cursor: !primaryButtonDisabled ? 'pointer' : 'not-allowed',
                      opacity: 1,
                    }}
                  >
                    {currentStep === 1
                      ? t('common.next')
                      : isSubmitting
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
