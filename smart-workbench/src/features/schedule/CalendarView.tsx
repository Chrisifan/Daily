import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Inbox, ChevronLeft, ChevronRight, ChevronDown, Plus } from "lucide-react";
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
} from "date-fns";
import type { ScheduleItem } from "../../domain/schedule/types";

interface CalendarViewProps {
  schedules: ScheduleItem[];
  onEditSchedule?: (schedule: ScheduleItem) => void;
  onAddSchedule?: (date?: Date) => void;
}

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
const MONTHS = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];

const SLOT_HEIGHT = 32; // 每半小时 32px
const HOURS_IN_DAY = 24;
const TOTAL_SLOTS = HOURS_IN_DAY * 2; // 48 个半小时槽位
const TIMELINE_HEIGHT = TOTAL_SLOTS * SLOT_HEIGHT; // 1536px

// 生成时间选项：00:00, 00:30, 01:00, ...
const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const hours = Math.floor(i / 2);
  const minutes = (i % 2) * 30;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
});

export function CalendarView({ schedules, onEditSchedule, onAddSchedule }: CalendarViewProps) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<'day' | 'month'>('day');
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
  const [pickerMonth, setPickerMonth] = useState(new Date().getMonth());
  const pickerRef = useRef<HTMLDivElement>(null);

  // 计算某时间点在当天中的"半小时槽位"索引
  const getSlotIndex = useCallback((date: Date): number => {
    const dayStart = startOfDay(selectedDate);
    const minutes = differenceInMinutes(date, dayStart);
    return Math.max(0, Math.min(Math.floor(minutes / 30), TOTAL_SLOTS - 1));
  }, [selectedDate]);

  // 根据槽位索引计算 top 位置
  const slotToTop = useCallback((slot: number): number => {
    return slot * SLOT_HEIGHT;
  }, []);

  // 获取选中日期的所有日程（排序后）
  const daySchedules = useMemo(() => {
    return schedules
      .filter((s) => {
        if (!s.startAt) return false;
        const start = parseISO(s.startAt);
        return isSameDay(start, selectedDate);
      })
      .sort((a, b) => parseISO(a.startAt).getTime() - parseISO(b.startAt).getTime());
  }, [schedules, selectedDate]);

  // 计算当前时间线的位置
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

  // 点击时间轴空白区域添加日程
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).closest('.timeline-content')) {
      const rect = e.currentTarget.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const slotIndex = Math.floor(y / SLOT_HEIGHT);
      const clickedTime = TIME_SLOTS[Math.min(slotIndex, TIME_SLOTS.length - 1)];
      const [hours, minutes] = clickedTime.split(':').map(Number);
      const clickedDate = new Date(selectedDate);
      clickedDate.setHours(hours, minutes, 0, 0);
      onAddSchedule?.(clickedDate);
    }
  };

  return (
    <div 
      className="flex flex-row w-full"
      style={{
        minHeight: "calc(100vh - 48px)",
      }}
    >
      {/* 左侧边栏 */}
      <div 
        className="flex flex-col justify-center items-center w-72 lg:w-84 p-4 lg:p-6"
      >
        <div className="space-y-6">
          <div className="flex flex-col items-center text-center gap-2">
            <div 
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: "rgba(63,86,214,0.12)" }}
            >
              <Inbox className="w-6 h-6" style={{ color: "#3f56d6" }} />
            </div>
            <h3 className="text-sm font-semibold" style={{ color: "#1f2329" }}>
              您的想法或任务
            </h3>
            <p className="text-xs leading-relaxed" style={{ color: "rgba(31,35,41,0.6)" }}>
              随时记录您的想法或任务，按照时间轴进行移动
            </p>
          </div>
        </div>

        <div className="space-y-2 pt-4">
          <button
            onClick={() => onAddSchedule?.(selectedDate)}
            className="py-2.5 px-4 rounded-xl text-white text-sm font-medium flex items-center justify-center gap-2 transition-all hover:brightness-110"
            style={{ background: "linear-gradient(180deg, #7d8cff, #6070f7)", boxShadow: "0 4px 12px rgba(96,112,247,0.3)" }}
          >
            <Plus className="w-4 h-4" />
            添加日程
          </button>
        </div>
      </div>

      {/* 右侧内容区 */}
      <div className="flex flex-col flex-1">
        {/* 顶部导航 */}
        <div className="px-4 py-3 lg:px-6 lg:py-4">
          <header className="flex items-center justify-between gap-3 mb-2 px-4">
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
                    style={{ color: "rgba(31,35,41,0.6)" }} 
                  />
                </button>

                <AnimatePresence>
                  {showDatePicker && (
                    <motion.div
                      initial={{ opacity: 0, y: -4, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.98 }}
                      transition={{ duration: 0.12 }}
                      className="absolute top-full left-0 mt-2 p-3 bg-white/90 backdrop-blur-xl rounded-xl shadow-lg border border-black/5 z-50 w-max"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {pickerMode === 'day' ? (
                        <>
                          <div className="flex items-center justify-between gap-4 mb-2">
                            <button
                              onClick={() => setPickerMode('month')}
                              className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md transition-colors"
                              style={{ color: "#1f2329", backgroundColor: "rgba(63,86,214,0.12)" }}
                            >
                              {pickerYear}年{MONTHS[pickerMonth]}
                              <ChevronDown className="w-3 h-3" />
                            </button>
                          </div>

                          <div className="grid grid-cols-7 gap-0.5 mb-1">
                            {WEEKDAYS.map((d) => (
                              <div key={d} className="text-center text-[10px] py-1" style={{ color: "rgba(31,35,41,0.6)" }}>
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
                                      backgroundColor: isSelected ? "#3f56d6" : isDayToday ? "rgba(63,86,214,0.12)" : "transparent",
                                      color: isSelected ? "white" : isDayToday ? "#3f56d6" : isCurrentMonth ? "#1f2329" : "rgba(31,35,41,0.35)",
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
                              style={{ color: "rgba(31,35,41,0.6)", backgroundColor: "rgba(63,86,214,0.06)" }}
                            >
                              <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="text-sm font-semibold" style={{ color: "#1f2329" }}>{pickerYear}年</span>
                            <button
                              onClick={() => handleYearChange(1)}
                              className="w-6 h-6 flex items-center justify-center rounded-md transition-colors"
                              style={{ color: "rgba(31,35,41,0.6)", backgroundColor: "rgba(63,86,214,0.06)" }}
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
                                    backgroundColor: isSelected ? "#3f56d6" : "rgba(63,86,214,0.06)",
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
              <div className="flex items-center rounded-lg p-0.5" style={{ backgroundColor: "rgba(255,255,255,0.54)" }}>
                <button
                  onClick={handlePrevWeek}
                  className="w-7 h-7 rounded-md flex items-center justify-center transition-colors"
                  style={{ color: "rgba(31,35,41,0.6)" }}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setSelectedDate(new Date())}
                  className="px-2 h-7 rounded-md text-xs font-medium transition-colors"
                  style={{ color: "#3f56d6" }}
                >
                  今天
                </button>
                <button
                  onClick={handleNextWeek}
                  className="w-7 h-7 rounded-md flex items-center justify-center transition-colors"
                  style={{ color: "rgba(31,35,41,0.6)" }}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </header>

          {/* 周视图 */}
          <div className="grid grid-cols-7 gap-1">
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
                    style={{ color: "rgba(31,35,41,0.6)" }}
                  >
                    周{WEEKDAYS[i]}
                  </span>
                  <div 
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold transition-all"
                    style={{ 
                      color: isActive || isDayToday ? "white" : "#1f2329", 
                      backgroundColor: isActive || isDayToday ? "#3f56d6" : "transparent" 
                    }}
                  >
                    {format(day, "d")}
                  </div>
                  <div className="flex items-center gap-0.5 h-3 mt-0.5">
                    {daySchedulesCount > 0 && (
                      <>
                        <span 
                          className="w-1.5 h-1.5 rounded-full" 
                          style={{ backgroundColor: isActive || isDayToday ? "rgba(255,255,255,0.9)" : "#3f56d6" }} 
                        />
                        {daySchedulesCount > 1 && (
                          <span 
                            className="w-1.5 h-1.5 rounded-full" 
                            style={{ backgroundColor: isActive || isDayToday ? "rgba(255,255,255,0.5)" : "rgba(63,86,214,0.5)" }} 
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

        {/* 时间轴区域 */}
        <div 
          className="flex-1 flex flex-col px-4 pb-4 lg:px-6 lg:pb-6"
        >
          <div 
            className="flex-1 flex items-stretch rounded-2xl overflow-hidden"
            style={{ 
              backgroundColor: "rgba(255,255,255,0.85)",
              boxShadow: "0 8px 32px rgba(74,83,97,0.12)",
              maxHeight: "calc(100vh - 220px)",
              overflowY: "auto",
            }}
          >
            {/* 左侧时间刻度 */}
            <div 
              className="flex flex-col py-3 px-2 text-[10px] font-medium shrink-0"
              style={{ color: "rgba(31,35,41,0.6)" }}
            >
              {TIME_SLOTS.filter((_, i) => i % 2 === 0).map((time, i) => (
                <div
                  key={i}
                  className="flex items-start"
                  style={{ height: SLOT_HEIGHT * 2 }}
                >
                  <span className="mt-[-6px]">{time}</span>
                </div>
              ))}
            </div>


            <div 
              className="flex-1 relative overflow-y-auto"
              style={{ height: TIMELINE_HEIGHT }}
              onClick={handleTimelineClick}
            >
              {/* 时间轴背景网格线 */}
              <div className="absolute inset-0">
                {TIME_SLOTS.map((_, i) => (
                  <div
                    key={i}
                    className="absolute left-0 right-0"
                    style={{ 
                      top: i * SLOT_HEIGHT,
                      height: SLOT_HEIGHT,
                      borderTop: i % 2 === 0 ? '1px solid rgba(63,86,214,0.1)' : '1px dashed rgba(63,86,214,0.05)',
                    }}
                  />
                ))}
              </div>

              {/* 当前时间线 */}
              {currentTimeSlot >= 0 && (
                <div
                  className="absolute left-0 right-0 h-0.5 z-20"
                  style={{ 
                    top: slotToTop(currentTimeSlot),
                    backgroundColor: "#ef4444",
                  }}
                >
                  <div 
                    className="absolute left-0 w-2 h-2 rounded-full -mt-0.5"
                    style={{ backgroundColor: "#ef4444" }}
                  />
                  <span className="absolute left-3 text-[10px] font-medium text-red-500 -mt-2">
                    现在
                  </span>
                </div>
              )}

              {/* 日程内容区 */}
              <div className="absolute inset-0 timeline-content">
                {daySchedules.length === 0 ? (
                  /* 无日程时显示起始和结束标记 */
                  <>
                    {/* 起始时间标记 */}
                    <div
                      className="absolute left-4 flex items-center gap-2"
                      style={{ top: 0 }}
                    >
                      <div 
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: "#3f56d6" }}
                      />
                      <span className="text-xs font-medium" style={{ color: "rgba(31,35,41,0.6)" }}>
                        00:00 开始
                      </span>
                    </div>
                    {/* 结束时间标记 */}
                    <div
                      className="absolute left-4 flex items-center gap-2"
                      style={{ top: TIMELINE_HEIGHT - SLOT_HEIGHT }}
                    >
                      <div 
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: "#3f56d6" }}
                      />
                      <span className="text-xs font-medium" style={{ color: "rgba(31,35,41,0.6)" }}>
                        24:00 结束
                      </span>
                    </div>
                  </>
                ) : (
                  /* 有日程时显示日程卡片和连接线 */
                  daySchedules.map((schedule, index) => {
                    const startDate = parseISO(schedule.startAt);
                    const endDate = parseISO(schedule.endAt);
                    const startSlot = getSlotIndex(startDate);
                    const endSlot = getSlotIndex(endDate);
                    const durationSlots = Math.max(endSlot - startSlot, 1);
                    
                    // 计算与上一个日程的间隔
                    let showDashedLine = false;
                    let dashedLineTop = 0;
                    let dashedLineHeight = 0;
                    
                    if (index > 0) {
                      const prevEndSlot = getSlotIndex(parseISO(daySchedules[index - 1].endAt));
                      const gap = startSlot - prevEndSlot;
                      if (gap > 1) { // 间隔超过 30 分钟
                        showDashedLine = true;
                        dashedLineTop = slotToTop(prevEndSlot) + SLOT_HEIGHT;
                        dashedLineHeight = slotToTop(startSlot) - dashedLineTop;
                      }
                    }

                    return (
                      <div key={schedule.id}>
                        {/* 虚线连接 */}
                        {showDashedLine && (
                          <div
                            className="absolute left-6 w-0.5"
                            style={{
                              top: dashedLineTop,
                              height: dashedLineHeight,
                              borderLeft: "1px dashed rgba(63,86,214,0.3)",
                            }}
                          />
                        )}
                        
                        {/* 日程卡片 */}
                        <motion.button
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.2 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditSchedule?.(schedule);
                          }}
                          className="absolute left-4 right-4 rounded-lg p-2 text-left overflow-hidden cursor-pointer hover:brightness-95 transition-all"
                          style={{ 
                            top: slotToTop(startSlot),
                            height: Math.max(durationSlots * SLOT_HEIGHT - 4, SLOT_HEIGHT - 4),
                            backgroundColor: schedule.priority === 'high' ? 'rgba(239,68,68,0.1)' : 
                                           schedule.priority === 'medium' ? 'rgba(63,86,214,0.1)' : 
                                           'rgba(16,185,129,0.1)',
                            borderLeft: `3px solid ${
                              schedule.priority === 'high' ? '#ef4444' : 
                              schedule.priority === 'medium' ? '#3f56d6' : 
                              '#10b981'
                            }`,
                          }}
                        >
                          <div className="flex flex-col gap-0.5 h-full">
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] font-medium" style={{ color: "rgba(31,35,41,0.6)" }}>
                                {format(startDate, "HH:mm")}
                              </span>
                              <span className="text-[10px]" style={{ color: "rgba(31,35,41,0.4)" }}>-</span>
                              <span className="text-[10px] font-medium" style={{ color: "rgba(31,35,41,0.6)" }}>
                                {format(endDate, "HH:mm")}
                              </span>
                            </div>
                            <p className="text-xs font-semibold truncate" style={{ color: "#1f2329" }}>
                              {schedule.title}
                            </p>
                            {schedule.location && (
                              <p className="text-[10px] truncate" style={{ color: "rgba(31,35,41,0.5)" }}>
                                📍 {schedule.location}
                              </p>
                            )}
                          </div>
                        </motion.button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}