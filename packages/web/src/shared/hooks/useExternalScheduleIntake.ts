import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ExternalScheduleCandidate } from "../../domain/intake/types";
import {
  createScheduleFromCandidate,
  getExternalScheduleCandidate,
  listPendingExternalScheduleCandidates,
  updateExternalScheduleCandidateStatus,
} from "../services/externalScheduleIntakeService";
import { useToast } from "../ui/ToastProvider";

export function useExternalScheduleIntake() {
  const { t } = useTranslation();
  const toast = useToast();
  const [pendingCandidates, setPendingCandidates] = useState<ExternalScheduleCandidate[]>([]);
  const [activeCandidateId, setActiveCandidateId] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  const refreshPendingCandidates = useCallback(async (options?: { openIfNeeded?: boolean }) => {
    const nextCandidates = await listPendingExternalScheduleCandidates();
    setPendingCandidates(nextCandidates);
    setActiveCandidateId((currentId) => {
      if (currentId && nextCandidates.some((candidate) => candidate.id === currentId)) {
        return currentId;
      }

      return nextCandidates[0]?.id ?? null;
    });

    if (options?.openIfNeeded && nextCandidates.length > 0) {
      setReviewOpen(true);
    }
  }, []);

  useEffect(() => {
    void refreshPendingCandidates({ openIfNeeded: true });
  }, [refreshPendingCandidates]);

  useEffect(() => {
    const handlePendingCandidates = () => {
      void refreshPendingCandidates({ openIfNeeded: true });
    };

    window.addEventListener("external-schedule-pending", handlePendingCandidates as EventListener);
    return () => {
      window.removeEventListener("external-schedule-pending", handlePendingCandidates as EventListener);
    };
  }, [refreshPendingCandidates]);

  useEffect(() => {
    const handleWindowFocus = () => {
      void refreshPendingCandidates();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshPendingCandidates();
      }
    };

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshPendingCandidates]);

  const activeCandidate = useMemo(
    () => pendingCandidates.find((candidate) => candidate.id === activeCandidateId) ?? null,
    [activeCandidateId, pendingCandidates]
  );

  const advanceQueue = useCallback(async (nextId?: string | null) => {
    const nextCandidates = await listPendingExternalScheduleCandidates();
    setPendingCandidates(nextCandidates);
    const resolvedNextId = nextId ?? nextCandidates[0]?.id ?? null;
    setActiveCandidateId(resolvedNextId);
    setReviewOpen(Boolean(resolvedNextId));
  }, []);

  const openCandidateReview = useCallback(async (candidateId: string) => {
    const candidate = await getExternalScheduleCandidate(candidateId);
    if (!candidate || candidate.status !== "pending") {
      await refreshPendingCandidates();
      return;
    }

    setPendingCandidates((current) => {
      const exists = current.some((item) => item.id === candidate.id);
      return exists ? current : [candidate, ...current];
    });
    setActiveCandidateId(candidate.id);
    setReviewOpen(true);
  }, [refreshPendingCandidates]);

  const closeCandidateReview = useCallback(() => {
    setReviewOpen(false);
  }, []);

  const reopenPendingReview = useCallback(() => {
    if (pendingCandidates.length === 0) {
      return;
    }

    setActiveCandidateId((currentId) => {
      if (currentId && pendingCandidates.some((candidate) => candidate.id === currentId)) {
        return currentId;
      }

      return pendingCandidates[0]?.id ?? null;
    });
    setReviewOpen(true);
  }, [pendingCandidates]);

  const confirmCandidate = useCallback(async () => {
    if (!activeCandidate) {
      return;
    }

    try {
      setConfirming(true);
      await createScheduleFromCandidate(activeCandidate);
      await updateExternalScheduleCandidateStatus(activeCandidate.id, "accepted");
      await advanceQueue();
      toast.success(t("feedback.externalScheduleSynced"));
    } catch (error) {
      const message = error instanceof Error ? error.message : undefined;
      toast.error(t("feedback.externalScheduleSyncFailed"), message);
    } finally {
      setConfirming(false);
    }
  }, [activeCandidate, advanceQueue, t, toast]);

  const dismissCandidate = useCallback(async () => {
    if (!activeCandidate) {
      return;
    }

    try {
      setDismissing(true);
      await updateExternalScheduleCandidateStatus(activeCandidate.id, "dismissed");
      await advanceQueue();
      toast.success(t("feedback.externalScheduleDismissed"));
    } catch (error) {
      const message = error instanceof Error ? error.message : undefined;
      toast.error(t("feedback.externalScheduleDismissFailed"), message);
    } finally {
      setDismissing(false);
    }
  }, [activeCandidate, advanceQueue, t, toast]);

  return {
    open: reviewOpen && Boolean(activeCandidate),
    activeCandidate,
    pendingCount: pendingCandidates.length,
    confirming,
    dismissing,
    openCandidateReview,
    closeCandidateReview,
    reopenPendingReview,
    refreshPendingCandidates,
    confirmCandidate,
    dismissCandidate,
  };
}
