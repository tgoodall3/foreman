'use client';

interface AlertProps {
  type: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  onDismiss?: () => void;
  action?: { label: string; onClick: () => void };
}

export default function Alert({
  type,
  title,
  message,
  onDismiss,
  action,
}: AlertProps) {
  const styles = {
    success: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      text: 'text-green-800',
      title: 'text-green-900',
      icon: '✓',
    },
    error: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-800',
      title: 'text-red-900',
      icon: '✕',
    },
    warning: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      text: 'text-yellow-800',
      title: 'text-yellow-900',
      icon: '⚠',
    },
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-800',
      title: 'text-blue-900',
      icon: 'ℹ',
    },
  };

  const style = styles[type];

  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      aria-live={type === 'error' ? 'assertive' : 'polite'}
      className={`${style.bg} border ${style.border} ${style.text} rounded-lg p-4`}
    >
      <div className="flex gap-3">
        <span className="text-lg mt-0.5" aria-hidden="true">{style.icon}</span>
        <div className="flex-1">
          {title && <p className={`font-600 ${style.title} mb-1`}>{title}</p>}
          <p className="text-sm">{message}</p>
          {action && (
            <button
              onClick={action.onClick}
              className={`mt-2 text-sm font-600 underline hover:opacity-80`}
            >
              {action.label}
            </button>
          )}
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            aria-label="Dismiss alert"
            className="flex-shrink-0 text-lg opacity-70 hover:opacity-100"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}