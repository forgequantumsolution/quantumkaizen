import { cn } from '@/lib/utils';

interface HeatmapCell {
  date: string;   // ISO date string e.g. "2026-04-10"
  count: number;
}

interface HeatmapGridProps {
  data: HeatmapCell[];
  days?: number; // defaults to 49 (7 weeks)
}

function getCellColor(count: number): string {
  if (count === 0) return '#F4F6FA';
  if (count === 1) return '#BFDBFE';
  if (count <= 3) return '#93C5FD';
  if (count <= 6) return '#60A5FA';
  if (count <= 10) return '#3B82F6';
  return '#1D4ED8';
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function HeatmapGrid({ data, days = 49 }: HeatmapGridProps) {
  // Build a lookup map from date string → count
  const countMap = new Map(data.map(d => [d.date, d.count]));

  // Generate last `days` dates ending today
  const cells: { date: string; count: number }[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    cells.push({ date: iso, count: countMap.get(iso) ?? 0 });
  }

  return (
    <div className="w-full">
      {/* Day labels */}
      <div className="grid gap-1 mb-1" style={{ gridTemplateColumns: `repeat(7, minmax(0, 1fr))` }}>
        {DAY_LABELS.map(d => (
          <div key={d} className="text-center text-[10px] font-medium text-gray-400">{d}</div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(7, minmax(0, 1fr))` }}>
        {cells.map(({ date, count }) => (
          <div
            key={date}
            title={`${date}: ${count} NC${count !== 1 ? 's' : ''}`}
            className={cn('rounded aspect-square cursor-default transition-opacity hover:opacity-80')}
            style={{ backgroundColor: getCellColor(count) }}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-1.5 mt-3 justify-end">
        <span className="text-[10px] text-gray-400">Less</span>
        {[0, 1, 3, 6, 10, 11].map((n, i) => (
          <div
            key={i}
            className="w-3 h-3 rounded-sm"
            style={{ backgroundColor: getCellColor(n) }}
          />
        ))}
        <span className="text-[10px] text-gray-400">More</span>
      </div>
    </div>
  );
}
