import Link from 'next/link';
import { type ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  secondaryAction?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  className?: string;
}

export default function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 px-6 text-center ${className}`}>
      {icon && (
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-mist">
          {icon}
        </div>
      )}

      <h3 className="font-display font-700 text-xl text-forge tracking-wide">{title}</h3>

      {description && (
        <p className="mt-2 text-sm text-mist leading-relaxed max-w-[300px]">{description}</p>
      )}

      {(action || secondaryAction) && (
        <div className="mt-6 flex items-center gap-3">
          {action && (
            action.href ? (
              <Link href={action.href} className="action-button-primary">
                {action.label}
              </Link>
            ) : (
              <button onClick={action.onClick} className="action-button-primary">
                {action.label}
              </button>
            )
          )}

          {secondaryAction && (
            secondaryAction.href ? (
              <Link href={secondaryAction.href} className="action-button-secondary">
                {secondaryAction.label}
              </Link>
            ) : (
              <button onClick={secondaryAction.onClick} className="action-button-secondary">
                {secondaryAction.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
