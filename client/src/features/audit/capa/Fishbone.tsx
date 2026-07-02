import { FISHBONE_CATEGORIES, type FishboneCategory } from './capaData';

interface Props {
  data: Record<FishboneCategory, string[]>;
  /** Short problem label shown in the head of the fish. */
  effect?: string;
}

// Per-category accent colours (top row warm, bottom row cool).
const COLORS: Record<FishboneCategory, string> = {
  Man: '#6366F1',
  Machine: '#8B5CF6',
  Material: '#D97706',
  Method: '#0EA5E9',
  Measurement: '#10B981',
  Environment: '#EF4444',
};

// A read-only Ishikawa (fishbone) diagram: a central spine ending in the effect,
// with three category bones angled off the top and three off the bottom, each
// listing its contributing causes.
export default function Fishbone({ data, effect = 'Root Cause' }: Props) {
  const W = 900;
  const H = 380;
  const spineY = H / 2;
  const headX = W - 150;
  const startX = 40;

  const top = FISHBONE_CATEGORIES.slice(0, 3);
  const bottom = FISHBONE_CATEGORIES.slice(3);

  // Evenly space the three bones on each side along the spine.
  const boneX = (i: number) => startX + 110 + i * ((headX - startX - 140) / 3);

  const renderBone = (cat: FishboneCategory, i: number, side: 'top' | 'bottom') => {
    const x = boneX(i);
    const color = COLORS[cat];
    const yTip = side === 'top' ? spineY - 150 : spineY + 150;
    const xTip = x - 70;
    const causes = data[cat] ?? [];
    return (
      <g key={cat}>
        <line x1={x} y1={spineY} x2={xTip} y2={yTip} stroke={color} strokeWidth={2} />
        <rect
          x={xTip - 46}
          y={side === 'top' ? yTip - 22 : yTip}
          width={92}
          height={22}
          rx={4}
          fill={color}
        />
        <text
          x={xTip}
          y={side === 'top' ? yTip - 7 : yTip + 15}
          textAnchor="middle"
          fontSize={12}
          fontWeight={600}
          fill="#fff"
        >
          {cat}
        </text>
        {causes.slice(0, 4).map((c, j) => {
          const t = (j + 1) / 5;
          const px = x + (xTip - x) * t;
          const py = spineY + (yTip - spineY) * t;
          return (
            <text
              key={j}
              x={px + 8}
              y={py + (side === 'top' ? -2 : 12)}
              fontSize={10}
              fill="#475569"
            >
              {c.length > 34 ? `${c.slice(0, 33)}…` : c}
            </text>
          );
        })}
      </g>
    );
  };

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="min-w-[720px] w-full">
        {/* spine */}
        <line x1={startX} y1={spineY} x2={headX} y2={spineY} stroke="#94A3B8" strokeWidth={3} />
        {/* arrow head into effect box */}
        <polygon
          points={`${headX},${spineY - 8} ${headX + 14},${spineY} ${headX},${spineY + 8}`}
          fill="#94A3B8"
        />
        {/* effect box */}
        <rect x={headX + 14} y={spineY - 26} width={126} height={52} rx={8} fill="#0F172A" />
        <text
          x={headX + 14 + 63}
          y={spineY + 4}
          textAnchor="middle"
          fontSize={13}
          fontWeight={700}
          fill="#fff"
        >
          {effect.length > 16 ? `${effect.slice(0, 15)}…` : effect}
        </text>
        {top.map((c, i) => renderBone(c, i, 'top'))}
        {bottom.map((c, i) => renderBone(c, i, 'bottom'))}
      </svg>
    </div>
  );
}
