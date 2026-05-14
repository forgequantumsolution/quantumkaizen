/**
 * SVG progress ring for an SLA timer.
 *
 * Colour bands (FE.Q4):
 *   < 50%        → green
 *   50% – 79%    → amber
 *   ≥ 80% / BREACHED → red
 *
 * PAUSED renders a pause glyph instead of the percentage.
 */
import { Pause } from 'lucide-react';
import type { SlaTimerStatus } from '@/lib/api/sla';

interface Props {
  /** 0–100+ — can exceed 100 when past deadline. */
  percentage: number;
  status: SlaTimerStatus;
  /** Pixel size of the ring. Defaults to 64. */
  size?: number;
}

const colourFor = (pct: number, status: SlaTimerStatus): string => {
  if (status === 'BREACHED') return '#DC2626'; // red-600
  if (status === 'COMPLETED') return '#16A34A'; // green-600
  if (pct >= 80) return '#DC2626';
  if (pct >= 50) return '#D97706'; // amber-600
  return '#16A34A';
};

export default function SlaProgressRing({ percentage, status, size = 64 }: Props) {
  const stroke = 6;
  const r = size / 2 - stroke;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(percentage, 100));
  const offset = c * (1 - clamped / 100);
  const color = colourFor(percentage, status);
  const label = status === 'BREACHED' ? '!' : `${Math.round(clamped)}%`;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="#E5E7EB"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 600ms ease, stroke 300ms ease' }}
        />
      </svg>
      <div
        className="absolute inset-0 flex items-center justify-center text-xs font-semibold"
        style={{ color }}
      >
        {status === 'PAUSED' ? <Pause size={size / 4} /> : label}
      </div>
    </div>
  );
}
