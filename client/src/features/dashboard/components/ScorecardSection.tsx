import SectionHead from './SectionHead';
import { useDashboard } from '../context';

const TONE_VAR: Record<string, string> = {
  good: 'var(--good)', warn: 'var(--warn)', bad: 'var(--bad)', info: 'var(--info)', brand: 'var(--brand)',
};

export default function ScorecardSection() {
  const { data } = useDashboard();
  const kpis = data?.panels.scorecard.kpis ?? [];

  return (
    <>
      <SectionHead title="Quality Scorecard" tag="Key performance indicators" />
      <div className="scorecard">
        {kpis.map((k, i) => {
          const color = TONE_VAR[k.tone] ?? 'var(--brand)';
          return (
            <div key={i} className={`kpi-tile d${(i % 4) + 1}`}>
              <span className="kpi-ring" style={{ borderColor: color }} />
              <div className="kpi-val" style={{ color }}>{k.value}</div>
              <div className="kpi-label">{k.label}</div>
              <div className="kpi-sub">{k.sub}</div>
            </div>
          );
        })}
      </div>
    </>
  );
}
