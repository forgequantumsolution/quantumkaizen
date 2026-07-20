import { useEffect, useRef } from 'react';
import { Chart, type Plugin, type ScriptableContext } from 'chart.js';
import SectionHead from './SectionHead';
import { C, gridX, gridY, tooltipStyle } from '../chartTheme';
import { useDashboard } from '../context';

export default function DocumentsTrainingSection() {
  const { data, has } = useDashboard();
  const docs = data?.panels.documents;
  const training = data?.panels.training;
  const showDocs = has('documents');
  const showTraining = has('training');

  const docRef = useRef<HTMLCanvasElement>(null);
  const deptRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const charts: Chart[] = [];
    [docRef, deptRef].forEach((r) => { if (r.current) Chart.getChart(r.current)?.destroy(); });

    if (showDocs && docs && docRef.current) {
      charts.push(new Chart(docRef.current, {
        type: 'bar',
        data: {
          labels: docs.pipeline.map((d) => d.status),
          datasets: [{ data: docs.pipeline.map((d) => d.count), borderRadius: 6, barThickness: 46, backgroundColor: docs.pipeline.map((d) => d.fill) }],
        },
        options: { plugins: { tooltip: tooltipStyle }, scales: { x: { ...gridX, ticks: { color: C.ink2, font: { size: 10.5 } } }, y: { ...gridY, beginAtZero: true } } },
      }));
    }

    if (showTraining && training && deptRef.current) {
      const targetLine: Plugin<'bar'> = {
        id: 'tl',
        afterDraw(c) {
          const x = c.scales.x.getPixelForValue(90); const a = c.chartArea; const ctx = c.ctx;
          ctx.save(); ctx.strokeStyle = C.brand; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(x, a.top); ctx.lineTo(x, a.bottom); ctx.stroke();
          ctx.fillStyle = C.brand; ctx.font = "600 10px 'IBM Plex Mono'"; ctx.fillText('90%', x + 4, a.top + 10); ctx.restore();
        },
      };
      charts.push(new Chart(deptRef.current, {
        type: 'bar',
        data: {
          labels: training.byDept.map((t) => t.dept),
          datasets: [{
            data: training.byDept.map((t) => t.compliance), borderRadius: 5, barThickness: 22,
            backgroundColor: (ctx: ScriptableContext<'bar'>) => ((ctx.raw as number) >= 90 ? C.good : C.warn),
          }],
        },
        options: {
          indexAxis: 'y', plugins: { tooltip: tooltipStyle },
          scales: { x: { ...gridY, beginAtZero: true, max: 100, ticks: { callback: (v) => v + '%' } }, y: { ...gridX, ticks: { color: C.ink2, font: { size: 11.5 } } } },
        },
        plugins: [targetLine],
      }));
    }

    return () => charts.forEach((c) => { try { c.destroy(); } catch { /* */ } });
  }, [docs, training, showDocs, showTraining]);

  const belowTarget = training?.byDept.filter((t) => t.compliance < 90).length ?? 0;

  return (
    <>
      <SectionHead title="Documents & Training" tag={`${training?.overall ?? 0}% overall training`} />
      <div className="grid g2">
        {showDocs && (
          <div className="card d1">
            <div className="card-h"><div><h3>Document Status Pipeline</h3><div className="sub">Controlled documents by lifecycle state</div></div></div>
            <div className="chart-box h-lg"><canvas ref={docRef} /></div>
          </div>
        )}
        {showTraining && (
          <div className="card d2">
            <div className="card-h">
              <div><h3>Training Compliance by Department</h3><div className="sub">vs 90% target line</div></div>
              {belowTarget > 0 && <span className="chip warn">{belowTarget} below target</span>}
            </div>
            <div className="chart-box h-lg"><canvas ref={deptRef} /></div>
          </div>
        )}
      </div>
    </>
  );
}
