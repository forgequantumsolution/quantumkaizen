import { forwardRef, TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, ...props }, ref) => (
    <div className="w-full">
      {label && (
        <label className={cn('label', props.required && 'label-required')}>
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        className={cn(
          'input-base h-auto min-h-[88px] py-2.5 resize-y',
          error && 'input-error',
          className,
        )}
        {...props}
      />
      {error && (
        <p className="mt-1.5 text-xs font-medium text-red-600 animate-slide-down">{error}</p>
      )}
    </div>
  )
);

Textarea.displayName = 'Textarea';
export default Textarea;
