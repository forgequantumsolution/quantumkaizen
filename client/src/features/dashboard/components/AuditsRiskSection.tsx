import { useEffect, useRef } from 'react';
import { Chart } from 'chart.js';
import SectionHead from './SectionHead';
import { C, gridX, gridY, tooltipStyle } from '../chartTheme';
import { useDashboard } from '../context';

export default function AuditsRiskSection() {
  const { data } = useDashboard();
  const audit = data?.panels.audit;
  const findRef = useRef<HTMLCanvasElement>(null);
  const mixRef = useRef<HTMLCanvasElement>(null);
  const riskRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!audit || !findRef.current || !mixRef.current || !riskRef.current) return;
    [findRef, mixRef, riskRef].forEach((r) => { if (r.current) Chart.getChart(r.current)?.destroy(); });
    const charts: Chart[] = [];

    charts.push(new Chart(findRef.current, {
      type: 'bar',
      data: {
        labels: audit.findingsByDept.map((f) => f.dept),
        datasets: [
          { label: 'Major', data: audit.findingsByDept.map((f) => f.Major), backgroundColor: C.bad, borderRadius: 3, barThickness: 12, stack: 'f' },
          { label: 'Minor', data: audit.findingsByDept.map((f) => f.Minor), backgroundColor: C.warn, borderRadius: 3, barThickness: 12, stack: 'f' },
          { label: 'OFI', data: audit.findingsByDept.map((f) => f.OFI), backgroundColor: C.neutral, borderRadius: 3, barThickness: 12, stack: 'f' },
        ],
      },
      options: {
        plugins: { tooltip: tooltipStyle, legend: { display: true, position: 'bottom', labels: { boxWidth: 9, boxHeight: 9, usePointStyle: true, pointStyle: 'rectRounded', padding: 12, color: C.ink2, font: { size: 10.5 } } } },
        scales: { x: { ...gridX, stacked: true, ticks: { font: { size: 10 } } }, y: { ...gridY, stacked: true, beginAtZero: true, ticks: { stepSize: 1 } } },
      },
    }));

    const mixColors: Record<string, string> = { Critical: C.bad, Major: C.warn, Minor: C.neutral, Observation: C.info };
    charts.push(new Chart<'doughnut'>(mixRef.current, {
      type: 'doughnut',
      data: {
        labels: audit.severityMix.map((s) => s.name),
        datasets: [{ data: audit.severityMix.map((s) => s.value), backgroundColor: audit.severityMix.map((s) => mixColors[s.name] ?? C.neutral), borderWidth: 3, borderColor: '#fff', hoverOffset: 6 }],
      },
      options: { cutout: '62%', plugins: { tooltip: tooltipStyle, legend: { display: true, position: 'bottom', labels: { boxWidth: 8, boxHeight: 8, usePointStyle: true, pointStyle: 'circle', padding: 12, color: C.ink2, font: { size: 11 } } } } },
    }));

    // Qualitative 5×5 risk exposure map (representative view of finding posture).
    charts.push(new Chart(riskRef.current, {
      type: 'bubble',
      data: {
        datasets: [
          { label: 'Low', data: [{ x: 2, y: 2, r: 16 }], backgroundColor: 'rgba(21,163,74,.5)', borderColor: C.good, borderWidth: 1.5 },
          { label: 'Medium', data: [{ x: 2, y: 3, r: 13 }, { x: 3, y: 2, r: 13 }, { x: 3, y: 3, r: 11 }], backgroundColor: 'rgba(224,138,30,.45)', borderColor: C.warn, borderWidth: 1.5 },
          { label: 'High', data: [{ x: 3, y: 4, r: 12 }, { x: 4, y: 3, r: 11 }, { x: 4, y: 4, r: 11 }, { x: 5, y: 3, r: 9 }], backgroundColor: 'rgba(214,52,44,.42)', borderColor: C.bad, borderWidth: 1.5 },
        ],
      },
      options: {
        plugins: { tooltip: { ...tooltipStyle, callbacks: { label: (c) => { const raw = c.raw as { x: number; y: number }; return `L${raw.x} × I${raw.y}`; } } } },
        scales: {
          x: { ...gridY, min: 0, max: 6, title: { display: true, text: 'Likelihood', color: C.ink3, font: { size: 10 } }, ticks: { stepSize: 1 } },
          y: { ...gridY, min: 0, max: 6, title: { display: true, text: 'Impact', color: C.ink3, font: { size: 10 } }, ticks: { stepSize: 1 } },
        },
      },
    }));

    return () => charts.forEach((c) => { try { c.destroy(); } catch { /* */ } });
  }, [audit]);

  return (
    <>
      <SectionHead title="Audits & Risk" tag="Internal & supplier findings" />
      <div className="grid g3">
        <div className="card d1">
          <div className="card-h"><div><h3>Audit Findings by Area</h3><div className="sub">Major / Minor / OFI</div></div>{audit?.sample && <span className="chip">sample</span>}</div>
          <div className="chart-box h-md"><canvas ref={findRef} /></div>
        </div>
        <div className="card d2">
          <div className="card-h"><div><h3>Finding Severity Mix</h3><div className="sub">All open findings</div></div></div>
          <div className="chart-box h-md"><canvas ref={mixRef} /></div>
        </div>
        <div className="card d3">
          <div className="card-h"><div><h3>Risk Matrix</h3><div className="sub">Likelihood × Impact exposure</div></div></div>
          <div className="chart-box h-md"><canvas ref={riskRef} /></div>
        </div>
      </div>
    </>
  );
}
