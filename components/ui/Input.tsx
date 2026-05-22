'use client';

import { type InputHTMLAttributes, type ReactNode, useId } from 'react';

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label?: string;
  hint?: string;
  error?: string;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  id?: string;
}

export default function Input({
  label,
  hint,
  error,
  leadingIcon,
  trailingIcon,
  id: externalId,
  required,
  className = '',
  ...props
}: InputProps) {
  const generatedId = useId();
  const id = externalId ?? generatedId;

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="block text-sm font-600 text-forge">
          {label}
          {required && <span className="ml-1 text-red-500" aria-hidden="true">*</span>}
        </label>
      )}

      <div className="relative">
        {leadingIcon && (
          <span
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mist"
            aria-hidden="true"
          >
            {leadingIcon}
          </span>
        )}

        <input
          id={id}
          required={required}
          className={[
            'w-full rounded-lg border bg-white text-sm text-forge placeholder:text-mist',
            'px-3 py-2.5 transition-colors duration-150',
            leadingIcon  ? 'pl-9'  : '',
            trailingIcon ? 'pr-9'  : '',
            error
              ? 'border-red-400 focus:border-red-500 focus:shadow-[0_0_0_3px_rgba(239,68,68,0.12)]'
              : 'border-gray-300 hover:border-gray-400 focus:border-amber focus:shadow-[0_0_0_3px_rgba(245,158,11,0.15)]',
            'focus:outline-none',
            'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-gray-50',
            className,
          ].join(' ')}
          {...props}
        />

        {trailingIcon && (
          <span
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-mist"
            aria-hidden="true"
          >
            {trailingIcon}
          </span>
        )}
      </div>

      {error && (
        <p className="text-xs font-500 text-red-600" role="alert">{error}</p>
      )}
      {hint && !error && (
        <p className="text-xs text-mist">{hint}</p>
      )}
    </div>
  );
}
