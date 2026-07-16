/**
 * ComplianceGauge (spec §5) — single-value % vs. a target threshold, shown as a
 * 270° radial gauge. Colour follows green/amber/red semantics relative to target.
 * Repurposable for any %-compliance KPI (FTR%, PM Compliance%, Closure Rate%,
 * Schedule Compliance%, coverage %, …).
 *
 * Pure-SVG gauge: a soft track, a gradient progress arc with rounded caps, a
 * target tick on the ring, and the value + status stacked in the hub.
 */
import { useId } from 'react';
import { PALETTE } from './kit';

export interface ComplianceGaugeProps {
  value: number;            // 0–100
  target?: number;          // threshold; default 90
  label?: string;
  height?: number;
  /** Override the auto (green/amber/red) colour rule. */
  color?: string;
  /** Secondary caption under the value (e.g. "142 / 150 on time"). */
  caption?: string;
}

type Status = 'good' | 'warn' | 'bad';

function statusOf(value: number, target: number): Status {
  if (value >= target) return 'good';
  if (value >= target - 15) return 'warn';
  return 'bad';
}

const STATUS_META: Record<Status, { color: string; soft: string; text: string; label: string }> = {
  good: { color: PALETTE.good, soft: 'rgba(34,197,94,0.12)', text: '#15803D', label: 'On target' },
  warn: { color: PALETTE.warn, soft: 'rgba(245,158,11,0.14)', text: '#B45309', label: 'Near target' },
  bad: { color: PALETTE.bad, soft: 'rgba(239,68,68,0.12)', text: '#B91C1C', label: 'Below target' },
};

// Gauge geometry — a 270° arc with the gap centred at the bottom.
const SWEEP = 270;                 // degrees of visible arc
const START = 90 + (360 - SWEEP) / 2; // first drawn angle (clockwise from east) → 135°

/** Point on the gauge circle for a 0–1 fraction along the arc. */
function pointAt(frac: number, cx: number, cy: number, r: number) {
  const rad = ((START + frac * SWEEP) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

export default function ComplianceGauge({
  value,
  target = 90,
  label,
  height = 200,
  color,
  caption,
}: ComplianceGaugeProps) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const st = statusOf(v, target);
  const meta = STATUS_META[st];
  const stroke = color ?? meta.color;
  const gid = useId();

  // Square SVG sized to the available height; the hub content is HTML overlaid
  // dead-centre so it scales independently of the arc.
  const size = Math.min(height + 40, 240);
  const cx = 100;
  const cy = 100;
  const r = 82;
  const sw = 16;

  const C = 2 * Math.PI * r;
  const arcLen = (SWEEP / 360) * C;        // length of the full track
  const progLen = (v / 100) * arcLen;      // length of the coloured progress
  const rot = `rotate(${START} ${cx} ${cy})`;

  const tick = pointAt(Math.min(1, Math.max(0, target / 100)), cx, cy, r);
  const tickInner = pointAt(Math.min(1, Math.max(0, target / 100)), cx, cy, r - sw / 2 - 4);
  const tickOuter = pointAt(Math.min(1, Math.max(0, target / 100)), cx, cy, r + sw / 2 + 4);

  return (
    <div className="relative flex items-center justify-center" style={{ height }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 200 200"
        className="overflow-visible"
        style={{ maxWidth: '100%' }}
      >
        <defs>
          <linearGradient id={`${gid}-arc`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity={0.65} />
            <stop offset="100%" stopColor={stroke} stopOpacity={1} />
          </linearGradient>
        </defs>

        {/* Track */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="#EEF1F5"
          strokeWidth={sw}
          strokeLinecap="round"
          strokeDasharray={`${arcLen} ${C}`}
          transform={rot}
        />

        {/* Progress arc */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={`url(#${gid}-arc)`}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeDasharray={`${progLen} ${C}`}
          transform={rot}
          style={{ transition: 'stroke-dasharray 700ms cubic-bezier(0.22,1,0.36,1)' }}
        />

        {/* Target tick across the ring */}
        <line
          x1={tickInner.x}
          y1={tickInner.y}
          x2={tickOuter.x}
          y2={tickOuter.y}
          stroke="#94A3B8"
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        <circle cx={tick.x} cy={tick.y} r={2.6} fill="#475569" />
      </svg>

      {/* Hub — value + status, centred over the arc */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
        <span className="text-[40px] font-extrabold leading-none tracking-tight text-gray-900 tabular-nums">
          {v}
          <span className="text-[20px] font-bold text-gray-400 align-top ml-0.5">%</span>
        </span>
        {label && <span className="mt-1.5 text-[12px] font-medium text-gray-500">{label}</span>}
        {caption && <span className="mt-0.5 text-[11px] text-gray-400">{caption}</span>}
        <span
          className="mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
          style={{ backgroundColor: meta.soft, color: meta.text }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
          {meta.label} · {target}%
        </span>
      </div>
    </div>
  );
}
