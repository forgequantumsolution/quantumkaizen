import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: ReactNode;
  className?: string;
}

export default function PageContainer({
  children,
  className,
}: PageContainerProps) {
  return (
    <div className={cn("page-enter w-full px-2 pb-6 mt-2", className)}>
      {children}
    </div>
  );
}
