// Thin wrapper around AntD Input.TextArea that preserves the project's label
// + error API. AntD's TextArea onChange already mirrors the native textarea
// onChange shape, so existing `onChange={(e) => set(e.target.value)}` call
// sites compile unchanged.
import { forwardRef } from 'react';
import { Input as AntInput } from 'antd';
import type { TextAreaProps, TextAreaRef } from 'antd/es/input/TextArea';
import { cn } from '@/lib/utils';

interface TextareaProps extends Omit<TextAreaProps, 'status'> {
  label?: string;
  error?: string;
}

const Textarea = forwardRef<TextAreaRef, TextareaProps>(
  ({ label, error, className, required, ...props }, ref) => (
    <div className="w-full">
      {label && (
        <label className={cn('label', required && 'label-required')}>
          {label}
        </label>
      )}
      <AntInput.TextArea
        ref={ref}
        status={error ? 'error' : undefined}
        required={required}
        className={className}
        {...props}
      />
      {error && (
        <p className="mt-1.5 text-xs font-medium text-red-600 animate-slide-down">{error}</p>
      )}
    </div>
  ),
);

Textarea.displayName = 'Textarea';
export default Textarea;
