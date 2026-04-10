import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronDown, ChevronUp, Repeat, Clock, Phone, Focus, Coffee, Plane, Utensils, Dumbbell, Moon, Calendar } from "lucide-react";
import type { ScheduleItem, Priority, RepeatMode, ScheduleIcon } from "../../domain/schedule/types";
import { REPEAT_MODE_LABELS, SCHEDULE_ICON_LABELS } from "../../domain/schedule/types";
import { format, parse } from "date-fns";
import { DatePicker } from "../../shared/ui/DatePicker";

const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const hours = Math.floor(i / 2);
  const minutes = (i % 2) * 30;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
});

const DURATION_OPTIONS = [
  { value: 15, label: "15分钟" },
  { value: 30, label: "30分钟" },
  { value: 45, label: "45分钟" },
  { value: 60, label: "1小时" },
  { value: 90, label: "1.5小时" },
  { value: 120, label: "2小时" },
  { value: 180, label: "3小时" },
  { value: 240, label: "4小时" },
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
}

function TimeSelect({ value, onChange }: TimeSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div ref={ref} className="relative flex-1">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="w-full px-4 py-2.5 rounded-xl bg-white/60 border border-gray-200/80 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-transparent transition-all flex items-center justify-between"
      >
        <span>{value}</span>
        {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            className="absolute top-full left-0 right-0 mt-1 bg-white/95 backdrop-blur-xl rounded-xl shadow-lg border border-black/5 z-50 max-h-48 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {TIME_SLOTS.map((time) => (
              <button
                key={time}
                onClick={() => {
                  onChange(time);
                  setIsOpen(false);
                }}
                className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                  time === value 
                    ? "bg-blue-50 text-blue-600 font-medium" 
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                {time}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface DurationSelectProps {
  value: number;
  onChange: (duration: number) => void;
  maxDurationMinutes?: number;
}

function DurationSelect({ value, onChange, maxDurationMinutes }: DurationSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [isOpen]);

  const selectedLabel = DURATION_OPTIONS.find(d => d.value === value)?.label || `${value}分钟`;

  return (
    <div ref={ref} className="relative flex-1">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="w-full px-4 py-2.5 rounded-xl bg-white/60 border border-gray-200/80 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-transparent transition-all flex items-center justify-between"
      >
        <span>{selectedLabel}</span>
        {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            className="absolute top-full left-0 right-0 mt-1 bg-white/95 backdrop-blur-xl rounded-xl shadow-lg border border-black/5 z-50"
            onClick={(e) => e.stopPropagation()}
          >
            {DURATION_OPTIONS.map((opt) => {
              const isDisabled = maxDurationMinutes !== undefined && opt.value > maxDurationMinutes;
              return (
                <button
                  key={opt.value}
                  onClick={() => {
                    if (!isDisabled) {
                      onChange(opt.value);
                      setIsOpen(false);
                    }
                  }}
                  className={`w-full px-4 py-2 text-left text-sm transition-colors flex items-center justify-between ${
                    opt.value === value 
                      ? "bg-blue-50 text-blue-600 font-medium" 
                      : isDisabled
                      ? "text-gray-300 cursor-not-allowed"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <span>{opt.label}</span>
                  {isDisabled && <span className="text-[10px] text-gray-400">超出当天</span>}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface RepeatSelectProps {
  value: RepeatMode;
  onChange: (mode: RepeatMode) => void;
}

function RepeatSelect({ value, onChange }: RepeatSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [isOpen]);

  const repeatModes: RepeatMode[] = ["none", "daily", "weekly", "biweekly", "monthly", "quarterly", "semi_annually", "annually"];

  return (
    <div ref={ref} className="relative flex-1">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="w-full px-4 py-2.5 rounded-xl bg-white/60 border border-gray-200/80 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-transparent transition-all flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Repeat className="w-4 h-4 text-gray-400" />
          <span>{REPEAT_MODE_LABELS[value]}</span>
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            className="absolute top-full left-0 right-0 mt-1 bg-white/95 backdrop-blur-xl rounded-xl shadow-lg border border-black/5 z-50"
            onClick={(e) => e.stopPropagation()}
          >
            {repeatModes.map((mode) => (
              <button
                key={mode}
                onClick={() => {
                  onChange(mode);
                  setIsOpen(false);
                }}
                className={`w-full px-4 py-2 text-left text-sm transition-colors flex items-center justify-between ${
                  mode === value 
                    ? "bg-blue-50 text-blue-600 font-medium" 
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <span>{REPEAT_MODE_LABELS[mode]}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface IconSelectProps {
  value: ScheduleIcon;
  onChange: (icon: ScheduleIcon) => void;
}

function IconSelect({ value, onChange }: IconSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [isOpen]);

  const selectedOption = ICON_OPTIONS.find(opt => opt.value === value);
  const SelectedIcon = selectedOption?.icon || Clock;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="w-full px-4 py-2.5 rounded-xl bg-white/60 border border-gray-200/80 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-transparent transition-all flex items-center gap-2"
      >
        <SelectedIcon className="w-4 h-4" style={{ color: "#6366f1" }} />
        <span>{SCHEDULE_ICON_LABELS[value]}</span>
        {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400 ml-auto" /> : <ChevronDown className="w-4 h-4 text-gray-400 ml-auto" />}
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            className="absolute top-full left-0 right-0 mt-1 bg-white/95 backdrop-blur-xl rounded-xl shadow-lg border border-black/5 z-50"
            onClick={(e) => e.stopPropagation()}
          >
            {ICON_OPTIONS.map((opt) => {
              const IconComponent = opt.icon;
              return (
                <button
                  key={opt.value}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`w-full px-4 py-2 text-left text-sm transition-colors flex items-center gap-2 ${
                    opt.value === value 
                      ? "bg-blue-50 text-blue-600 font-medium" 
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <IconComponent className="w-4 h-4" />
                  <span>{SCHEDULE_ICON_LABELS[opt.value]}</span>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface ScheduleModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<ScheduleItem, "id" | "source" | "createdAt" | "updatedAt">) => void;
  onDelete?: () => void;
  initialData?: Partial<ScheduleItem>;
  mode?: "create" | "edit";
}

function getInitialValues(initialData?: Partial<ScheduleItem>) {
  if (initialData?.startAt) {
    const start = new Date(initialData.startAt);
    return {
      title: initialData.title || "",
      icon: (initialData.icon || "clock") as ScheduleIcon,
      notes: initialData.notes || "",
      priority: (initialData.priority || "medium") as Priority,
      location: initialData.location || "",
      isFlexible: initialData.isFlexible || false,
      startDate: format(start, "yyyy-MM-dd"),
      startTime: format(start, "HH:mm"),
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
    isFlexible: false,
    startDate: format(now, "yyyy-MM-dd"),
    startTime: "09:00",
    durationMinutes: 30,
    repeatMode: "none" as RepeatMode,
  };
}

export function ScheduleModal({ open, onClose, onSubmit, onDelete, initialData, mode = "create" }: ScheduleModalProps) {
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
  const [isFlexible, setIsFlexible] = useState(initialValues.isFlexible);

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
      setIsFlexible(values.isFlexible);
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
    const [hours, minutes] = startTime.split(':').map(Number);
    const startMinutes = hours * 60 + minutes;
    const endOfDayMinutes = 24 * 60;
    return endOfDayMinutes - startMinutes;
  }, [startTime]);

  const handleSubmit = () => {
    if (!title.trim()) return;
    if (!startDate) return;

    const startAt = new Date(`${startDate}T${startTime}:00`).toISOString();
    const repeatGroupId = repeatMode !== "none" ? `group-${Date.now()}` : undefined;

    onSubmit({
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
      isFlexible,
    });
    onClose();
  };

  const isValid = title.trim() && startDate && startTime;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <button type="button" className="absolute inset-0 bg-black/40 backdrop-blur-sm cursor-default" onClick={onClose} aria-label="关闭" />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-lg bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 overflow-hidden"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200/50">
              <h2 className="text-lg font-semibold text-gray-800">
                {mode === "create" ? "新建日程" : "编辑日程"}
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
                  标题 <span className="text-red-500">*</span>
                </label>
                <input
                  id="schedule-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="输入日程标题"
                  className="w-full px-4 py-2.5 rounded-xl bg-white/60 border border-gray-200/80 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  图标
                </label>
                <IconSelect value={icon} onChange={setIcon} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  日期 <span className="text-red-500">*</span>
                </label>
                <div className="relative date-picker-wrapper">
                  <button
                    type="button"
                    onClick={() => setShowDatePicker(!showDatePicker)}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/60 border border-gray-200/80 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-transparent transition-all flex items-center justify-between"
                  >
                    <span>{startDate}</span>
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  </button>
                  <AnimatePresence>
                    {showDatePicker && (
                      <DatePicker
                        value={parse(startDate, 'yyyy-MM-dd', new Date())}
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
                    开始时间 <span className="text-red-500">*</span>
                  </label>
                  <TimeSelect value={startTime} onChange={setStartTime} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    时长
                  </label>
                  <DurationSelect value={durationMinutes} onChange={setDurationMinutes} maxDurationMinutes={maxDurationMinutes} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  重复
                </label>
                <RepeatSelect value={repeatMode} onChange={setRepeatMode} />
              </div>

              <div>
                <span className="block text-sm font-medium text-gray-700 mb-1.5">
                  优先级
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
                      {p === "high" ? "高" : p === "medium" ? "中" : "低"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="schedule-location" className="block text-sm font-medium text-gray-700 mb-1.5">
                  位置
                </label>
                <input
                  id="schedule-location"
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="输入地点（可选）"
                  className="w-full px-4 py-2.5 rounded-xl bg-white/60 border border-gray-200/80 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label htmlFor="schedule-notes" className="block text-sm font-medium text-gray-700 mb-1.5">
                  备注
                </label>
                <textarea
                  id="schedule-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="添加备注（可选）"
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/60 border border-gray-200/80 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-transparent transition-all resize-none"
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsFlexible(!isFlexible)}
                  className={`w-10 h-6 rounded-full transition-all ${
                    isFlexible ? "bg-blue-500" : "bg-gray-300"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                      isFlexible ? "translate-x-5" : "translate-x-1"
                    }`}
                  />
                </button>
                <span className="text-sm text-gray-700">灵活时间</span>
              </div>
            </div>

            <div className="flex justify-between px-6 py-4 border-t border-gray-200/50 bg-gray-50/50">
              <div>
                {mode === "edit" && onDelete && (
                  <button
                    onClick={onDelete}
                    className="px-5 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                  >
                    删除日程
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-200/50 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!isValid}
                  className={`px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-all ${
                    isValid
                      ? "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-sm"
                      : "bg-gray-300 cursor-not-allowed"
                  }`}
                >
                  {mode === "create" ? "创建" : "保存"}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
