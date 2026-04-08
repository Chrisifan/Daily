import { useState } from "react";
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

  const handleAddSchedule = (date?: Date) => {
    setSelectedDate(date ?? null);
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

  const getDefaultTimes = () => {
    if (selectedDate) {
      const clickedTime = format(selectedDate, "HH:mm");
      const [hours, minutes] = clickedTime.split(':').map(Number);
      let endHours = hours;
      let endMinutes = minutes + 30;
      if (endMinutes >= 60) {
        endHours += 1;
        endMinutes = 0;
      }
      const endTime = `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
      return {
        startAt: format(selectedDate, "yyyy-MM-dd'T'") + clickedTime + ':00',
        endAt: format(selectedDate, "yyyy-MM-dd'T'") + endTime + ':00',
      };
    }
    const today = format(new Date(), "yyyy-MM-dd");
    return {
      startAt: `${today}T09:00:00`,
      endAt: `${today}T09:30:00`,
    };
  };

  const handleDelete = () => {
    if (editingSchedule) {
      deleteSchedule(editingSchedule.id);
      handleModalClose();
    }
  };

  return (
    <div className="relative z-10 -mr-12">

      <div className="flex-1 min-h-0">
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
            ? getDefaultTimes()
            : undefined
        }
        mode={editingSchedule ? "edit" : "create"}
      />
    </div>
  );
}
