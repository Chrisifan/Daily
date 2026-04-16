import { useCallback, useEffect, useRef } from "react";
import {
  buildReminderCandidates,
  findDueAndUpcomingReminderCandidates,
} from "../services/schedule-reminder-core";
import { getStoredSettings } from "../services/settingsService";
import {
  deliverScheduleReminder,
  listSchedulesForReminder,
  SCHEDULE_REMINDER_REFRESH_EVENT,
} from "../services/scheduleReminderService";

export function useScheduleAdvanceReminder() {
  const timeoutRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  const rerunRef = useRef(false);

  const clearScheduledTimer = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const reconcileOnce = useCallback(async () => {
    clearScheduledTimer();

    const settings = getStoredSettings();
    if (settings.scheduleReminderLeadMinutes === "none") {
      return;
    }

    const schedules = await listSchedulesForReminder();
    const now = new Date();
    const candidates = buildReminderCandidates(
      schedules,
      settings.scheduleReminderLeadMinutes,
      now,
    );
    const selection = findDueAndUpcomingReminderCandidates(candidates, now);

    for (const candidate of selection.dueNow) {
      try {
        await deliverScheduleReminder(candidate);
      } catch (error) {
        console.error("Failed to deliver schedule reminder:", error);
      }
    }

    if (!selection.nextUp) {
      return;
    }

    const nextDelay = Math.max(
      new Date(selection.nextUp.remindAt).getTime() - Date.now(),
      0,
    );

    timeoutRef.current = window.setTimeout(() => {
      void scheduleReconcile();
    }, nextDelay);
  }, [clearScheduledTimer]);

  const scheduleReconcile = useCallback(async () => {
    if (runningRef.current) {
      rerunRef.current = true;
      return;
    }

    runningRef.current = true;
    try {
      do {
        rerunRef.current = false;
        await reconcileOnce();
      } while (rerunRef.current);
    } finally {
      runningRef.current = false;
    }
  }, [reconcileOnce]);

  useEffect(() => {
    void scheduleReconcile();

    const handleFocus = () => {
      void scheduleReconcile();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void scheduleReconcile();
      }
    };
    const handleRefresh = () => {
      void scheduleReconcile();
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener(SCHEDULE_REMINDER_REFRESH_EVENT, handleRefresh as EventListener);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearScheduledTimer();
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener(SCHEDULE_REMINDER_REFRESH_EVENT, handleRefresh as EventListener);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [clearScheduledTimer, scheduleReconcile]);
}
