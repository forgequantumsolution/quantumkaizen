import { useEffect, useRef } from 'react';
import { Chart } from 'chart.js';
import SectionHead from './SectionHead';
import { C, gridX, gridY, tooltipStyle } from '../chartTheme';

export default function AuditsRiskSection() {
  const findRef = useRef<HTMLCanvasElement>(null);
  const riskRef = useRef<HTMLCanvasElement>(null);
  const supRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!findRef.current || !riskRef.current || !supRef.current) return;
    [findRef, riskRef, supRef].forEach((r) => {
      if (r.current) Chart.getChart(r.current)?.destroy();
    });
    const charts: Chart[] = [];

    charts.push(
      new Chart(findRef.current, {
        type: 'bar',
        data: {
          labels: ['QC Lab', 'Production', 'QA', 'Warehouse', 'Engineering'],
          datasets: [
            { label: 'Critical', data: [1, 1, 1, 0, 0], backgroundColor: C.bad, borderRadius: 3, barThickness: 11 },
            { label: 'Major',    data: [2, 2, 2, 1, 1], backgroundColor: C.warn, borderRadius: 3, barThickness: 11 },
            { label: 'Minor',    data: [1, 1, 0, 1, 1], backgroundColor: C.neutral, borderRadius: 3, barThickness: 11 },
          ],
        },
        options: {
          plugins: {
            tooltip: tooltipStyle,
            legend: {
              display: true, position: 'bottom',
              labels: {
                boxWidth: 9, boxHeight: 9, usePointStyle: true,
                pointStyle: 'rectRounded', padding: 12, color: C.ink2, font: { size: 10.5 },
              },
            },
          },
          scales: {
            x: { ...gridX, ticks: { font: { size: 10 } } },
            y: { ...gridY, beginAtZero: true, ticks: { stepSize: 1 } },
          },
        },
      }),
    );

    charts.push(
      new Chart(riskRef.current, {
        type: 'bubble',
        data: {
          datasets: [
            { label: 'Low',    data: [{ x: 2, y: 2, r: 16 }], backgroundColor: 'rgba(21,163,74,.5)',  borderColor: C.good, borderWidth: 1.5 },
            { label: 'Medium', data: [{ x: 2, y: 3, r: 13 }, { x: 3, y: 2, r: 13 }, { x: 3, y: 3, r: 11 }], backgroundColor: 'rgba(224,138,30,.45)', borderColor: C.warn, borderWidth: 1.5 },
            { label: 'High',   data: [{ x: 3, y: 4, r: 12 }, { x: 4, y: 3, r: 11 }, { x: 4, y: 4, r: 11 }, { x: 5, y: 3, r: 9 }], backgroundColor: 'rgba(214,52,44,.42)', borderColor: C.bad, borderWidth: 1.5 },
          ],
        },
        options: {
          plugins: {
            tooltip: {
              ...tooltipStyle,
              callbacks: {
                label: (c) => {
                  const raw = c.raw as { x: number; y: number };
                  return `L${raw.x} × I${raw.y}`;
                },
              },
            },
          },
          scales: {
            x: { ...gridY, min: 0, max: 6, title: { display: true, text: 'Likelihood', color: C.ink3, font: { size: 10 } }, ticks: { stepSize: 1 } },
            y: { ...gridY, min: 0, max: 6, title: { display: true, text: 'Impact', color: C.ink3, font: { size: 10 } }, ticks: { stepSize: 1 } },
          },
        },
      }),
    );

    charts.push(
      new Chart(supRef.current, {
        type: 'radar',
        data: {
          labels: ['Quality', 'Delivery', 'Cost', 'Responsive', 'Innovation', 'Compliance'],
          datasets: [
            {
              data: [92, 78, 70, 85, 65, 90],
              borderColor: C.brand, borderWidth: 2,
              backgroundColor: 'rgba(216,162,58,.18)',
              pointBackgroundColor: C.brand, pointRadius: 3,
            },
          ],
        },
        options: {
          plugins: { tooltip: tooltipStyle },
          scales: {
            r: {
              min: 0, max: 100,
              grid: { color: C.line2 },
              angleLines: { color: C.line2 },
              pointLabels: { color: C.ink2, font: { size: 10.5, weight: 500 } },
              ticks: { display: false, stepSize: 25 },
            },
          },
        },
      }),
    );

    return () => charts.forEach((c) => { try { c.destroy(); } catch { /* */ } });
  }, []);

  return (
    <>
      <SectionHead title="Audits & Risk" tag="Supplier & internal findings" />
      <div className="grid g3">
        <div className="card d1">
          <div className="card-h">
            <div>
              <h3>Audit Findings by Department</h3>
              <div className="sub">Critical / Major / Minor</div>
            </div>
          </div>
          <div className="chart-box h-md"><canvas ref={findRef} /></div>
        </div>

        <div className="card d2">
          <div className="card-h">
            <div>
              <h3>Risk Matrix</h3>
              <div className="sub">Likelihood × Impact (bubble = exposure)</div>
            </div>
          </div>
          <div className="chart-box h-md"><canvas ref={riskRef} /></div>
        </div>

        <div className="card d3">
          <div className="card-h">
            <div>
              <h3>Supplier Performance</h3>
              <div className="sub">Top supplier scorecard</div>
            </div>
          </div>
          <div className="chart-box h-md"><canvas ref={supRef} /></div>
        </div>
      </div>
    </>
  );
}
