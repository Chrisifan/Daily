import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarView } from "./CalendarView";
import { ScheduleModal } from "./ScheduleModal";
import { useScheduleStore } from "../../shared/hooks/useScheduleStore";
import { mockSchedules, mockWorkspaces } from "../../storage/seeds/mockData";
import type { ScheduleItem } from "../../domain/schedule/types";
import { format } from "date-fns";
import { getStoredSettings } from "../../shared/services/settingsService";
import { getNextRoutineSelectableDateTime } from "../../shared/utils/routineTime";

export function SchedulePage() {
  const { schedules, addSchedule, updateSchedule, deleteSchedule, refreshSchedules, loading } = useScheduleStore(mockSchedules);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScheduleItem | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

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

  const handleSubmit = async (data: Omit<ScheduleItem, "id" | "source" | "createdAt" | "updatedAt">) => {
    if (editingSchedule) {
      await updateSchedule(editingSchedule.id, data);
    } else {
      await addSchedule(data);
    }
    await refreshSchedules();
    handleModalClose();
  };

  const getDefaultTimes = () => {
    const settings = getStoredSettings();

    if (selectedDate) {
      const clickedTime = format(selectedDate, "HH:mm");
      return {
        startAt: format(selectedDate, "yyyy-MM-dd'T'") + clickedTime + ':00',
        durationMinutes: 30,
        repeatMode: "none" as const,
        icon: "clock" as const,
      };
    }

    const nextDate = getNextRoutineSelectableDateTime(
      new Date(),
      settings.routineStartTime,
      settings.routineEndTime,
    );

    return {
      startAt: format(nextDate, "yyyy-MM-dd'T'HH:mm:ss"),
      durationMinutes: 30,
      repeatMode: "none" as const,
      icon: "clock" as const,
    };
  };

  const handleDelete = () => {
    if (editingSchedule) {
      deleteSchedule(editingSchedule.id);
      handleModalClose();
    }
  };

  useEffect(() => {
    const shouldCreate = searchParams.get("create") === "1";
    const scheduleId = searchParams.get("scheduleId");

    if (!shouldCreate && !scheduleId) {
      return;
    }

    if (shouldCreate) {
      handleAddSchedule();
      setSearchParams({}, { replace: true });
      return;
    }

    if (loading) {
      return;
    }

    const matchedSchedule = schedules.find((schedule) => schedule.id === scheduleId);
    if (matchedSchedule) {
      handleEditSchedule(matchedSchedule);
    }
    setSearchParams({}, { replace: true });
  }, [loading, schedules, searchParams, setSearchParams]);

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
        schedules={schedules}
        workspaces={mockWorkspaces}
        initialData={
          editingSchedule
            ? editingSchedule
            : getDefaultTimes()
        }
        mode={editingSchedule ? "edit" : "create"}
      />
    </div>
  );
}
