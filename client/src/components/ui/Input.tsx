import { forwardRef, InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className, ...props }, ref) => (
    <div className="w-full">
      {label && (
        <label className={cn('label', props.required && 'label-required')}>
          {label}
        </label>
      )}
      <input
        ref={ref}
        className={cn('input-base', error && 'input-error', className)}
        {...props}
      />
      {error && (
        <p className="mt-1.5 text-xs font-medium text-red-600 animate-slide-down">{error}</p>
      )}
      {helperText && !error && (
        <p className="mt-1.5 text-xs text-gray-500">{helperText}</p>
      )}
    </div>
  )
);

Input.displayName = 'Input';
export default Input;
