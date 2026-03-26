import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  isToday,
  isWithinInterval,
  parseISO,
  differenceInDays,
} from "date-fns";
import { zhCN } from "date-fns/locale";
import type { ScheduleItem } from "../../domain/schedule/types";

interface CalendarViewProps {
  schedules: ScheduleItem[];
  onEditSchedule?: (schedule: ScheduleItem) => void;
  onAddSchedule?: (date: Date) => void;
}

export function CalendarView({ schedules, onEditSchedule, onAddSchedule }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getSchedulesForDay = useMemo(() => {
    return (day: Date): ScheduleItem[] => {
      return schedules.filter((schedule) => {
        const start = parseISO(schedule.startAt);
        const end = parseISO(schedule.endAt);
        
        if (differenceInDays(end, start) === 0) {
          return isSameDay(start, day);
        }
        
        return isWithinInterval(day, { start, end });
      });
    };
  }, [schedules]);

  const isScheduleStart = useMemo(() => {
    return (schedule: ScheduleItem, day: Date): boolean => {
      const start = parseISO(schedule.startAt);
      return isSameDay(start, day);
    };
  }, []);

  const priorityColors = {
    high: { bg: "bg-red-500", text: "text-red-600", light: "bg-red-50" },
    medium: { bg: "bg-yellow-500", text: "text-yellow-600", light: "bg-yellow-50" },
    low: { bg: "bg-green-500", text: "text-green-600", light: "bg-green-50" },
  };

  const handleDayClick = (day: Date) => {
    const dayKey = format(day, "yyyy-MM-dd");
    if (expandedDay === dayKey) {
      setExpandedDay(null);
    } else {
      setExpandedDay(dayKey);
    }
  };

  const handleAddClick = (e: React.MouseEvent, day: Date) => {
    e.stopPropagation();
    onAddSchedule?.(day);
  };

  const handleScheduleClick = (e: React.MouseEvent, schedule: ScheduleItem) => {
    e.stopPropagation();
    onEditSchedule?.(schedule);
  };

  return (
    <div className="bg-white/60 backdrop-blur-xl rounded-3xl border border-white/50 shadow-lg overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200/50">
        <h2 className="text-xl font-semibold text-gray-800">
          {format(currentMonth, "yyyy年 M月", { locale: zhCN })}
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="p-2 rounded-xl hover:bg-gray-200/50 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <button
            onClick={() => setCurrentMonth(new Date())}
            className="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-200/50 transition-colors"
          >
            今天
          </button>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-2 rounded-xl hover:bg-gray-200/50 transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7">
        {["周一", "周二", "周三", "周四", "周五", "周六", "周日"].map((day) => (
          <div
            key={day}
            className="py-3 text-center text-sm font-medium text-gray-500 border-b border-gray-200/50"
          >
            {day}
          </div>
        ))}

        {days.map((day, idx) => {
          const dayKey = format(day, "yyyy-MM-dd");
          const daySchedules = getSchedulesForDay(day);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isExpanded = expandedDay === dayKey;
          const today = isToday(day);
          const hasMany = daySchedules.length > 3;
          const visibleSchedules = isExpanded ? daySchedules : daySchedules.slice(0, 3);

          return (
            <motion.div
              key={dayKey}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: idx * 0.005 }}
              onClick={() => handleDayClick(day)}
              className={`
                min-h-[100px] p-2 border-b border-r border-gray-200/50 cursor-pointer transition-all
                ${!isCurrentMonth ? "bg-gray-50/30" : "bg-white/30"}
                ${isExpanded ? "bg-blue-50/50 ring-2 ring-blue-400/30 z-10" : "hover:bg-gray-100/30"}
              `}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`
                    inline-flex items-center justify-center w-7 h-7 rounded-full text-sm
                    ${today ? "bg-blue-500 text-white font-semibold" : ""}
                    ${!isCurrentMonth ? "text-gray-300" : "text-gray-700"}
                  `}
                >
                  {format(day, "d")}
                </span>
                <button
                  onClick={(e) => handleAddClick(e, day)}
                  className="p-0.5 rounded hover:bg-gray-200/50 transition-opacity"
                >
                  <span className="text-xs text-gray-400 hover:text-gray-600">+</span>
                </button>
              </div>

              <div className="space-y-0.5">
                {visibleSchedules.map((schedule) => {
                  const isStart = isScheduleStart(schedule, day);
                  const colors = priorityColors[schedule.priority];
                  
                  return (
                    <motion.button
                      key={`${schedule.id}-${dayKey}`}
                      initial={{ scale: 0.95 }}
                      animate={{ scale: 1 }}
                      onClick={(e) => handleScheduleClick(e, schedule)}
                      className={`
                        w-full text-left px-1.5 py-0.5 rounded text-xs truncate transition-all
                        ${isStart ? "ml-0" : "-ml-1 pl-2"}
                        ${colors.light} ${colors.text}
                        hover:shadow-sm
                      `}
                      title={schedule.title}
                    >
                      {isStart && <span className={`inline-block w-1.5 h-1.5 rounded-full ${colors.bg} mr-1`} />}
                      {schedule.title}
                    </motion.button>
                  );
                })}
              </div>

              {hasMany && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDayClick(day);
                  }}
                  className="w-full mt-1 flex items-center justify-center gap-1 py-0.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100/50 rounded transition-colors"
                >
                  <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                  {isExpanded ? "收起" : `还有 ${daySchedules.length - 3} 个`}
                </button>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
