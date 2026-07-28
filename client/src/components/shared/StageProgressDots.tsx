import { Tooltip } from 'antd';

interface Props {
  /** 0-based index of the current stage within the workflow's linear stage
   *  sequence. */
  stageIndex: number;
  /** Total number of stages in that sequence. */
  totalStages: number;
  className?: string;
}

/**
 * Small filled/hollow dot row showing lifecycle position at a glance in list
 * views, where every non-terminal stage otherwise renders as an identical
 * badge. Caps the rendered dot count so a long workflow doesn't blow out row
 * height — anything past the cap collapses into a "+N" label.
 */
const MAX_DOTS = 8;

export default function StageProgressDots({ stageIndex, totalStages, className }: Props) {
  if (totalStages <= 1 || stageIndex < 0 || stageIndex >= totalStages) return null;

  const overflow = totalStages > MAX_DOTS;
  const shown = overflow ? MAX_DOTS : totalStages;
  // Keep the current stage visible inside the window when the sequence is
  // longer than the dot cap, rather than always showing the first N stages.
  const windowStart = overflow ? Math.min(Math.max(0, stageIndex - Math.floor(shown / 2)), totalStages - shown) : 0;

  const dots = Array.from({ length: shown }, (_, i) => windowStart + i);

  return (
    <Tooltip title={`Stage ${stageIndex + 1} of ${totalStages}`}>
      <span className={`inline-flex items-center gap-1 ${className ?? ''}`}>
        {overflow && windowStart > 0 && <span className="text-[9px] text-gray-300">…</span>}
        {dots.map((i) => (
          <span
            key={i}
            className={`inline-block rounded-full transition-colors ${
              i === stageIndex
                ? 'w-2 h-2 bg-blue-600 ring-2 ring-blue-200'
                : i < stageIndex
                  ? 'w-1.5 h-1.5 bg-emerald-500'
                  : 'w-1.5 h-1.5 bg-gray-200'
            }`}
          />
        ))}
        {overflow && windowStart + shown < totalStages && (
          <span className="text-[9px] text-gray-300">…</span>
        )}
      </span>
    </Tooltip>
  );
}
