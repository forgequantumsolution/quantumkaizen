// Thin wrapper around AntD Input that preserves the project's label / error /
// helperText API. AntD Input's onChange already passes a synthetic event, so
// existing `onChange={(e) => set(e.target.value)}` call sites compile unchanged.
import { forwardRef } from 'react';
import { Input as AntInput, type InputProps as AntInputProps, type InputRef } from 'antd';
import { cn } from '@/lib/utils';

interface InputProps extends Omit<AntInputProps, 'status'> {
  label?: string;
  error?: string;
  helperText?: string;
}

const Input = forwardRef<InputRef, InputProps>(
  ({ label, error, helperText, className, required, ...props }, ref) => (
    <div className="w-full">
      {label && (
        <label className={cn('label', required && 'label-required')}>
          {label}
        </label>
      )}
      <AntInput
        ref={ref}
        status={error ? 'error' : undefined}
        required={required}
        className={className}
        {...props}
      />
      {error && (
        <p className="mt-1.5 text-xs font-medium text-red-600 animate-slide-down">{error}</p>
      )}
      {helperText && !error && (
        <p className="mt-1.5 text-xs text-gray-500">{helperText}</p>
      )}
    </div>
  ),
);

Input.displayName = 'Input';
export default Input;
