import { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';

export interface BarDatum {
  label: string;
  value: number;
  /** Optional per-bar colour. Falls back to the chart's base colour. */
  color?: string;
}

/** Tracks a container's live width so the SVG can redraw responsively. */
function useContainerWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? el.clientWidth;
      setWidth(w);
    });
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}

interface TooltipState {
  x: number;
  y: number;
  label: string;
  value: string;
}

interface Props {
  data: BarDatum[];
  /** Unique id — used to scope the SVG gradient defs so multiple charts don't collide. */
  id: string;
  height?: number;
  orientation?: 'vertical' | 'horizontal';
  /** Appended to the value in labels/tooltips, e.g. '%' or 'd'. */
  valueSuffix?: string;
  /** Base colour when a datum has no explicit colour. */
  baseColor?: string;
}

/**
 * Industry-style animated bar chart built directly on D3 (scales, axes,
 * transitions, hover). Fully responsive and driven by whatever dynamic data
 * is passed in — no hard-coded values.
 */
export default function D3BarChart({
  data,
  id,
  height = 260,
  orientation = 'vertical',
  valueSuffix = '',
  baseColor = '#6366f1',
}: Props) {
  const { ref, width } = useContainerWidth<HTMLDivElement>();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const gradId = `bargrad-${id}`;
  const fmt = useMemo(() => d3.format(valueSuffix === '%' ? '.1~f' : '~s'), [valueSuffix]);

  useEffect(() => {
    if (!svgRef.current || width <= 0 || data.length === 0) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const horizontal = orientation === 'horizontal';
    const maxLabel = horizontal
      ? Math.min(140, Math.max(...data.map((d) => d.label.length)) * 7 + 12)
      : 0;
    const margin = horizontal
      ? { top: 14, right: 40, bottom: 28, left: maxLabel }
      : { top: 22, right: 12, bottom: 34, left: 40 };
    const innerW = Math.max(0, width - margin.left - margin.right);
    const innerH = Math.max(0, height - margin.top - margin.bottom);

    // Gradient for bars that don't carry their own colour.
    const defs = svg.append('defs');
    const grad = defs
      .append('linearGradient')
      .attr('id', gradId)
      .attr('x1', '0').attr('y1', horizontal ? '0' : '0')
      .attr('x2', horizontal ? '1' : '0').attr('y2', horizontal ? '0' : '1');
    grad.append('stop').attr('offset', '0%').attr('stop-color', d3.color(baseColor)!.brighter(0.6).formatHex());
    grad.append('stop').attr('offset', '100%').attr('stop-color', baseColor);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    const maxV = d3.max(data, (d) => d.value) ?? 0;
    const domainMax = maxV > 0 ? maxV : 1;

    const fillOf = (d: BarDatum) => d.color ?? `url(#${gradId})`;
    const labelText = (v: number) =>
      `${valueSuffix === '%' ? v : fmt(v)}${valueSuffix}`;

    const showTip = (event: MouseEvent, d: BarDatum) => {
      const [mx, my] = d3.pointer(event, svgRef.current);
      setTooltip({ x: mx, y: my, label: d.label, value: labelText(d.value) });
    };
    const hideTip = () => setTooltip(null);

    if (horizontal) {
      const y = d3.scaleBand().domain(data.map((d) => d.label)).range([0, innerH]).padding(0.32);
      const x = d3.scaleLinear().domain([0, domainMax]).nice().range([0, innerW]);

      // vertical gridlines
      g.append('g')
        .attr('transform', `translate(0,${innerH})`)
        .call(d3.axisBottom(x).ticks(5).tickSize(-innerH).tickFormat(() => '') as never)
        .call((sel) => sel.select('.domain').remove())
        .selectAll('line').attr('stroke', '#f1f5f9');

      // y axis labels
      g.append('g')
        .call(d3.axisLeft(y).tickSize(0) as never)
        .call((sel) => sel.select('.domain').remove())
        .selectAll('text').attr('fill', '#475569').style('font-size', '12px');

      // x axis
      g.append('g')
        .attr('transform', `translate(0,${innerH})`)
        .call(d3.axisBottom(x).ticks(5).tickFormat((d) => fmt(d as number)) as never)
        .call((sel) => sel.select('.domain').remove())
        .selectAll('text').attr('fill', '#94a3b8').style('font-size', '11px');

      const bars = g.selectAll('rect.bar').data(data).enter().append('rect')
        .attr('class', 'bar')
        .attr('y', (d) => y(d.label)!)
        .attr('x', 0)
        .attr('height', y.bandwidth())
        .attr('rx', Math.min(6, y.bandwidth() / 2))
        .attr('fill', fillOf)
        .style('cursor', 'pointer')
        .on('mousemove', showTip)
        .on('mouseleave', hideTip);
      bars.transition().duration(750).ease(d3.easeCubicOut)
        .attr('width', (d) => x(d.value));

      g.selectAll('text.val').data(data).enter().append('text')
        .attr('class', 'val')
        .attr('y', (d) => y(d.label)! + y.bandwidth() / 2)
        .attr('x', 0)
        .attr('dy', '0.35em')
        .attr('dx', 6)
        .style('font-size', '11px').attr('fill', '#64748b')
        .text((d) => labelText(d.value))
        .transition().duration(750).ease(d3.easeCubicOut)
        .attr('x', (d) => x(d.value));
    } else {
      const x = d3.scaleBand().domain(data.map((d) => d.label)).range([0, innerW]).padding(0.34);
      const y = d3.scaleLinear().domain([0, domainMax]).nice().range([innerH, 0]);

      // horizontal gridlines
      g.append('g')
        .call(d3.axisLeft(y).ticks(5).tickSize(-innerW).tickFormat(() => '') as never)
        .call((sel) => sel.select('.domain').remove())
        .selectAll('line').attr('stroke', '#f1f5f9');

      // x axis
      g.append('g')
        .attr('transform', `translate(0,${innerH})`)
        .call(d3.axisBottom(x).tickSize(0) as never)
        .call((sel) => sel.select('.domain').remove())
        .selectAll('text').attr('fill', '#475569').style('font-size', '11px');

      // y axis
      g.append('g')
        .call(d3.axisLeft(y).ticks(5).tickFormat((d) => fmt(d as number)) as never)
        .call((sel) => sel.select('.domain').remove())
        .selectAll('text').attr('fill', '#94a3b8').style('font-size', '11px');

      const bars = g.selectAll('rect.bar').data(data).enter().append('rect')
        .attr('class', 'bar')
        .attr('x', (d) => x(d.label)!)
        .attr('width', x.bandwidth())
        .attr('y', innerH)
        .attr('height', 0)
        .attr('rx', Math.min(6, x.bandwidth() / 2))
        .attr('fill', fillOf)
        .style('cursor', 'pointer')
        .on('mousemove', showTip)
        .on('mouseleave', hideTip);
      bars.transition().duration(750).ease(d3.easeCubicOut)
        .attr('y', (d) => y(d.value))
        .attr('height', (d) => innerH - y(d.value));

      g.selectAll('text.val').data(data).enter().append('text')
        .attr('class', 'val')
        .attr('x', (d) => x(d.label)! + x.bandwidth() / 2)
        .attr('text-anchor', 'middle')
        .attr('y', innerH)
        .style('font-size', '11px').attr('fill', '#64748b')
        .text((d) => labelText(d.value))
        .transition().duration(750).ease(d3.easeCubicOut)
        .attr('y', (d) => y(d.value) - 6);
    }
  }, [data, width, height, orientation, valueSuffix, baseColor, gradId, fmt, id]);

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      <svg ref={svgRef} width={width} height={height} />
      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 shadow-lg"
          style={{
            left: Math.min(Math.max(tooltip.x + 12, 0), width - 120),
            top: Math.max(tooltip.y - 44, 0),
          }}
        >
          <div className="text-[11px] font-medium text-gray-500">{tooltip.label}</div>
          <div className="text-sm font-semibold text-gray-900">{tooltip.value}</div>
        </div>
      )}
    </div>
  );
}
