import { useEffect, useRef } from 'react';
import { Chart } from 'chart.js';
import SectionHead from './SectionHead';
import { C, tooltipStyle } from '../chartTheme';
import { useDashboard } from '../context';

export default function InspectionCalibrationSection() {
  const { data, has } = useDashboard();
  const inspection = data?.panels.inspection;
  const calibration = data?.panels.calibration;
  const showInsp = has('inspection');
  const showCal = has('calibration');

  const gaugeRef = useRef<HTMLCanvasElement>(null);
  const resRef = useRef<HTMLCanvasElement>(null);
  const calRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const charts: Chart[] = [];
    [gaugeRef, resRef, calRef].forEach((r) => { if (r.current) Chart.getChart(r.current)?.destroy(); });

    if (showInsp && inspection && gaugeRef.current) {
      const rate = inspection.passRate;
      charts.push(new Chart<'doughnut'>(gaugeRef.current, {
        type: 'doughnut',
        data: {
          labels: ['Pass', 'Remaining'],
          datasets: [{ data: [rate, Math.max(0, 100 - rate)], backgroundColor: [rate >= 95 ? C.good : rate >= 90 ? C.warn : C.bad, '#eef1f5'], borderWidth: 0, circumference: 180, rotation: 270 }],
        },
        options: { cutout: '72%', plugins: { tooltip: { enabled: false } } },
      }));
    }

    if (showInsp && inspection && resRef.current) {
      const palette: Record<string, string> = { Pass: C.good, Fail: C.bad, Conditional: C.warn, Pending: C.neutral };
      charts.push(new Chart<'doughnut'>(resRef.current, {
        type: 'doughnut',
        data: {
          labels: inspection.byResult.map((r) => r.result),
          datasets: [{ data: inspection.byResult.map((r) => r.count), backgroundColor: inspection.byResult.map((r) => palette[r.result] ?? C.neutral), borderWidth: 3, borderColor: '#fff', hoverOffset: 6 }],
        },
        options: { cutout: '64%', plugins: { tooltip: tooltipStyle, legend: { display: true, position: 'bottom', labels: { boxWidth: 8, boxHeight: 8, usePointStyle: true, pointStyle: 'circle', padding: 12, color: C.ink2, font: { size: 11 } } } } },
      }));
    }

    if (showCal && calibration && calRef.current) {
      charts.push(new Chart<'doughnut'>(calRef.current, {
        type: 'doughnut',
        data: {
          labels: calibration.status.map((s) => s.status),
          datasets: [{ data: calibration.status.map((s) => s.count), backgroundColor: calibration.status.map((s) => s.fill), borderWidth: 3, borderColor: '#fff', hoverOffset: 6 }],
        },
        options: { cutout: '64%', plugins: { tooltip: tooltipStyle, legend: { display: true, position: 'bottom', labels: { boxWidth: 8, boxHeight: 8, usePointStyle: true, pointStyle: 'circle', padding: 12, color: C.ink2, font: { size: 11 } } } } },
      }));
    }

    return () => charts.forEach((c) => { try { c.destroy(); } catch { /* */ } });
  }, [inspection, calibration, showInsp, showCal]);

  return (
    <>
      <SectionHead title="Inspection & Calibration" tag={showInsp ? `${inspection?.passRate ?? 0}% first-pass` : 'Instrument fleet'} />
      <div className="grid g3">
        {showInsp && (
          <div className="card d1">
            <div className="card-h"><div><h3>First-Pass Rate</h3><div className="sub">Passing inspections</div></div></div>
            <div className="chart-box h-md" style={{ position: 'relative' }}>
              <canvas ref={gaugeRef} />
              <div className="gauge-val">{inspection?.passRate ?? 0}%</div>
            </div>
          </div>
        )}
        {showInsp && (
          <div className="card d2">
            <div className="card-h"><div><h3>Inspection Results</h3><div className="sub">This period</div></div></div>
            <div className="chart-box h-md"><canvas ref={resRef} /></div>
          </div>
        )}
        {showCal && (
          <div className="card d3">
            <div className="card-h"><div><h3>Calibration Status</h3><div className="sub">Instrument fleet</div></div></div>
            <div className="chart-box h-md"><canvas ref={calRef} /></div>
          </div>
        )}
      </div>
    </>
  );
}
