"use client";

import { useEffect } from "react";
import { CheckCircle, XCircle, Info, X } from "lucide-react";

export interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

interface ToastProps {
  toast: Toast;
  onRemove: (id: string) => void;
}

const CONFIG = {
  success: { Icon: CheckCircle, accent: "text-emerald-400", label: "Success" },
  error:   { Icon: XCircle,      accent: "text-red-400",     label: "Error"   },
  info:    { Icon: Info,         accent: "text-blue-400",    label: "Info"    },
} as const;

export default function Toast({ toast, onRemove }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => onRemove(toast.id), 5000);
    return () => clearTimeout(timer);
  }, [toast.id, onRemove]);

  const { Icon, accent, label } = CONFIG[toast.type];

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-start gap-3 rounded-xl bg-forge border border-forge-light shadow-card-lg px-4 py-3.5 min-w-[300px] max-w-[380px] animate-slide-in-right"
    >
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${accent}`} aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-600 uppercase tracking-widest text-white/50 leading-none mb-1">
          {label}
        </p>
        <p className="text-sm font-500 text-white leading-snug">{toast.message}</p>
      </div>
      <button
        onClick={() => onRemove(toast.id)}
        className="shrink-0 text-white/40 hover:text-white/80 transition-colors mt-0.5"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
