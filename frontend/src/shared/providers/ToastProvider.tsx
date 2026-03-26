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
import { FiX } from "react-icons/fi";

type Toast = {
  id: number;
  title: string;
  description?: string;
  variant?: "default" | "success" | "error";
};

type ToastContextValue = {
  pushToast: (toast: Omit<Toast, "id">) => void;
  pushSuccessToast: (description: string, title?: string) => void;
};

const TOAST_LIFETIME_MS = 4500;
const MAX_VISIBLE_TOASTS = 3;

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const nextIdRef = useRef(1);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismissToast = useCallback((toastId: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== toastId));
  }, []);

  const pushToast = useCallback((toast: Omit<Toast, "id">) => {
    const toastId = nextIdRef.current++;
    setToasts((current) => [...current, { id: toastId, ...toast }].slice(-MAX_VISIBLE_TOASTS));
  }, []);

  const pushSuccessToast = useCallback(
    (description: string, title = "Successo") => {
      pushToast({
        title,
        description,
        variant: "success",
      });
    },
    [pushToast],
  );

  useEffect(() => {
    if (toasts.length === 0) {
      return;
    }

    const timers = toasts.map((toast) =>
      window.setTimeout(() => {
        dismissToast(toast.id);
      }, TOAST_LIFETIME_MS),
    );

    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
  }, [dismissToast, toasts]);

  const value = useMemo(() => ({ pushToast, pushSuccessToast }), [pushSuccessToast, pushToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-6 right-4 z-[80] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-3 sm:bottom-8 sm:right-6">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto overflow-hidden rounded-2xl px-4 py-3 shadow-[0_18px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl ${
              toast.variant === "success"
                ? "border border-[#5cb85c] bg-[#5cb85c]"
                : toast.variant === "error"
                  ? "border border-red-500/60 bg-red-500/90"
                  : "border border-cyan-400/20 bg-[#0E141D]/95"
            }`}
            role={toast.variant === "error" ? "alert" : "status"}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">{toast.title}</p>
                {toast.description ? (
                  <p
                    className={`mt-1 text-xs ${
                      toast.variant === "success" || toast.variant === "error"
                        ? "text-white/90"
                        : "text-slate-300"
                    }`}
                  >
                    {toast.description}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/75 transition hover:bg-white/10 hover:text-white"
                aria-label={`Dismiss ${toast.title}`}
                title="Dismiss notification"
              >
                <FiX size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
