import { useState, useEffect, useMemo, useRef } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronDown, Repeat, Clock, Phone, Focus, Coffee, Plane, Utensils, Dumbbell, Moon, Calendar } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Ref } from "react";
import type { ScheduleItem, Priority, RepeatMode, ScheduleIcon } from "../../domain/schedule/types";
import { format, parse } from "date-fns";
import { DatePicker } from "../../shared/ui/DatePicker";
import { getStoredSettings } from "../../shared/services/settingsService";
import { DropdownContent } from "../../shared/ui/DropdownContent";
import { useAnchoredOverlay } from "../../shared/ui/useAnchoredOverlay";
import { createRoutineSelectableTimeOptions } from "../../shared/utils/routineTime";

const DURATION_OPTIONS: { value: number; labelKey: string }[] = [
  { value: 15, labelKey: "schedule.durationOptions.15min" },
  { value: 30, labelKey: "schedule.durationOptions.30min" },
  { value: 45, labelKey: "schedule.durationOptions.45min" },
  { value: 60, labelKey: "schedule.durationOptions.1hour" },
  { value: 90, labelKey: "schedule.durationOptions.1.5hour" },
  { value: 120, labelKey: "schedule.durationOptions.2hours" },
  { value: 180, labelKey: "schedule.durationOptions.3hours" },
  { value: 240, labelKey: "schedule.durationOptions.4hours" },
];

const ICON_OPTIONS: { value: ScheduleIcon; icon: typeof Clock }[] = [
  { value: "clock", icon: Clock },
  { value: "meeting", icon: Calendar },
  { value: "call", icon: Phone },
  { value: "focus", icon: Focus },
  { value: "break", icon: Coffee },
  { value: "travel", icon: Plane },
  { value: "meal", icon: Utensils },
  { value: "exercise", icon: Dumbbell },
  { value: "sleep", icon: Moon },
];

interface TimeSelectProps {
  value: string;
  onChange: (time: string) => void;
  options: string[];
}

function TimeSelect({ value, onChange, options }: TimeSelectProps) {
  const is12Hour = getStoredSettings().timeFormat === "hh:mm A";
  const [open, setOpen] = useState(false);
  const selectedItemRef = useRef<HTMLDivElement | null>(null);

  const timeSlots = useMemo(() => {
    const baseOptions = options.length > 0 ? options : ["09:00"];
    if (!baseOptions.includes(value)) {
      return [value, ...baseOptions];
    }
    return baseOptions;
  }, [options, value]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      selectedItemRef.current?.scrollIntoView({ block: "center" });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [open, value]);

  const formatOptionLabel = (time: string) => {
    if (!is12Hour) {
      return time;
    }

    const [hoursRaw, minutesRaw] = time.split(":").map(Number);
    const hour12 = hoursRaw === 0 ? 12 : hoursRaw > 12 ? hoursRaw - 12 : hoursRaw;
    const ampm = hoursRaw < 12 ? "AM" : "PM";
    return `${hour12}:${minutesRaw.toString().padStart(2, "0")} ${ampm}`;
  };

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="w-full px-4 py-2.5 rounded-xl bg-white/60 border border-gray-200/80 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-transparent transition-all flex items-center justify-between"
        >
          <span>{formatOptionLabel(value)}</span>
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownContent className="bg-white/95 backdrop-blur-xl rounded-xl shadow-lg border border-black/5 z-50 overflow-y-auto">
        {timeSlots.map((time) => (
          <DropdownMenu.Item
            key={time}
            ref={time === value ? selectedItemRef : undefined}
            onSelect={() => onChange(time)}
            className={`px-4 py-2 text-left text-sm cursor-pointer transition-colors ${
              time === value
                ? "bg-blue-50 text-blue-600 font-medium"
                : "text-gray-700 hover:bg-gray-50"
            }`}
          >
            {formatOptionLabel(time)}
          </DropdownMenu.Item>
        ))}
      </DropdownContent>
    </DropdownMenu.Root>
  );
}

interface DurationSelectProps {
  value: number;
  onChange: (duration: number) => void;
  maxDurationMinutes?: number;
  t: (key: string, options?: Record<string, unknown>) => string;
}

function DurationSelect({ value, onChange, maxDurationMinutes, t }: DurationSelectProps) {
  const selectedOpt = DURATION_OPTIONS.find(d => d.value === value);
  const selectedLabel = selectedOpt ? t(selectedOpt.labelKey) : t("calendar.duration", { minutes: value });

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="w-full px-4 py-2.5 rounded-xl bg-white/60 border border-gray-200/80 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-transparent transition-all flex items-center justify-between"
        >
          <span>{selectedLabel}</span>
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownContent className="bg-white/95 backdrop-blur-xl rounded-xl shadow-lg border border-black/5 z-50 overflow-y-auto">
        {DURATION_OPTIONS.map((opt) => {
          const isDisabled = maxDurationMinutes !== undefined && opt.value > maxDurationMinutes;
          return (
            <DropdownMenu.Item
              key={opt.value}
              disabled={isDisabled}
              onSelect={() => !isDisabled && onChange(opt.value)}
              className={`px-4 py-2 text-left text-sm cursor-pointer transition-colors flex items-center justify-between ${
                opt.value === value
                  ? "bg-blue-50 text-blue-600 font-medium"
                  : isDisabled
                    ? "text-gray-300 cursor-not-allowed"
                    : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              <span>{t(opt.labelKey)}</span>
              {isDisabled && <span className="text-[10px] text-gray-400">{t("schedule.exceedDay")}</span>}
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
  const repeatModes: RepeatMode[] = ["none", "daily", "weekly", "biweekly", "monthly", "quarterly", "semi_annually", "annually"];

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
                ? "bg-blue-50 text-blue-600 font-medium"
                : "text-gray-700 hover:bg-gray-50"
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
  const selectedOption = ICON_OPTIONS.find(opt => opt.value === value);
  const SelectedIcon = selectedOption?.icon || Clock;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="w-full px-4 py-2.5 rounded-xl bg-white/60 border border-gray-200/80 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-transparent transition-all flex items-center gap-2"
        >
          <SelectedIcon className="w-4 h-4" style={{ color: "#6366f1" }} />
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
                  ? "bg-blue-50 text-blue-600 font-medium"
                  : "text-gray-700 hover:bg-gray-50"
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
  onSubmit: (data: Omit<ScheduleItem, "id" | "source" | "createdAt" | "updatedAt">) => Promise<void> | void;
  onDelete?: () => void;
  initialData?: Partial<ScheduleItem>;
  mode?: "create" | "edit";
}

function getInitialValues(initialData?: Partial<ScheduleItem>) {
  const is12Hour = getStoredSettings().timeFormat === "hh:mm A";
  if (initialData?.startAt) {
    const start = new Date(initialData.startAt);
    return {
      title: initialData.title || "",
      icon: (initialData.icon || "clock") as ScheduleIcon,
      notes: initialData.notes || "",
      priority: (initialData.priority || "medium") as Priority,
      location: initialData.location || "",
      startDate: format(start, "yyyy-MM-dd"),
      startTime: format(start, is12Hour ? "hh:mm a" : "HH:mm"),
      durationMinutes: initialData.durationMinutes || 30,
      repeatMode: (initialData.repeatMode || "none") as RepeatMode,
    };
  }
  const now = new Date();
  return {
    title: "",
    icon: "clock" as ScheduleIcon,
    notes: "",
    priority: "medium" as Priority,
    location: "",
    startDate: format(now, "yyyy-MM-dd"),
    startTime: is12Hour ? "09:00 AM" : "09:00",
    durationMinutes: 30,
    repeatMode: "none" as RepeatMode,
  };
}

export function ScheduleModal({ open, onClose, onSubmit, onDelete, initialData, mode = "create" }: ScheduleModalProps) {
  const { t } = useTranslation();
  const settings = getStoredSettings();
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
    matchTriggerWidth: "equal",
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
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [showDatePicker]);

  const maxDurationMinutes = useMemo(() => {
    const parsePattern = settings.timeFormat === "hh:mm A" ? "hh:mm a" : "HH:mm";
    const parsedStart = parse(startTime, parsePattern, new Date());
    if (Number.isNaN(parsedStart.getTime())) {
      return 24 * 60;
    }
    const startMinutes = parsedStart.getHours() * 60 + parsedStart.getMinutes();
    const endOfDayMinutes = 24 * 60;
    return endOfDayMinutes - startMinutes;
  }, [settings.timeFormat, startTime]);

  const availableTimeSlots = useMemo(() => {
    return createRoutineSelectableTimeOptions(settings.routineStartTime, settings.routineEndTime);
  }, [settings.routineEndTime, settings.routineStartTime]);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    if (!startDate) return;

    const parsePattern = settings.timeFormat === "hh:mm A" ? "yyyy-MM-dd hh:mm a" : "yyyy-MM-dd HH:mm";
    const parsedStartAt = parse(`${startDate} ${startTime}`, parsePattern, new Date());
    if (Number.isNaN(parsedStartAt.getTime())) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    const startAt = parsedStartAt.toISOString();
    const repeatGroupId = repeatMode !== "none" ? `group-${Date.now()}` : undefined;

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
      console.error("Failed to submit schedule:", error);
      setSubmitError(t("schedule.submitFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const isValid = Boolean(title.trim() && startDate && startTime);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <button type="button" className="absolute inset-0 bg-black/40 backdrop-blur-sm cursor-default" onClick={onClose} aria-label={t("common.close")} />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-lg bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 overflow-hidden"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200/50">
              <h2 className="text-lg font-semibold text-gray-800">
                {mode === "create" ? t("schedule.newSchedule") : t("schedule.editSchedule")}
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
                <label htmlFor="schedule-title" className="block text-sm font-medium text-gray-700 mb-1.5">
                  {t("schedule.title")} <span className="text-red-500">*</span>
                </label>
                <input
                  id="schedule-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t("schedule.titlePlaceholder")}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/60 border border-gray-200/80 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {t("schedule.icon")}
                </label>
                <IconSelect value={icon} onChange={setIcon} t={t} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {t("schedule.date")} <span className="text-red-500">*</span>
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    {t("schedule.startTime")} <span className="text-red-500">*</span>
                  </label>
                  <TimeSelect value={startTime} onChange={setStartTime} options={availableTimeSlots} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    {t("schedule.duration")}
                  </label>
                  <DurationSelect value={durationMinutes} onChange={setDurationMinutes} maxDurationMinutes={maxDurationMinutes} t={t} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {t("schedule.repeat")}
                </label>
                <RepeatSelect value={repeatMode} onChange={setRepeatMode} t={t} />
              </div>

              <div>
                <span className="block text-sm font-medium text-gray-700 mb-1.5">
                  {t("schedule.priority")}
                </span>
                <div className="flex gap-2">
                  {(["low", "medium", "high"] as Priority[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        priority === p
                          ? p === "high"
                            ? "bg-red-100 text-red-700 border-2 border-red-300"
                            : p === "medium"
                            ? "bg-yellow-100 text-yellow-700 border-2 border-yellow-300"
                            : "bg-green-100 text-green-700 border-2 border-green-300"
                          : "bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-150"
                      }`}
                    >
                      {t(`schedule.priorityLabels.${p}`)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="schedule-location" className="block text-sm font-medium text-gray-700 mb-1.5">
                  {t("schedule.location")}
                </label>
                <input
                  id="schedule-location"
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder={t("schedule.locationPlaceholder")}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/60 border border-gray-200/80 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label htmlFor="schedule-notes" className="block text-sm font-medium text-gray-700 mb-1.5">
                  {t("schedule.notes")}
                </label>
                <textarea
                  id="schedule-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t("schedule.notesPlaceholder")}
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/60 border border-gray-200/80 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-transparent transition-all resize-none"
                />
              </div>

            </div>

            <div className="flex justify-between px-6 py-4 border-t border-gray-200/50 bg-gray-50/50">
              <div>
                    {mode === "edit" && onDelete && (
                      <button
                        onClick={onDelete}
                        className="px-5 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                      >
                        {t("schedule.deleteSchedule")}
                      </button>
                    )}
              </div>
              <div className="flex flex-col items-end gap-2">
                {submitError && (
                  <p className="text-xs" style={{ color: "var(--color-error, #ef4444)" }}>
                    {submitError}
                  </p>
                )}
                <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-200/50 transition-colors"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!isValid || isSubmitting}
                  className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all"
                  style={{
                    minWidth: 96,
                    color: isValid && !isSubmitting ? "#ffffff" : "#6b7280",
                    background: isValid && !isSubmitting
                      ? "linear-gradient(135deg, var(--color-primary), color-mix(in srgb, var(--color-primary) 82%, black))"
                      : "linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%)",
                    border: isValid && !isSubmitting
                      ? "1px solid color-mix(in srgb, var(--color-primary) 70%, black)"
                      : "1px solid #d7dde6",
                    boxShadow: isValid && !isSubmitting
                      ? "0 10px 22px color-mix(in srgb, var(--color-primary) 28%, transparent)"
                      : "0 2px 8px rgba(15, 23, 42, 0.08)",
                    cursor: isValid && !isSubmitting ? "pointer" : "not-allowed",
                    opacity: 1,
                  }}
                >
                  {isSubmitting ? t("settings.saving") : mode === "create" ? t("schedule.create") : t("schedule.save")}
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
