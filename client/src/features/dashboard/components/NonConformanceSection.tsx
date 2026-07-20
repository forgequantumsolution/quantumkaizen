import { useEffect, useRef } from 'react';
import { Chart, type ScriptableContext } from 'chart.js';
import SectionHead from './SectionHead';
import { C, gridX, gridY, gradient, tooltipStyle } from '../chartTheme';
import { useDashboard } from '../context';
import { RANGE_LABEL } from '../api';

export default function NonConformanceSection() {
  const { data, range } = useDashboard();
  const nc = data?.panels.nonconformance;
  const trendRef = useRef<HTMLCanvasElement>(null);
  const typeRef = useRef<HTMLCanvasElement>(null);
  const sevRef = useRef<HTMLCanvasElement>(null);
  const deptRef = useRef<HTMLCanvasElement>(null);

  const totalOpen = data?.panels.snapshot.cards.find((c) => c.key === 'openNCs')?.value ?? 0;

  useEffect(() => {
    if (!nc || !trendRef.current || !typeRef.current || !sevRef.current || !deptRef.current) return;
    [trendRef, typeRef, sevRef, deptRef].forEach((r) => { if (r.current) Chart.getChart(r.current)?.destroy(); });
    const charts: Chart[] = [];

    charts.push(new Chart(trendRef.current, {
      type: 'line',
      data: {
        labels: nc.trend.map((t) => t.month),
        datasets: [{
          label: 'New NCs', data: nc.trend.map((t) => t.count),
          borderColor: C.brand, borderWidth: 2.5, tension: 0.35, pointRadius: 4,
          pointBackgroundColor: '#fff', pointBorderColor: C.brand, pointBorderWidth: 2, fill: true,
          backgroundColor: (ctx: ScriptableContext<'line'>) => gradient(ctx.chart.ctx, 240, 'rgba(185,127,23,.18)', 'rgba(185,127,23,0)'),
        }],
      },
      options: { plugins: { tooltip: tooltipStyle }, scales: { x: gridX, y: { ...gridY, beginAtZero: true } } },
    }));

    const typePalette = ['#16202e', C.brand, C.brand2, C.neutral, C.info, C.good];
    charts.push(new Chart<'doughnut'>(typeRef.current, {
      type: 'doughnut',
      data: {
        labels: nc.byType.map((t) => t.type),
        datasets: [{ data: nc.byType.map((t) => t.count), backgroundColor: typePalette, borderWidth: 3, borderColor: '#fff', hoverOffset: 6 }],
      },
      options: {
        cutout: '62%',
        plugins: { tooltip: tooltipStyle, legend: { display: true, position: 'bottom', labels: { boxWidth: 8, boxHeight: 8, usePointStyle: true, pointStyle: 'circle', padding: 12, color: C.ink2, font: { size: 11 } } } },
      },
    }));

    charts.push(new Chart(sevRef.current, {
      type: 'bar',
      data: {
        labels: nc.severityTrend.map((s) => s.month),
        datasets: [
          { label: 'Critical', data: nc.severityTrend.map((s) => s.Critical), backgroundColor: C.bad, borderRadius: 3, stack: 's', barThickness: 30 },
          { label: 'Major', data: nc.severityTrend.map((s) => s.Major), backgroundColor: C.warn, borderRadius: 3, stack: 's', barThickness: 30 },
          { label: 'Minor', data: nc.severityTrend.map((s) => s.Minor), backgroundColor: C.neutral, borderRadius: { topLeft: 4, topRight: 4 }, stack: 's', barThickness: 30 },
        ],
      },
      options: {
        plugins: { tooltip: tooltipStyle, legend: { display: true, position: 'bottom', labels: { boxWidth: 9, boxHeight: 9, usePointStyle: true, pointStyle: 'rectRounded', padding: 12, color: C.ink2, font: { size: 11 } } } },
        scales: { x: { ...gridX, stacked: true }, y: { ...gridY, stacked: true, beginAtZero: true } },
      },
    }));

    charts.push(new Chart(deptRef.current, {
      type: 'bar',
      data: {
        labels: nc.byDepartment.map((d) => d.dept),
        datasets: [{ label: 'NCs', data: nc.byDepartment.map((d) => d.count), backgroundColor: C.brand2, borderRadius: 4, barThickness: 18 }],
      },
      options: {
        indexAxis: 'y' as const,
        plugins: { tooltip: tooltipStyle },
        scales: { x: { ...gridY, beginAtZero: true }, y: gridX },
      },
    }));

    return () => charts.forEach((c) => { try { c.destroy(); } catch { /* */ } });
  }, [nc]);

  return (
    <>
      <SectionHead title="Non-Conformance" tag={`${totalOpen} open · ${RANGE_LABEL[range]}`} />
      <div className="grid g3">
        <div className="card d1">
          <div className="card-h">
            <div><h3>NC Trend</h3><div className="sub">{RANGE_LABEL[range]} · new non-conformances</div></div>
            {nc?.sample && <span className="chip">sample</span>}
          </div>
          <div className="chart-box h-md"><canvas ref={trendRef} /></div>
        </div>

        <div className="card d2">
          <div className="card-h"><div><h3>NC by Type</h3><div className="sub">Distribution this period</div></div></div>
          <div className="chart-box h-md"><canvas ref={typeRef} /></div>
        </div>

        <div className="card d3">
          <div className="card-h"><div><h3>NC Severity</h3><div className="sub">Critical / Major / Minor</div></div></div>
          <div className="chart-box h-md"><canvas ref={sevRef} /></div>
        </div>

        <div className="card d1">
          <div className="card-h"><div><h3>NC by Department</h3><div className="sub">Where non-conformances originate</div></div></div>
          <div className="chart-box h-md"><canvas ref={deptRef} /></div>
        </div>
      </div>
    </>
  );
}
