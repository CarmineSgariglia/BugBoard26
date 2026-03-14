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

type Toast = {
  id: number;
  title: string;
  description: string;
};

type ToastContextValue = {
  pushToast: (toast: Omit<Toast, "id">) => void;
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

  const value = useMemo(() => ({ pushToast }), [pushToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-6 right-4 z-[80] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-3 sm:bottom-8 sm:right-6">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto overflow-hidden rounded-2xl border border-cyan-400/20 bg-[#0E141D]/95 px-4 py-3 shadow-[0_18px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl"
            role="status"
          >
            <p className="text-sm font-semibold text-white">{toast.title}</p>
            <p className="mt-1 text-xs text-slate-300">{toast.description}</p>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
