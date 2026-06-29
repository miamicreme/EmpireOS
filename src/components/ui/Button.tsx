import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-empire-blue text-surface-0 font-medium hover:bg-empire-blue/90 shadow-[0_2px_12px_-2px_rgba(96,165,250,0.5)]',
  secondary:
    'bg-surface-3 text-gray-100 border border-border-strong hover:bg-surface-4 hover:border-empire-muted/40',
  ghost: 'text-gray-300 hover:text-gray-100 hover:bg-surface-2',
  danger: 'bg-empire-red/15 text-empire-red border border-empire-red/25 hover:bg-empire-red/25',
  subtle: 'bg-surface-2 text-gray-300 border border-border hover:bg-surface-3 hover:text-gray-100',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-9 px-4 text-sm gap-2',
  lg: 'h-11 px-6 text-sm gap-2',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  className,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-mono transition-all duration-150',
        'disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
    >
      {loading ? (
        <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        icon
      )}
      {children}
    </button>
  );
}
