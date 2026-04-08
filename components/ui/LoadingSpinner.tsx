'use client';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'white' | 'forge';
  label?: string;
}

export default function LoadingSpinner({
  size = 'md',
  color = 'white',
  label = 'Loading'
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-6 h-6',
  };

  const borderColor = color === 'white' ? 'border-white/30 border-t-white' : 'border-forge/30 border-t-forge';

  return (
    <div className="flex items-center gap-2">
      <div
        className={`${sizeClasses[size]} border-2 ${borderColor} rounded-full animate-spin`}
        role="status"
        aria-label={label}
      />
      {label && <span className="sr-only">{label}</span>}
    </div>
  );
}