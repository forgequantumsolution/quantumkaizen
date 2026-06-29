import { useState } from 'react';
import SectionHead from './SectionHead';

type Stat = {
  label: string;
  value: React.ReactNode;
  foot: React.ReactNode;
  accent: string;
  valueColor?: string;
  delay: string;
};

const STATS: Stat[] = [
  {
    label: 'Open NCs', value: 11, accent: 'var(--bad)', valueColor: 'var(--bad)',
    foot: <span className="delta down">▲ 8% vs prior</span>, delay: 'd1',
  },
  {
    label: 'Open CAPAs', value: 6, accent: 'var(--brand)',
    foot: <span className="delta down good">▼ 12% vs prior</span>, delay: 'd1',
  },
  {
    label: 'Pending Approvals', value: 4, accent: 'var(--info)',
    foot: 'awaiting sign-off', delay: 'd2',
  },
  {
    label: 'Expiring Docs', value: 2, accent: 'var(--warn)',
    foot: 'within 30 days', delay: 'd2',
  },
  {
    label: 'Overdue Actions', value: 2, accent: 'var(--bad)', valueColor: 'var(--bad)',
    foot: 'past due date', delay: 'd3',
  },
  {
    label: 'Supplier Score',
    value: <>86<span style={{ fontSize: 15, color: 'var(--ink-3)' }}>%</span></>,
    accent: 'var(--good)', foot: 'avg quality rating', delay: 'd3',
  },
  {
    label: 'Batch Release OT',
    value: <>91<span style={{ fontSize: 15, color: 'var(--ink-3)' }}>%</span></>,
    accent: 'var(--good)', foot: 'on-time release', delay: 'd4',
  },
  {
    label: 'OOS Rate',
    value: <>2.3<span style={{ fontSize: 15 }}>%</span></>,
    accent: 'var(--warn)', valueColor: 'var(--warn)',
    foot: 'out-of-spec events', delay: 'd4',
  },
];

const INITIAL_VISIBLE = 4;

export default function OperationalSnapshot() {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? STATS : STATS.slice(0, INITIAL_VISIBLE);
  const hidden = STATS.length - INITIAL_VISIBLE;

  const loadMoreButton = hidden > 0 ? (
    <button
      type="button"
      className="load-more"
      onClick={() => setExpanded((v) => !v)}
    >
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
        {visible.map((s, i) => (
          <div key={i} className={`stat ${s.delay}`}>
            <span className="accent" style={{ background: s.accent }} />
            <span className="lab">{s.label}</span>
            <span className="v" style={{ color: s.valueColor }}>{s.value}</span>
            <span className="foot">{s.foot}</span>
          </div>
        ))}
      </div>
    </>
  );
}
