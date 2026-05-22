import { type ReactNode } from 'react';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'amber';
type BadgeSize    = 'sm' | 'md';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  className?: string;
}

const variants: Record<BadgeVariant, string> = {
  default: 'bg-forge/10 text-forge',
  success: 'bg-emerald-100 text-emerald-800',
  warning: 'bg-amber/20 text-amber-900',
  amber:   'bg-amber text-forge',
  error:   'bg-red-100 text-red-700',
  info:    'bg-blue-100 text-blue-800',
  neutral: 'bg-gray-100 text-gray-600',
};

const dotColors: Record<BadgeVariant, string> = {
  default: 'bg-forge',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  amber:   'bg-amber-600',
  error:   'bg-red-500',
  info:    'bg-blue-500',
  neutral: 'bg-gray-400',
};

const sizes: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-[11px] gap-1',
  md: 'px-2.5 py-1 text-xs gap-1.5',
};

export default function Badge({
  children,
  variant = 'default',
  size = 'sm',
  dot = false,
  className = '',
}: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-full font-600 tracking-wide leading-none',
        variants[variant],
        sizes[size],
        className,
      ].join(' ')}
    >
      {dot && (
        <span
          className={`inline-block h-1.5 w-1.5 rounded-full ${dotColors[variant]}`}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}
