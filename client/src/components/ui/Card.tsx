import React from 'react';
import { cn } from '@/lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  noPadding?: boolean;
  /** Elevated variant — slightly more prominent shadow */
  elevated?: boolean;
  /** Top accent border color (e.g. '#C9A84C', '#3B82F6') */
  accent?: string;
}

export function Card({ className, children, noPadding, elevated, accent, style, ...props }: CardProps) {
  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '10px',
        boxShadow: elevated
          ? '0 4px 16px 0 rgba(0,0,0,0.08)'
          : '0 2px 8px 0 rgba(0,0,0,0.06)',
        ...(accent ? { borderTop: `3px solid ${accent}` } : {}),
        ...style,
      }}
      className={cn(!noPadding && 'p-5', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex items-center justify-between mb-4', className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn('text-sm font-semibold text-ink leading-snug', className)} {...props}>
      {children}
    </h3>
  );
}

export function CardDescription({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('text-xs text-ink-secondary mt-0.5', className)} {...props}>
      {children}
    </p>
  );
}

export function CardSection({
  title, children, className, ...props
}: React.HTMLAttributes<HTMLDivElement> & { title?: string }) {
  return (
    <div
      style={{ borderTop: '1px solid #E8ECF2' }}
      className={cn('pt-4 mt-4', className)}
      {...props}
    >
      {title && (
        <p className="text-xxs font-semibold uppercase tracking-widest text-ink-tertiary mb-3">{title}</p>
      )}
      {children}
    </div>
  );
}

export function RecordMeta({
  createdAt, createdBy, modifiedAt, modifiedBy, status, stage, className,
}: {
  createdAt?: string; createdBy?: string;
  modifiedAt?: string; modifiedBy?: string;
  status?: string; stage?: string;
  className?: string;
}) {
  return (
    <div
      style={{ borderTop: '1px solid #E8ECF2', backgroundColor: '#F4F6FA', borderRadius: '0 0 10px 10px' }}
      className={cn('flex flex-wrap items-center gap-x-5 gap-y-1 px-5 py-2.5 text-xxs text-ink-tertiary font-mono', className)}
    >
      {createdAt && (
        <span>Created <span className="text-ink-secondary">{createdAt}</span>{createdBy ? ` by ${createdBy}` : ''}</span>
      )}
      {modifiedAt && (
        <span>Modified <span className="text-ink-secondary">{modifiedAt}</span>{modifiedBy ? ` by ${modifiedBy}` : ''}</span>
      )}
      {status && (
        <span>Status <span className="text-ink font-sans font-medium">{status}</span></span>
      )}
      {stage && (
        <span>Stage <span className="text-ink font-sans font-medium">{stage}</span></span>
      )}
    </div>
  );
}
