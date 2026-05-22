import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: ReactNode;
  className?: string;
  /** Disable the default vertical spacing between direct children. */
  noSpacing?: boolean;
  /** Disable the entry animation. */
  noAnimate?: boolean;
  /** Constrain max width — defaults to full bleed inside the layout. */
  maxWidth?: "full" | "7xl" | "5xl" | "3xl";
}

const MAX_WIDTH: Record<NonNullable<PageContainerProps["maxWidth"]>, string> = {
  full: "w-full",
  "7xl": "max-w-7xl mx-auto w-full",
  "5xl": "max-w-5xl mx-auto w-full",
  "3xl": "max-w-3xl mx-auto w-full",
};

/**
 * Single source of truth for page chrome: outer padding, max-width, the
 * page-enter animation, and the default vertical rhythm between direct
 * children (PageHeader → filters → tables, etc.).
 *
 * AppLayout already wraps every non-full-bleed route in this component, so
 * page bodies should return their content directly (no extra padding/space-y
 * wrappers) and rely on PageContainer's defaults. For exceptions, use the
 * noSpacing / noAnimate / maxWidth / className escape hatches.
 */
export default function PageContainer({
  children,
  className,
  noSpacing = false,
  noAnimate = false,
  maxWidth = "full",
}: PageContainerProps) {
  return (
    <div
      className={cn(
        // Outer padding — unified across every page.
        "px-4 sm:px-6 pt-5 pb-10",
        // Width constraint.
        MAX_WIDTH[maxWidth],
        // Entry animation (keeps the existing `page-enter` keyframe used by
        // the app's CSS, and adds the standard fade-in for consistency).
        !noAnimate && "page-enter animate-fade-in",
        // Vertical rhythm between direct children (PageHeader, toolbars,
        // sections, etc.). Pages that lay out their own grid can opt out.
        !noSpacing && "space-y-6",
        className,
      )}
    >
      {children}
    </div>
  );
}
