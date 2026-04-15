import { AnimatePresence, motion } from "framer-motion";
import { CalendarClock, Mail, CalendarDays } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ExternalScheduleCandidate } from "../../domain/intake/types";
import { formatDateTime } from "../utils/date";

interface ExternalScheduleReviewDialogProps {
  open: boolean;
  candidate: ExternalScheduleCandidate | null;
  pendingCount?: number;
  confirming?: boolean;
  dismissing?: boolean;
  onConfirm: () => void | Promise<void>;
  onDismiss: () => void | Promise<void>;
  onClose: () => void;
}

export function ExternalScheduleReviewDialog({
  open,
  candidate,
  pendingCount = 0,
  confirming = false,
  dismissing = false,
  onConfirm,
  onDismiss,
  onClose,
}: ExternalScheduleReviewDialogProps) {
  const { t } = useTranslation();

  const sourceIcon =
    candidate?.source === "email" ? <Mail className="h-4 w-4" /> : <CalendarDays className="h-4 w-4" />;
  const sourceLabel =
    candidate?.source === "email"
      ? t("integrations.externalCandidate.sourceEmail")
      : t("integrations.externalCandidate.sourceCalendar");

  return (
    <AnimatePresence>
      {open && candidate && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0"
            style={{ backgroundColor: "rgba(0,0,0,0.3)", backdropFilter: "blur(4px)" }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
            className="relative w-full max-w-[460px] overflow-hidden rounded-2xl"
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              boxShadow: "var(--shadow-xl)",
            }}
          >
            <div className="flex items-start gap-3 px-5 py-4" style={{ borderBottom: "1px solid var(--color-border)" }}>
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                style={{
                  background: "color-mix(in srgb, var(--color-primary) 12%, var(--color-surface) 88%)",
                  color: "var(--color-primary)",
                }}
              >
                <CalendarClock className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="panel-title" style={{ fontSize: 18 }}>
                    {t("integrations.externalCandidate.title")}
                  </h3>
                  {pendingCount > 1 && (
                    <span className="panel-count-badge">
                      {t("integrations.externalCandidate.pendingCount", { count: pendingCount })}
                    </span>
                  )}
                </div>
                <p style={{ marginTop: 6, fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
                  {candidate.title}
                </p>
              </div>
            </div>

            <div className="space-y-3 px-5 py-4">
              <div className="flex items-center gap-2 text-[12px]" style={{ color: "var(--color-text-secondary)" }}>
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-lg"
                  style={{
                    backgroundColor: "var(--color-border-light)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  {sourceIcon}
                </span>
                <span>{sourceLabel}</span>
              </div>

              <div style={{ fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
                <div>
                  {formatDateTime(candidate.startAt)} - {formatDateTime(candidate.endAt)}
                </div>
                {candidate.location && <div>{candidate.location}</div>}
                {candidate.notes && <div>{candidate.notes}</div>}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 px-5 py-3.5" style={{ borderTop: "1px solid var(--color-border)" }}>
              <button
                type="button"
                onClick={onClose}
                disabled={confirming || dismissing}
                className="btn-secondary"
                style={{
                  padding: "8px 16px",
                  fontSize: 13,
                  fontWeight: 500,
                  opacity: confirming || dismissing ? 0.65 : 1,
                }}
              >
                {t("integrations.externalCandidate.reviewLater")}
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onDismiss}
                  disabled={confirming || dismissing}
                  className="btn-secondary"
                  style={{
                    padding: "8px 16px",
                    fontSize: 13,
                    fontWeight: 500,
                    opacity: confirming || dismissing ? 0.65 : 1,
                  }}
                >
                  {dismissing ? t("common.processing") : t("integrations.externalCandidate.dismiss")}
                </button>
                <button
                  type="button"
                  onClick={onConfirm}
                  disabled={confirming || dismissing}
                  className="btn-primary"
                  style={{
                    padding: "8px 16px",
                    fontSize: 13,
                    fontWeight: 600,
                    border: "none",
                    opacity: confirming || dismissing ? 0.7 : 1,
                  }}
                >
                  {confirming ? t("common.processing") : t("integrations.externalCandidate.sync")}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
