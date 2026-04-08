'use client';

interface SkeletonLoaderProps {
  lines?: number;
  rows?: number;
  height?: 'sm' | 'md' | 'lg';
}

export default function SkeletonLoader({
  lines = 3,
  rows = 5,
  height = 'md'
}: SkeletonLoaderProps) {
  const heightClasses = {
    sm: 'h-2',
    md: 'h-3',
    lg: 'h-4',
  };

  return (
    <div className="space-y-3" role="status" aria-label="Loading content">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-2">
          {Array.from({ length: lines }).map((_, j) => (
            <div
              key={j}
              className={`${heightClasses[height]} bg-gray-200 rounded-lg animate-pulse ${
                j === lines - 1 ? 'w-3/4' : 'w-full'
              }`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}