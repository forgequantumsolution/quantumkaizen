// Thin wrapper around AntD Button that preserves this app's `variant` / `size`
// vocabulary. Existing call sites compile unchanged. The two non-AntD variants
// (`secondary` = navy, `approve` = green) attach utility classes defined in
// index.css that override AntD's primary background via theme CSS vars.
import React from 'react';
import { Button as AntButton, type ButtonProps as AntButtonProps } from 'antd';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'approve' | 'reject';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<AntButtonProps, 'type' | 'size' | 'variant'> {
  variant?: Variant;
  size?: Size;
  /** Legacy alias for AntD's `loading`. */
  isLoading?: boolean;
}

const SIZE_MAP: Record<Size, AntButtonProps['size']> = {
  sm: 'small',
  md: 'middle',
  lg: 'large',
};

interface VariantMapped {
  type: AntButtonProps['type'];
  danger?: boolean;
  className?: string;
}

const VARIANT_MAP: Record<Variant, VariantMapped> = {
  primary:   { type: 'primary' },
  secondary: { type: 'primary', className: 'kaizen-btn-secondary' },
  outline:   { type: 'default' },
  ghost:     { type: 'text' },
  danger:    { type: 'primary', danger: true },
  approve:   { type: 'primary', className: 'kaizen-btn-approve' },
  reject:    { type: 'default', danger: true },
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', isLoading, loading, className, ...rest }, ref) => {
    const mapped = VARIANT_MAP[variant];
    return (
      <AntButton
        ref={ref}
        type={mapped.type}
        danger={mapped.danger}
        size={SIZE_MAP[size]}
        loading={isLoading ?? loading}
        className={cn(mapped.className, className)}
        {...rest}
      />
    );
  },
);

Button.displayName = 'Button';
