import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageContainerProps {
  children: ReactNode;
  className?: string;
}

export default function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div
      className={cn(
        'page-enter w-full px-6 lg:px-8 xl:px-10 py-6',
        className
      )}
    >
      {children}
    </div>
  );
}
