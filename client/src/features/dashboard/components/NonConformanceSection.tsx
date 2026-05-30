import { useEffect, useRef } from 'react';
import { Chart, type ScriptableContext } from 'chart.js';
import SectionHead from './SectionHead';
import { C, gridX, gridY, gradient, tooltipStyle } from '../chartTheme';

export default function NonConformanceSection() {
  const trendRef = useRef<HTMLCanvasElement>(null);
  const typeRef = useRef<HTMLCanvasElement>(null);
  const sevRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!trendRef.current || !typeRef.current || !sevRef.current) return;
    [trendRef, typeRef, sevRef].forEach((r) => {
      if (r.current) Chart.getChart(r.current)?.destroy();
    });
    const charts: Chart[] = [];

    charts.push(
      new Chart(trendRef.current, {
        type: 'line',
        data: {
          labels: ['Oct-24', 'Nov-24', 'Dec-24'],
          datasets: [
            {
              label: 'New NCs',
              data: [6, 7, 8],
              borderColor: C.brand,
              borderWidth: 2.5,
              tension: 0.35,
              pointRadius: 4,
              pointBackgroundColor: '#fff',
              pointBorderColor: C.brand,
              pointBorderWidth: 2,
              fill: true,
              backgroundColor: (ctx: ScriptableContext<'line'>) =>
                gradient(ctx.chart.ctx, 240, 'rgba(185,127,23,.18)', 'rgba(185,127,23,0)'),
            },
          ],
        },
        options: {
          plugins: { tooltip: tooltipStyle },
          scales: { x: gridX, y: { ...gridY, beginAtZero: true, suggestedMax: 10 } },
        },
      }),
    );

    charts.push(
      new Chart<'doughnut'>(typeRef.current, {
        type: 'doughnut',
        data: {
          labels: ['Deviation', 'Product NC', 'Process NC', 'OOS'],
          datasets: [
            {
              data: [4, 3, 2, 2],
              backgroundColor: ['#16202e', C.brand, C.brand2, C.neutral],
              borderWidth: 3,
              borderColor: '#fff',
              hoverOffset: 6,
            },
          ],
        },
        options: {
          cutout: '62%',
          plugins: {
            tooltip: tooltipStyle,
            legend: {
              display: true,
              position: 'bottom',
              labels: {
                boxWidth: 8, boxHeight: 8, usePointStyle: true,
                pointStyle: 'circle', padding: 14, color: C.ink2, font: { size: 11.5 },
              },
            },
          },
        },
      }),
    );

    charts.push(
      new Chart(sevRef.current, {
        type: 'bar',
        data: {
          labels: ['Oct-24', 'Nov-24', 'Dec-24'],
          datasets: [
            { label: 'Critical', data: [1, 1, 1], backgroundColor: C.bad, borderRadius: 3, stack: 's', barThickness: 34 },
            { label: 'Major',    data: [3, 3, 4], backgroundColor: C.warn, borderRadius: 3, stack: 's', barThickness: 34 },
            { label: 'Minor',    data: [2, 2, 3], backgroundColor: C.neutral, borderRadius: { topLeft: 4, topRight: 4 }, stack: 's', barThickness: 34 },
          ],
        },
        options: {
          plugins: {
            tooltip: tooltipStyle,
            legend: {
              display: true, position: 'bottom',
              labels: {
                boxWidth: 9, boxHeight: 9, usePointStyle: true,
                pointStyle: 'rectRounded', padding: 14, color: C.ink2, font: { size: 11 },
              },
            },
          },
          scales: {
            x: { ...gridX, stacked: true },
            y: { ...gridY, stacked: true, beginAtZero: true },
          },
        },
      }),
    );

    return () => charts.forEach((c) => { try { c.destroy(); } catch { /* */ } });
  }, []);

  return (
    <>
      <SectionHead title="Non-Conformance" tag="11 open · trending up" />
      <div className="grid g3">
        <div className="card d1">
          <div className="card-h">
            <div>
              <h3>NC Trend</h3>
              <div className="sub">Last 30 days · new non-conformances</div>
            </div>
            <span className="chip bad">▲ trending</span>
          </div>
          <div className="chart-box h-md"><canvas ref={trendRef} /></div>
        </div>

        <div className="card d2">
          <div className="card-h">
            <div>
              <h3>NC by Type</h3>
              <div className="sub">Distribution this period</div>
            </div>
          </div>
          <div className="chart-box h-md"><canvas ref={typeRef} /></div>
        </div>

        <div className="card d3">
          <div className="card-h">
            <div>
              <h3>NC Severity</h3>
              <div className="sub">Critical / Major / Minor by month</div>
            </div>
          </div>
          <div className="chart-box h-md"><canvas ref={sevRef} /></div>
        </div>
      </div>
    </>
  );
}
