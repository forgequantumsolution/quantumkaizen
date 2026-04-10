import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui';
import { HeatmapGrid } from '@/components/charts/HeatmapGrid';
import { useFiscalYearStore, FISCAL_YEARS } from '@/stores/fiscalYearStore';
import {
  useNCTrends,
  useHeatmap,
  useKpiComparison,
  useAuditVolume,
} from './hooks';

// ── Design tokens (match DashboardPage) ──────────────────────────────────────
const TT_STYLE = {
  borderRadius: '8px',
  border: '1px solid #E8ECF2',
  fontSize: '11px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  padding: '6px 10px',
  backgroundColor: '#fff',
};

// 3-year colour progression — subtle → vivid
const YEAR_COLORS: Record<number, string> = {
  2024: '#94A3B8',
  2025: '#60A5FA',
  2026: '#2563EB',
};

function Delta({ current, prev }: { current: number; prev: number }) {
  const diff = current - prev;
  if (diff > 0)
    return (
      <span className="flex items-center gap-0.5 text-red-600 text-xs font-semibold">
        <TrendingUp size={11} /> +{diff}
      </span>
    );
  if (diff < 0)
    return (
      <span className="flex items-center gap-0.5 text-green-600 text-xs font-semibold">
        <TrendingDown size={11} /> {diff}
      </span>
    );
  return <Minus size={11} className="text-gray-400" />;
}

export default function AnalyticsPage() {
  const { year, setYear } = useFiscalYearStore();

  const { data: ncTrends = [] }      = useNCTrends();
  const { data: heatmap = [] }       = useHeatmap();
  const { data: kpiTable = [] }      = useKpiComparison();
  const { data: auditVolume = [] }   = useAuditVolume();

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 text-gray-900">Analytics</h1>
          <p className="text-body text-gray-500 mt-0.5">Multi-year quality trends and cross-module comparisons</p>
        </div>

        {/* FY selector */}
        <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
          {FISCAL_YEARS.map(y => (
            <button
              key={y}
              onClick={() => setYear(y)}
              className="px-3 h-8 text-xs font-medium transition-colors border-r last:border-r-0"
              style={
                year === y
                  ? { backgroundColor: '#1A1A2E', color: '#C9A84C' }
                  : { backgroundColor: '#fff', color: '#6B7280' }
              }
            >
              FY {y}
            </button>
          ))}
        </div>
      </div>

      {/* ── 3-Year NC Trend Overlay ── */}
      <Card>
        <CardHeader>
          <CardTitle>NC Trend — 3-Year Overlay</CardTitle>
          <div className="flex items-center gap-3 ml-auto">
            {FISCAL_YEARS.map(y => (
              <div key={y} className="flex items-center gap-1.5">
                <span className="w-3 h-[2px] rounded-full inline-block" style={{ backgroundColor: YEAR_COLORS[y] }} />
                <span className="text-[11px] text-gray-500">FY {y}</span>
              </div>
            ))}
          </div>
        </CardHeader>
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={ncTrends} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="#E8ECF2" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#718096' }}
                axisLine={{ stroke: '#E8ECF2' }} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#718096' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TT_STYLE} />
              {FISCAL_YEARS.map(y => (
                <Line
                  key={y}
                  type="monotone"
                  dataKey={y}
                  name={`FY ${y}`}
                  stroke={YEAR_COLORS[y]}
                  strokeWidth={y === year ? 2 : 1.5}
                  dot={{ r: 2.5, fill: YEAR_COLORS[y], strokeWidth: 0 }}
                  activeDot={{ r: 4, stroke: YEAR_COLORS[y], strokeWidth: 1, fill: '#fff' }}
                  opacity={y === year ? 1 : 0.55}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* ── Audit Volume 3-Year Comparison ── */}
      <Card>
        <CardHeader>
          <CardTitle>Audit Volume — 3-Year Comparison</CardTitle>
        </CardHeader>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={auditVolume} barSize={10} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="#E8ECF2" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#718096' }}
                axisLine={{ stroke: '#E8ECF2' }} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#718096' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TT_STYLE} />
              <Legend iconType="circle" iconSize={7}
                wrapperStyle={{ fontSize: '10px', color: '#718096' }} />
              {FISCAL_YEARS.map(y => (
                <Bar
                  key={y}
                  dataKey={y}
                  name={`FY ${y}`}
                  fill={YEAR_COLORS[y]}
                  radius={[2, 2, 0, 0]}
                  opacity={y === year ? 1 : 0.5}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* ── Heatmap + KPI Table (side-by-side on lg) ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">

        {/* Heatmap — last 49 days of NC activity */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>NC Activity Heatmap</CardTitle>
            <span className="text-xxs text-gray-400 ml-auto">Last 49 days</span>
          </CardHeader>
          <HeatmapGrid data={heatmap} days={49} />
        </Card>

        {/* KPI Comparison table */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>KPI Year-on-Year Comparison</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 pr-4 font-semibold text-gray-500">Metric</th>
                  {FISCAL_YEARS.map(y => (
                    <th
                      key={y}
                      className="text-right py-2 px-3 font-semibold"
                      style={{ color: YEAR_COLORS[y] }}
                    >
                      FY {y}
                    </th>
                  ))}
                  <th className="text-right py-2 pl-3 font-semibold text-gray-500">YoY</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {kpiTable.map(row => (
                  <tr key={row.metric} className="hover:bg-gray-50 transition-colors">
                    <td className="py-2.5 pr-4 text-gray-700 font-medium">{row.metric}</td>
                    {FISCAL_YEARS.map(y => (
                      <td key={y} className="text-right py-2.5 px-3 tabular-nums text-gray-900">
                        {row[y]}
                      </td>
                    ))}
                    <td className="text-right py-2.5 pl-3">
                      <Delta current={row[2026]} prev={row[2025]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
