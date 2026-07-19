import { useState } from 'react';
import SectionHead from './SectionHead';
import { useDashboard } from '../context';

const TONE_VAR: Record<string, string> = {
  bad: 'var(--bad)', brand: 'var(--brand)', info: 'var(--info)', warn: 'var(--warn)', good: 'var(--good)',
};
const INITIAL_VISIBLE = 4;

export default function OperationalSnapshot() {
  const { data } = useDashboard();
  const [expanded, setExpanded] = useState(false);
  const cards = data?.panels.snapshot.cards ?? [];

  const visible = expanded ? cards : cards.slice(0, INITIAL_VISIBLE);
  const hidden = Math.max(0, cards.length - INITIAL_VISIBLE);

  const loadMoreButton = hidden > 0 ? (
    <button type="button" className="load-more" onClick={() => setExpanded((v) => !v)}>
      {expanded ? 'Show less' : `Load more (${hidden})`}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
        style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
        <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  ) : null;

  return (
    <>
      <SectionHead title="Operational Snapshot" right={loadMoreButton} />
      <div className="snap">
        {visible.map((s, i) => {
          const accent = TONE_VAR[s.tone] ?? 'var(--brand)';
          const valueColor = s.tone === 'bad' || s.tone === 'warn' ? accent : undefined;
          const foot = s.deltaPct !== 0
            ? <span className={`delta ${s.trend === 'down' ? 'down good' : 'down'}`}>
                {s.trend === 'up' ? '▲' : '▼'} {Math.abs(s.deltaPct)}% vs prior
              </span>
            : <span className="foot-muted">this period</span>;
          return (
            <div key={s.key ?? i} className={`stat d${(i % 4) + 1}`}>
              <span className="accent" style={{ background: accent }} />
              <span className="lab">{s.label}</span>
              <span className="v" style={{ color: valueColor }}>{s.value}</span>
              <span className="foot">{foot}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}
