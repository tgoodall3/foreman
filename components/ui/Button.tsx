'use client';

import LoadingSpinner from './LoadingSpinner';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  loadingText?: string;
  children: React.ReactNode;
}

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  loadingText = 'Loading...',
  disabled,
  children,
  ...props
}: ButtonProps) {
  const baseClasses = 'font-display font-700 rounded-lg transition-colors min-h-[44px] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed';

  const variantClasses = {
    primary: 'bg-amber hover:bg-amber-dark text-forge',
    secondary: 'bg-forge hover:bg-forge-light text-white',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <button
      disabled={disabled || loading}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]}`}
      {...props}
    >
      {loading ? (
        <>
          <LoadingSpinner size={size === 'sm' ? 'sm' : 'md'} color={variant === 'primary' ? 'forge' : 'white'} />
          {loadingText}
        </>
      ) : (
        children
      )}
    </button>
  );
}