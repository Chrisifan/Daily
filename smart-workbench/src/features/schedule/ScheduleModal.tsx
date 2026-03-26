import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import type { ScheduleItem, Priority } from "../../domain/schedule/types";
import { format } from "date-fns";

interface ScheduleModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<ScheduleItem, "id" | "source" | "createdAt" | "updatedAt">) => void;
  onDelete?: () => void;
  initialData?: Partial<ScheduleItem>;
  mode?: "create" | "edit";
}

export function ScheduleModal({ open, onClose, onSubmit, onDelete, initialData, mode = "create" }: ScheduleModalProps) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [priority, setPriority] = useState<Priority>("medium");
  const [location, setLocation] = useState("");
  const [isFlexible, setIsFlexible] = useState(false);

  useEffect(() => {
    if (open && initialData) {
      setTitle(initialData.title || "");
      setNotes(initialData.notes || "");
      setPriority(initialData.priority || "medium");
      setLocation(initialData.location || "");
      setIsFlexible(initialData.isFlexible || false);
      if (initialData.startAt) {
        const start = new Date(initialData.startAt);
        setStartDate(format(start, "yyyy-MM-dd"));
        setStartTime(format(start, "HH:mm"));
      }
      if (initialData.endAt) {
        const end = new Date(initialData.endAt);
        setEndDate(format(end, "yyyy-MM-dd"));
        setEndTime(format(end, "HH:mm"));
      }
    } else if (open) {
      const now = new Date();
      setTitle("");
      setNotes("");
      setPriority("medium");
      setLocation("");
      setIsFlexible(false);
      setStartDate(format(now, "yyyy-MM-dd"));
      setEndDate(format(now, "yyyy-MM-dd"));
      setStartTime("09:00");
      setEndTime("10:00");
    }
  }, [open, initialData]);

  const handleSubmit = () => {
    if (!title.trim()) return;
    if (!startDate || !endDate) return;

    const startAt = new Date(`${startDate}T${startTime}:00`).toISOString();
    const endAt = new Date(`${endDate}T${endTime}:00`).toISOString();

    onSubmit({
      title: title.trim(),
      notes: notes.trim() || undefined,
      startAt,
      endAt,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      location: location.trim() || undefined,
      priority,
      isFlexible,
    });
    onClose();
  };

  const isValid = title.trim() && startDate && endDate && startTime && endTime;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
          
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
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  标题 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="输入日程标题"
                  className="w-full px-4 py-2.5 rounded-xl bg-white/60 border border-gray-200/80 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  日期区间 <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-white/60 border border-gray-200/80 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-transparent transition-all"
                  />
                  <span className="text-gray-400">至</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-white/60 border border-gray-200/80 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  时间区间 <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-white/60 border border-gray-200/80 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-transparent transition-all"
                  />
                  <span className="text-gray-400">至</span>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-white/60 border border-gray-200/80 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  优先级
                </label>
                <div className="flex gap-2">
                  {(["low", "medium", "high"] as Priority[]).map((p) => (
                    <button
                      key={p}
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
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  位置
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="输入地点（可选）"
                  className="w-full px-4 py-2.5 rounded-xl bg-white/60 border border-gray-200/80 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  备注
                </label>
                <textarea
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
