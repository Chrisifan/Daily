import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirming?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  confirming = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const { t } = useTranslation();

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
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
            className="relative w-full max-w-[420px] overflow-hidden rounded-2xl"
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
                  background: "color-mix(in srgb, var(--color-error) 12%, var(--color-surface) 88%)",
                  color: "var(--color-error)",
                }}
              >
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h3 className="panel-title" style={{ fontSize: 18 }}>
                  {title}
                </h3>
                {description && (
                  <p
                    style={{
                      marginTop: 6,
                      fontSize: 13,
                      lineHeight: 1.5,
                      color: "var(--color-text-secondary)",
                    }}
                  >
                    {description}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3.5">
              <button
                type="button"
                onClick={onClose}
                disabled={confirming}
                className="btn-secondary"
                style={{
                  padding: "8px 16px",
                  fontSize: 13,
                  fontWeight: 500,
                  opacity: confirming ? 0.65 : 1,
                  cursor: confirming ? "not-allowed" : "pointer",
                }}
              >
                {cancelLabel ?? t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={confirming}
                style={{
                  minWidth: 92,
                  height: 32,
                  padding: "0 16px",
                  borderRadius: "var(--radius-button-md)",
                  border: "1px solid color-mix(in srgb, var(--color-error) 24%, transparent)",
                  background: "var(--color-error)",
                  color: "var(--color-priority-high-contrast)",
                  fontSize: 13,
                  fontWeight: 600,
                  opacity: confirming ? 0.7 : 1,
                  cursor: confirming ? "not-allowed" : "pointer",
                }}
              >
                {confirming ? t("common.processing") || "处理中..." : confirmLabel ?? t("common.delete")}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
