'use client';

import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

interface AlertProps {
  type: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  onDismiss?: () => void;
  action?: { label: string; onClick: () => void };
}

const CONFIG = {
  success: {
    icon:      CheckCircle,
    container: 'bg-emerald-50 border-emerald-200 border-l-emerald-500',
    iconColor: 'text-emerald-500',
    title:     'text-emerald-900',
    body:      'text-emerald-800',
    action:    'text-emerald-700 hover:text-emerald-900',
    dismiss:   'text-emerald-400 hover:text-emerald-600',
  },
  error: {
    icon:      XCircle,
    container: 'bg-red-50 border-red-200 border-l-red-500',
    iconColor: 'text-red-500',
    title:     'text-red-900',
    body:      'text-red-800',
    action:    'text-red-700 hover:text-red-900',
    dismiss:   'text-red-400 hover:text-red-600',
  },
  warning: {
    icon:      AlertTriangle,
    container: 'bg-amber-50 border-amber-200 border-l-amber-500',
    iconColor: 'text-amber-500',
    title:     'text-amber-900',
    body:      'text-amber-800',
    action:    'text-amber-700 hover:text-amber-900',
    dismiss:   'text-amber-400 hover:text-amber-600',
  },
  info: {
    icon:      Info,
    container: 'bg-blue-50 border-blue-200 border-l-blue-500',
    iconColor: 'text-blue-500',
    title:     'text-blue-900',
    body:      'text-blue-800',
    action:    'text-blue-700 hover:text-blue-900',
    dismiss:   'text-blue-400 hover:text-blue-600',
  },
} as const;

export default function Alert({ type, title, message, onDismiss, action }: AlertProps) {
  const cfg = CONFIG[type];
  const Icon = cfg.icon;

  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      aria-live={type === 'error' ? 'assertive' : 'polite'}
      className={`rounded-xl border border-l-4 ${cfg.container} p-4 animate-fade-up`}
    >
      <div className="flex gap-3">
        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${cfg.iconColor}`} aria-hidden="true" />
        <div className="flex-1 min-w-0">
          {title && <p className={`text-sm font-600 mb-0.5 ${cfg.title}`}>{title}</p>}
          <p className={`text-sm leading-relaxed ${cfg.body}`}>{message}</p>
          {action && (
            <button
              onClick={action.onClick}
              className={`mt-2 text-sm font-600 underline underline-offset-2 transition-colors ${cfg.action}`}
            >
              {action.label}
            </button>
          )}
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            aria-label="Dismiss"
            className={`shrink-0 transition-colors ${cfg.dismiss}`}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
