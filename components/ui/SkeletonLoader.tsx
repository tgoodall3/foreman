'use client';

interface SkeletonLoaderProps {
  lines?: number;
  rows?: number;
  height?: 'sm' | 'md' | 'lg';
  className?: string;
}

const heightMap = { sm: 'h-2.5', md: 'h-3.5', lg: 'h-5' };

export function SkeletonBlock({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded-lg skeleton-shimmer ${className}`}
      aria-hidden="true"
    />
  );
}

export default function SkeletonLoader({
  lines = 3,
  rows = 5,
  height = 'md',
  className = '',
}: SkeletonLoaderProps) {
  const h = heightMap[height];

  return (
    <div className={`space-y-4 ${className}`} role="status" aria-label="Loading content">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-2.5">
          {Array.from({ length: lines }).map((_, j) => (
            <div
              key={j}
              className={`${h} rounded-lg skeleton-shimmer ${j === lines - 1 ? 'w-2/3' : 'w-full'}`}
            />
          ))}
        </div>
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}
