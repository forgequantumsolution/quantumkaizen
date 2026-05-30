import { useEffect, useRef } from 'react';
import { Chart, type Plugin, type ScriptableContext } from 'chart.js';
import SectionHead from './SectionHead';
import { C, gridX, gridY, gradient, tooltipStyle } from '../chartTheme';

export default function InspectionCalibrationSection() {
  const passRef = useRef<HTMLCanvasElement>(null);
  const resRef = useRef<HTMLCanvasElement>(null);
  const calRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!passRef.current || !resRef.current || !calRef.current) return;
    [passRef, resRef, calRef].forEach((r) => {
      if (r.current) Chart.getChart(r.current)?.destroy();
    });
    const charts: Chart[] = [];

    const pTarget: Plugin<'line'> = {
      id: 'pt',
      afterDraw(c) {
        const y = c.scales.y.getPixelForValue(95);
        const a = c.chartArea;
        const ctx = c.ctx;
        ctx.save();
        ctx.strokeStyle = C.brand;
        ctx.setLineDash([5, 4]);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(a.left, y);
        ctx.lineTo(a.right, y);
        ctx.stroke();
        ctx.restore();
      },
    };

    charts.push(
      new Chart(passRef.current, {
        type: 'line',
        data: {
          labels: ['Oct-24', 'Nov-24', 'Dec-24'],
          datasets: [
            {
              data: [97, 94, 96],
              borderColor: C.good, borderWidth: 2.5, tension: 0.4,
              pointRadius: 4, pointBackgroundColor: '#fff', pointBorderColor: C.good, pointBorderWidth: 2,
              fill: true,
              backgroundColor: (ctx: ScriptableContext<'line'>) =>
                gradient(ctx.chart.ctx, 240, 'rgba(21,163,74,.16)', 'rgba(21,163,74,0)'),
            },
          ],
        },
        options: {
          plugins: { tooltip: tooltipStyle },
          scales: {
            x: gridX,
            y: { ...gridY, min: 88, max: 100, ticks: { callback: (v) => v + '%' } },
          },
        },
        plugins: [pTarget],
      }),
    );

    charts.push(
      new Chart<'doughnut'>(resRef.current, {
        type: 'doughnut',
        data: {
          labels: ['Pass', 'Fail', 'Conditional', 'Pending'],
          datasets: [
            {
              data: [82, 6, 9, 3],
              backgroundColor: [C.good, C.bad, C.warn, C.neutral],
              borderWidth: 3, borderColor: '#fff', hoverOffset: 6,
            },
          ],
        },
        options: {
          cutout: '64%',
          plugins: {
            tooltip: tooltipStyle,
            legend: {
              display: true, position: 'bottom',
              labels: {
                boxWidth: 8, boxHeight: 8, usePointStyle: true,
                pointStyle: 'circle', padding: 12, color: C.ink2, font: { size: 11 },
              },
            },
          },
        },
      }),
    );

    charts.push(
      new Chart<'doughnut'>(calRef.current, {
        type: 'doughnut',
        data: {
          labels: ['Current', 'Due Soon', 'Overdue', 'Out of Service'],
          datasets: [
            {
              data: [68, 15, 11, 6],
              backgroundColor: [C.good, C.warn, C.bad, C.neutral],
              borderWidth: 3, borderColor: '#fff', hoverOffset: 6,
            },
          ],
        },
        options: {
          cutout: '64%',
          plugins: {
            tooltip: tooltipStyle,
            legend: {
              display: true, position: 'bottom',
              labels: {
                boxWidth: 8, boxHeight: 8, usePointStyle: true,
                pointStyle: 'circle', padding: 12, color: C.ink2, font: { size: 11 },
              },
            },
          },
        },
      }),
    );

    return () => charts.forEach((c) => { try { c.destroy(); } catch { /* */ } });
  }, []);

  return (
    <>
      <SectionHead title="Inspection & Calibration" tag="Target 95% pass" />
      <div className="grid g3">
        <div className="card d1">
          <div className="card-h">
            <div>
              <h3>Inspection Pass Rate</h3>
              <div className="sub">vs 95% target</div>
            </div>
          </div>
          <div className="chart-box h-md"><canvas ref={passRef} /></div>
        </div>

        <div className="card d2">
          <div className="card-h">
            <div>
              <h3>Inspection Results</h3>
              <div className="sub">This period</div>
            </div>
          </div>
          <div className="chart-box h-md"><canvas ref={resRef} /></div>
        </div>

        <div className="card d3">
          <div className="card-h">
            <div>
              <h3>Calibration Status</h3>
              <div className="sub">Instrument fleet</div>
            </div>
          </div>
          <div className="chart-box h-md"><canvas ref={calRef} /></div>
        </div>
      </div>
    </>
  );
}
