import React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'approve' | 'reject';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

// Inline styles — guaranteed render regardless of Tailwind JIT token generation
const variantStyles: Record<string, React.CSSProperties> = {
  primary:   { backgroundColor: '#C9A84C', color: '#fff',    border: '1px solid #A88937' },
  secondary: { backgroundColor: '#1A1A2E', color: '#fff',    border: '1px solid #0E0E1F' },
  approve:   { backgroundColor: '#22C55E', color: '#fff',    border: '1px solid #16A34A' },
  danger:    { backgroundColor: '#EF4444', color: '#fff',    border: '1px solid #DC2626' },
  reject:    { backgroundColor: '#fff',   color: '#DC2626',  border: '1px solid #FECACA' },
  outline:   { backgroundColor: '#fff',   color: '#1A1A2E',  border: '1px solid #E8ECF2' },
  ghost:     { backgroundColor: 'transparent', color: '#4A5568', border: '1px solid transparent' },
};

const variantHoverClass: Record<string, string> = {
  primary:   'btn-primary',
  secondary: 'btn-secondary',
  approve:   'btn-approve',
  danger:    'btn-danger',
  reject:    'btn-reject',
  outline:   'btn-outline',
  ghost:     'btn-ghost',
};

const sizes: Record<string, string> = {
  sm: 'h-7 px-3 text-xs gap-1.5 rounded',
  md: 'h-9 px-4 text-sm gap-2 rounded',
  lg: 'h-10 px-5 text-sm gap-2 rounded',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', isLoading, className, children, disabled, style, ...props }, ref) => (
    <button
      ref={ref}
      style={{ ...variantStyles[variant], ...style }}
      className={cn(
        'inline-flex items-center justify-center font-medium',
        'transition-colors duration-150 ease-in-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/30',
        'disabled:pointer-events-none disabled:opacity-40',
        'select-none whitespace-nowrap cursor-pointer',
        variantHoverClass[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <svg className="animate-spin h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  ),
);

Button.displayName = 'Button';
