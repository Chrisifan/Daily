import { useState } from "react";
import { Plus } from "lucide-react";
import { CalendarView } from "./CalendarView";
import { ScheduleModal } from "./ScheduleModal";
import { useScheduleStore } from "../../shared/hooks/useScheduleStore";
import { mockSchedules } from "../../storage/seeds/mockData";
import type { ScheduleItem } from "../../domain/schedule/types";
import { format } from "date-fns";

export function SchedulePage() {
  const { schedules, addSchedule, updateSchedule, deleteSchedule } = useScheduleStore(mockSchedules);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScheduleItem | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const handleAddSchedule = (date: Date) => {
    setSelectedDate(date);
    setEditingSchedule(null);
    setModalOpen(true);
  };

  const handleEditSchedule = (schedule: ScheduleItem) => {
    setEditingSchedule(schedule);
    setSelectedDate(null);
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setEditingSchedule(null);
    setSelectedDate(null);
  };

  const handleSubmit = (data: Omit<ScheduleItem, "id" | "source" | "createdAt" | "updatedAt">) => {
    if (editingSchedule) {
      updateSchedule(editingSchedule.id, data);
    } else {
      addSchedule(data);
    }
    handleModalClose();
  };

  const handleDelete = () => {
    if (editingSchedule) {
      deleteSchedule(editingSchedule.id);
      handleModalClose();
    }
  };

  return (
    <div className="min-h-screen relative">

      <div className="relative z-10 p-6 max-w-6xl mx-auto">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-medium text-white/90">日程总览</h1>
            <p className="text-white/50 mt-1">管理你的所有日程安排</p>
          </div>
          <button
            onClick={() => handleAddSchedule(new Date())}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors backdrop-blur-sm border border-white/20"
          >
            <Plus className="w-5 h-5" />
            <span className="font-medium">新建日程</span>
          </button>
        </header>

        <CalendarView
          schedules={schedules}
          onEditSchedule={handleEditSchedule}
          onAddSchedule={handleAddSchedule}
        />
      </div>

      <ScheduleModal
        open={modalOpen}
        onClose={handleModalClose}
        onSubmit={handleSubmit}
        onDelete={editingSchedule ? handleDelete : undefined}
        initialData={
          editingSchedule
            ? editingSchedule
            : selectedDate
            ? {
                startAt: format(selectedDate, "yyyy-MM-dd'T'09:00:00"),
                endAt: format(selectedDate, "yyyy-MM-dd'T'10:00:00"),
              }
            : undefined
        }
        mode={editingSchedule ? "edit" : "create"}
      />
    </div>
  );
}
