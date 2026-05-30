import { useEffect, useRef } from 'react';
import { Chart, type ScriptableContext } from 'chart.js';
import SectionHead from './SectionHead';
import { C, gridX, gridY, gradient, tooltipStyle } from '../chartTheme';

export default function CapaComplaintsSection() {
  const stageRef = useRef<HTMLCanvasElement>(null);
  const cmpRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!stageRef.current || !cmpRef.current) return;
    [stageRef, cmpRef].forEach((r) => {
      if (r.current) Chart.getChart(r.current)?.destroy();
    });
    const charts: Chart[] = [];

    charts.push(
      new Chart(stageRef.current, {
        type: 'bar',
        data: {
          labels: ['Initiated', 'Containment', 'Root Cause', 'Action Defn', 'Implementation', 'Effectiveness', 'Closed'],
          datasets: [
            {
              data: [1, 1, 2, 2, 4, 1, 9],
              borderRadius: 5,
              barThickness: 20,
              backgroundColor: ['#e3b85a', '#e3b85a', '#e3b85a', '#e3b85a', C.warn, '#e3b85a', C.good],
            },
          ],
        },
        options: {
          indexAxis: 'y',
          plugins: { tooltip: tooltipStyle },
          scales: {
            x: { ...gridY, beginAtZero: true, suggestedMax: 12 },
            y: { ...gridX, ticks: { color: C.ink2, font: { size: 11.5 } } },
          },
        },
      }),
    );

    charts.push(
      new Chart(cmpRef.current, {
        type: 'line',
        data: {
          labels: ['Oct-24', 'Nov-24', 'Dec-24'],
          datasets: [
            {
              label: 'Received', data: [5, 7, 5],
              borderColor: C.bad, borderWidth: 2.5, tension: 0.4,
              pointRadius: 4, pointBackgroundColor: '#fff', pointBorderColor: C.bad, pointBorderWidth: 2,
              fill: false,
            },
            {
              label: 'Resolved', data: [6, 7, 6],
              borderColor: C.good, borderWidth: 2.5, tension: 0.4,
              pointRadius: 4, pointBackgroundColor: '#fff', pointBorderColor: C.good, pointBorderWidth: 2,
              fill: true,
              backgroundColor: (ctx: ScriptableContext<'line'>) =>
                gradient(ctx.chart.ctx, 280, 'rgba(21,163,74,.14)', 'rgba(21,163,74,0)'),
            },
          ],
        },
        options: {
          plugins: {
            tooltip: tooltipStyle,
            legend: {
              display: true, position: 'bottom',
              labels: {
                boxWidth: 8, boxHeight: 8, usePointStyle: true,
                pointStyle: 'circle', padding: 16, color: C.ink2, font: { size: 11.5 },
              },
            },
          },
          scales: { x: gridX, y: { ...gridY, beginAtZero: true, suggestedMax: 8 } },
        },
      }),
    );

    return () => charts.forEach((c) => { try { c.destroy(); } catch { /* */ } });
  }, []);

  return (
    <>
      <SectionHead title="CAPA & Complaints" tag="9 closed · 6 in progress" />
      <div className="grid g2">
        <div className="card d1">
          <div className="card-h">
            <div>
              <h3>CAPA by Stage</h3>
              <div className="sub">Workflow pipeline distribution</div>
            </div>
          </div>
          <div className="chart-box h-lg"><canvas ref={stageRef} /></div>
        </div>

        <div className="card d2">
          <div className="card-h">
            <div>
              <h3>Complaints — Received vs Resolved</h3>
              <div className="sub">Quarterly resolution gap</div>
            </div>
            <span className="chip good">net positive</span>
          </div>
          <div className="chart-box h-lg"><canvas ref={cmpRef} /></div>
        </div>
      </div>
    </>
  );
}
