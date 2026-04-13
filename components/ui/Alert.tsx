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
      bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800', title: 'text-green-900',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>,
    },
    error: {
      bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', title: 'text-red-900',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>,
    },
    warning: {
      bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-800', title: 'text-yellow-900',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>,
    },
    info: {
      bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', title: 'text-blue-900',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
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
        <span className="mt-0.5 shrink-0" aria-hidden="true">{style.icon}</span>
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
            className="flex-shrink-0 opacity-70 hover:opacity-100"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        )}
      </div>
    </div>
  );
}