import { useState } from 'react';
import SectionHead from './SectionHead';
import { useDashboard } from '../context';

const TONE_VAR: Record<string, string> = {
  bad: 'var(--bad)', brand: 'var(--brand)', info: 'var(--info)', warn: 'var(--warn)', good: 'var(--good)',
};

type Cell = { key: string; label: string; value: string | number; sub: React.ReactNode; accent: string; strong?: boolean };

const INITIAL_VISIBLE = 6;

export default function KpiStrip() {
  const { data, has } = useDashboard();
  const [expanded, setExpanded] = useState(false);

  const cells: Cell[] = [];

  // Operational counts.
  if (has('snapshot')) {
    for (const c of data?.panels.snapshot.cards ?? []) {
      const accent = TONE_VAR[c.tone] ?? 'var(--brand)';
      const sub = c.deltaPct !== 0
        ? <span className={`delta ${c.trend === 'down' ? 'down good' : 'down'}`}>{c.trend === 'up' ? '▲' : '▼'} {Math.abs(c.deltaPct)}% vs prior</span>
        : <span className="foot-muted">this period</span>;
      cells.push({ key: c.key, label: c.label, value: c.value, sub, accent });
    }
  }

  // Rate KPIs from the scorecard — drop the ones that duplicate the counts above.
  if (has('scorecard')) {
    for (const k of data?.panels.scorecard.kpis ?? []) {
      if (/open\s+(nc|capa)/i.test(k.label)) continue; // dedupe vs snapshot
      cells.push({ key: `kpi-${k.label}`, label: k.label, value: k.value, sub: k.sub, accent: TONE_VAR[k.tone] ?? 'var(--brand)', strong: true });
    }
  }

  if (!cells.length) return null;

  const visible = expanded ? cells : cells.slice(0, INITIAL_VISIBLE);
  const hidden = Math.max(0, cells.length - INITIAL_VISIBLE);

  const loadMore = hidden > 0 ? (
    <button type="button" className="load-more" onClick={() => setExpanded((v) => !v)}>
      {expanded ? 'Show less' : `Show all (${cells.length})`}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
        style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
        <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  ) : null;

  return (
    <>
      <SectionHead title="Quality Command Metrics" right={loadMore} />
      <div className="kpi-strip">
        {visible.map((c, i) => (
          <div key={c.key} className={`kpi-cell d${(i % 4) + 1}`}>
            <span className="kpi-accent" style={{ background: c.accent }} />
            <span className="kpi-cell-label">{c.label}</span>
            <span className="kpi-cell-val" style={{ color: c.strong ? c.accent : (c.accent === 'var(--bad)' || c.accent === 'var(--warn)' ? c.accent : undefined) }}>{c.value}</span>
            <span className="kpi-cell-sub">{c.sub}</span>
          </div>
        ))}
      </div>
    </>
  );
}
