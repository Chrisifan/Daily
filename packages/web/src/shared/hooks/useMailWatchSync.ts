import { useEffect } from "react";
import { fetchMailWatchStatus, subscribeMailWatchEvents } from "../services/emailWatchService";
import { processPersistedExternalScheduleCandidates } from "../services/externalScheduleIntakeService";

export const MAIL_WATCH_STATUS_CHANGED_EVENT = "mail-watch-status-changed";

function emitMailWatchStatusChanged() {
  window.dispatchEvent(new CustomEvent(MAIL_WATCH_STATUS_CHANGED_EVENT));
}

export function useMailWatchSync() {
  useEffect(() => {
    const reconcile = async () => {
      await processPersistedExternalScheduleCandidates();
      emitMailWatchStatusChanged();
    };

    void fetchMailWatchStatus()
      .then(() => reconcile())
      .catch(() => emitMailWatchStatusChanged());

    const unsubscribe = subscribeMailWatchEvents(async (event) => {
      if (event.type === "candidates-detected") {
        await processPersistedExternalScheduleCandidates({ candidateIds: event.candidateIds });
      }

      emitMailWatchStatusChanged();
    });

    const handleFocus = () => {
      void reconcile();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void reconcile();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      unsubscribe();
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);
}
