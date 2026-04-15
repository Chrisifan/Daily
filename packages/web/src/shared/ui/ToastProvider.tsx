import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, CircleAlert, Info, X } from "lucide-react";

export type ToastTone = "success" | "error" | "info";

export interface ToastInput {
  tone?: ToastTone;
  title: string;
  description?: string;
  durationMs?: number;
}

export interface ToastRecord {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
  durationMs: number;
}

interface ToastContextValue {
  showToast: (input: ToastInput) => string;
  success: (title: string, description?: string) => string;
  error: (title: string, description?: string) => string;
  info: (title: string, description?: string) => string;
  dismissToast: (id: string) => void;
}

interface QueuedToastStorage {
  getItem: (key: string) => string | null;
  removeItem: (key: string) => void;
}

const DEFAULT_TOAST_DURATION_MS = 3200;
const RELOAD_TOAST_STORAGE_KEY = "daily.pending-toast";

const ToastContext = createContext<ToastContextValue | null>(null);

function nextToastId(): string {
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createToastRecord(input: ToastInput, id = nextToastId()): ToastRecord {
  return {
    id,
    tone: input.tone ?? "info",
    title: input.title,
    description: input.description,
    durationMs: input.durationMs ?? DEFAULT_TOAST_DURATION_MS,
  };
}

export function appendToast(queue: ToastRecord[], toast: ToastRecord): ToastRecord[] {
  return [...queue, toast];
}

export function removeToast(queue: ToastRecord[], id: string): ToastRecord[] {
  return queue.filter((toast) => toast.id !== id);
}

export function queueToastAfterReload(input: ToastInput): void {
  sessionStorage.setItem(RELOAD_TOAST_STORAGE_KEY, JSON.stringify(input));
}

export function consumeQueuedToast(storage: QueuedToastStorage): ToastInput | null {
  const queued = storage.getItem(RELOAD_TOAST_STORAGE_KEY);
  if (!queued) {
    return null;
  }

  storage.removeItem(RELOAD_TOAST_STORAGE_KEY);

  try {
    const parsed = JSON.parse(queued) as ToastInput;
    if (!parsed?.title) {
      return null;
    }

    return parsed;
  } catch (error) {
    console.error("Failed to restore pending toast:", error);
    return null;
  }
}

function getToastIcon(tone: ToastTone) {
  if (tone === "success") {
    return CheckCircle2;
  }

  if (tone === "error") {
    return CircleAlert;
  }

  return Info;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const timeoutsRef = useRef<Map<string, number>>(new Map());

  const dismissToast = useCallback((id: string) => {
    const timeoutId = timeoutsRef.current.get(id);
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      timeoutsRef.current.delete(id);
    }

    setToasts((current) => removeToast(current, id));
  }, []);

  const showToast = useCallback((input: ToastInput) => {
    const toast = createToastRecord(input);
    setToasts((current) => appendToast(current, toast));

    const timeoutId = window.setTimeout(() => {
      dismissToast(toast.id);
    }, toast.durationMs);

    timeoutsRef.current.set(toast.id, timeoutId);
    return toast.id;
  }, [dismissToast]);

  useEffect(() => {
    const queued = consumeQueuedToast(sessionStorage);
    if (queued) {
      showToast(queued);
    }
  }, [showToast]);

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      timeoutsRef.current.clear();
    };
  }, []);

  const value = useMemo<ToastContextValue>(() => ({
    showToast,
    success: (title, description) => showToast({ tone: "success", title, description }),
    error: (title, description) => showToast({ tone: "error", title, description, durationMs: 4200 }),
    info: (title, description) => showToast({ tone: "info", title, description }),
    dismissToast,
  }), [dismissToast, showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div className="toast-viewport" aria-live="polite" aria-atomic="true">
        <AnimatePresence initial={false}>
          {toasts.map((toast) => {
            const Icon = getToastIcon(toast.tone);

            return (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: -12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.97 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                className={`toast-card toast-card--${toast.tone}`}
              >
                <div className="toast-card__icon">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="toast-card__content">
                  <p className="toast-card__title">{toast.title}</p>
                  {toast.description && <p className="toast-card__description">{toast.description}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => dismissToast(toast.id)}
                  className="toast-card__close"
                  aria-label="Dismiss toast"
                >
                  <X className="h-4 w-4" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }

  return context;
}
