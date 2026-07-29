import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { AnimatePresence } from "framer-motion";
import { AlertToast } from "./alert-toast";

type ToastVariant = "success" | "error" | "info" | "warning";

interface Toast {
  id: number;
  variant: ToastVariant;
  title: string;
  description: string;
  styleVariant?: "default" | "filled";
}

interface ToastOptions {
  title?: string;
  variant?: ToastVariant;
  styleVariant?: "default" | "filled";
}

interface ToastContextType {
  toast: (messageOrOptions: string | (ToastOptions & { description?: string }), type?: ToastVariant) => void;
}

const defaultTitles: Record<ToastVariant, string> = {
  success: "Éxito",
  error: "Error",
  info: "Información",
  warning: "Advertencia",
};

const ToastContext = createContext<ToastContextType | undefined>(undefined);

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((
    messageOrOptions: string | (ToastOptions & { description?: string }),
    type?: ToastVariant,
  ) => {
    const id = nextId++;
    let entry: Toast;

    if (typeof messageOrOptions === "string") {
      const variant = type || "error";
      entry = {
        id,
        variant,
        title: defaultTitles[variant],
        description: messageOrOptions,
        styleVariant: "filled",
      };
    } else {
      const { title, description, variant = "info", styleVariant = "filled" } = messageOrOptions;
      entry = {
        id,
        variant,
        title: title || defaultTitles[variant],
        description: description || "",
        styleVariant,
      };
    }

    setToasts(prev => [...prev, entry]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const remove = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
        <AnimatePresence>
          {toasts.map(t => (
            <AlertToast
              key={t.id}
              variant={t.variant}
              styleVariant={t.styleVariant}
              title={t.title}
              description={t.description}
              onClose={() => remove(t.id)}
            />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast debe usarse dentro de ToastProvider");
  return ctx;
}
