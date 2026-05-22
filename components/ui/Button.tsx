'use client';

import LoadingSpinner from './LoadingSpinner';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'dark' | 'danger' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  loadingText?: string;
  children: React.ReactNode;
}

const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:   'bg-amber hover:bg-amber-dark text-forge shadow-sm hover:shadow-card-md active:scale-[0.98]',
  secondary: 'bg-forge hover:bg-forge-light text-white shadow-sm hover:shadow-card-md active:scale-[0.98]',
  dark:      'bg-forge hover:bg-forge-light text-white shadow-sm active:scale-[0.98]',
  danger:    'bg-red-600 hover:bg-red-700 text-white shadow-sm active:scale-[0.98]',
  outline:   'border border-gray-300 bg-white hover:bg-gray-50 hover:border-gray-400 text-forge shadow-sm active:scale-[0.98]',
  ghost:     'bg-transparent hover:bg-gray-100 text-forge active:scale-[0.98]',
};

const sizeClasses: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'px-3 py-1.5 text-xs min-h-[34px] gap-1.5',
  md: 'px-4 py-2 text-sm min-h-[40px] gap-2',
  lg: 'px-5 py-2.5 text-base min-h-[48px] gap-2',
};

const spinnerColor: Record<NonNullable<ButtonProps['variant']>, 'forge' | 'white'> = {
  primary:   'forge',
  secondary: 'white',
  dark:      'white',
  danger:    'white',
  outline:   'forge',
  ghost:     'forge',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  loadingText = 'Loading…',
  disabled,
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={[
        'font-display font-700 rounded-lg transition-all duration-150',
        'inline-flex items-center justify-center',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
        variantClasses[variant],
        sizeClasses[size],
        className,
      ].join(' ')}
      {...props}
    >
      {loading ? (
        <>
          <LoadingSpinner
            size={size === 'sm' ? 'sm' : 'md'}
            color={spinnerColor[variant]}
          />
          {loadingText}
        </>
      ) : (
        children
      )}
    </button>
  );
}
