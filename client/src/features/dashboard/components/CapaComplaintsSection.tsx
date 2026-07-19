import { useEffect, useRef } from 'react';
import { Chart, type ScriptableContext } from 'chart.js';
import SectionHead from './SectionHead';
import { C, gridX, gridY, gradient, tooltipStyle } from '../chartTheme';
import { useDashboard } from '../context';

export default function CapaComplaintsSection() {
  const { data, has } = useDashboard();
  const capa = data?.panels.capa;
  const complaints = data?.panels.complaints;
  const showCapa = has('capa');
  const showComplaints = has('complaints');

  const stageRef = useRef<HTMLCanvasElement>(null);
  const ageRef = useRef<HTMLCanvasElement>(null);
  const cmpRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const charts: Chart[] = [];
    [stageRef, ageRef, cmpRef].forEach((r) => { if (r.current) Chart.getChart(r.current)?.destroy(); });

    if (showCapa && capa && stageRef.current) {
      charts.push(new Chart(stageRef.current, {
        type: 'bar',
        data: {
          labels: capa.byStage.map((s) => s.stage),
          datasets: [{
            data: capa.byStage.map((s) => s.count), borderRadius: 5, barThickness: 20,
            backgroundColor: capa.byStage.map((s) => s.stage === 'Closed' ? C.good : s.stage === 'Implementation' ? C.warn : '#e3b85a'),
          }],
        },
        options: { indexAxis: 'y', plugins: { tooltip: tooltipStyle }, scales: { x: { ...gridY, beginAtZero: true }, y: { ...gridX, ticks: { color: C.ink2, font: { size: 11.5 } } } } },
      }));
    }

    if (showCapa && capa && ageRef.current) {
      charts.push(new Chart(ageRef.current, {
        type: 'bar',
        data: {
          labels: capa.aging.map((a) => a.bucket),
          datasets: [{
            data: capa.aging.map((a) => a.count), borderRadius: 5, barThickness: 44,
            backgroundColor: [C.good, C.brand2, C.warn, C.bad],
          }],
        },
        options: { plugins: { tooltip: tooltipStyle }, scales: { x: gridX, y: { ...gridY, beginAtZero: true } } },
      }));
    }

    if (showComplaints && complaints && cmpRef.current) {
      charts.push(new Chart(cmpRef.current, {
        type: 'line',
        data: {
          labels: complaints.trend.map((t) => t.month),
          datasets: [
            { label: 'Received', data: complaints.trend.map((t) => t.received), borderColor: C.bad, borderWidth: 2.5, tension: 0.4, pointRadius: 4, pointBackgroundColor: '#fff', pointBorderColor: C.bad, pointBorderWidth: 2, fill: false },
            { label: 'Resolved', data: complaints.trend.map((t) => t.resolved), borderColor: C.good, borderWidth: 2.5, tension: 0.4, pointRadius: 4, pointBackgroundColor: '#fff', pointBorderColor: C.good, pointBorderWidth: 2, fill: true,
              backgroundColor: (ctx: ScriptableContext<'line'>) => gradient(ctx.chart.ctx, 280, 'rgba(21,163,74,.14)', 'rgba(21,163,74,0)') },
          ],
        },
        options: {
          plugins: { tooltip: tooltipStyle, legend: { display: true, position: 'bottom', labels: { boxWidth: 8, boxHeight: 8, usePointStyle: true, pointStyle: 'circle', padding: 16, color: C.ink2, font: { size: 11.5 } } } },
          scales: { x: gridX, y: { ...gridY, beginAtZero: true } },
        },
      }));
    }

    return () => charts.forEach((c) => { try { c.destroy(); } catch { /* */ } });
  }, [capa, complaints, showCapa, showComplaints]);

  const openCapa = data?.panels.snapshot.cards.find((c) => c.key === 'openCAPAs')?.value ?? 0;

  return (
    <>
      <SectionHead title="CAPA & Complaints" tag={`${openCapa} CAPA in progress · ${capa?.onTimeClosureRate ?? 0}% on-time`} />
      <div className={`grid ${showCapa && showComplaints ? 'g3' : 'g2'}`}>
        {showCapa && (
          <div className="card d1">
            <div className="card-h"><div><h3>CAPA by Stage</h3><div className="sub">Workflow pipeline distribution</div></div></div>
            <div className="chart-box h-lg"><canvas ref={stageRef} /></div>
          </div>
        )}
        {showCapa && (
          <div className="card d2">
            <div className="card-h"><div><h3>CAPA Aging</h3><div className="sub">Open CAPAs by age bucket</div></div></div>
            <div className="chart-box h-lg"><canvas ref={ageRef} /></div>
          </div>
        )}
        {showComplaints && (
          <div className="card d3">
            <div className="card-h"><div><h3>Complaints — Received vs Resolved</h3><div className="sub">Resolution gap over time</div></div><span className="chip good">net positive</span></div>
            <div className="chart-box h-lg"><canvas ref={cmpRef} /></div>
          </div>
        )}
      </div>
    </>
  );
}
