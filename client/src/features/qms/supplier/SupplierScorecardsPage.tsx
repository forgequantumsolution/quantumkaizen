import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, Minus, RefreshCw, Trophy } from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { useFiscalYearStore, FISCAL_YEARS } from '@/stores/fiscalYearStore';

// ── Types ──────────────────────────────────────────────────────────────────

interface SupplierRanking {
  id: string;
  name: string;
  category: string;
  status: string;
  score: number;
  grade: 'A' | 'B' | 'C';
  passRate: number;
  capaClosureRate: number;
  auditScore: number;
  delta: number | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function gradeColor(grade: string) {
  if (grade === 'A') return { bg: '#DCFCE7', text: '#16A34A', border: '#86EFAC' };
  if (grade === 'B') return { bg: '#DBEAFE', text: '#2563EB', border: '#93C5FD' };
  return { bg: '#FEF3C7', text: '#D97706', border: '#FCD34D' };
}

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) return <span className="text-xxs text-gray-400">—</span>;
  if (delta > 0)
    return (
      <span className="flex items-center gap-0.5 text-green-600 text-xs font-semibold">
        <TrendingUp size={11} /> +{delta}
      </span>
    );
  if (delta < 0)
    return (
      <span className="flex items-center gap-0.5 text-red-500 text-xs font-semibold">
        <TrendingDown size={11} /> {delta}
      </span>
    );
  return <Minus size={11} className="text-gray-400" />;
}

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${value}%`, backgroundColor: color }} />
      </div>
      <span className="text-[11px] tabular-nums text-gray-600 w-8 text-right">{value}%</span>
    </div>
  );
}

const CATEGORY_OPTIONS = ['', 'CRITICAL', 'MAJOR', 'MINOR'];
const GRADE_OPTIONS = ['', 'A', 'B', 'C'];

// ── Page ──────────────────────────────────────────────────────────────────

export default function SupplierScorecardsPage() {
  const { year, setYear } = useFiscalYearStore();
  const [categoryFilter, setCategoryFilter] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');

  const { data: rankings = [], isLoading, refetch, isFetching } = useQuery<SupplierRanking[]>({
    queryKey: ['supplier-rankings', year],
    queryFn: async () => {
      const res = await api.get(`/qms/suppliers/rankings/${year}`);
      return res.data.data;
    },
    staleTime: 2 * 60 * 1000,
  });

  const filtered = rankings.filter(r => {
    if (categoryFilter && r.category !== categoryFilter) return false;
    if (gradeFilter && r.grade !== gradeFilter) return false;
    return true;
  });

  // Summary counts
  const gradeA = rankings.filter(r => r.grade === 'A').length;
  const gradeB = rankings.filter(r => r.grade === 'B').length;
  const gradeC = rankings.filter(r => r.grade === 'C').length;
  const avgScore = rankings.length > 0
    ? Math.round(rankings.reduce((s, r) => s + r.score, 0) / rankings.length)
    : 0;

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 text-gray-900">Supplier Scorecards</h1>
          <p className="text-body text-gray-500 mt-0.5">
            Composite ranking — Pass Rate 50% · CAPA Closure 30% · Audit Score 20%
          </p>
        </div>
        <div className="flex items-center gap-3">
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
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 px-3 h-8 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} className={cn(isFetching && 'animate-spin')} />
            Recalculate
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Avg Score', value: `${avgScore}`, sub: 'Composite', accent: '#C9A84C' },
          { label: 'Grade A', value: gradeA, sub: '≥85 points', accent: '#16A34A' },
          { label: 'Grade B', value: gradeB, sub: '70–84 points', accent: '#2563EB' },
          { label: 'Grade C', value: gradeC, sub: '<70 points', accent: '#D97706' },
        ].map(card => (
          <div
            key={card.label}
            className="bg-white rounded-xl p-4"
            style={{ borderTop: `3px solid ${card.accent}`, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{card.label}</p>
            <p className="text-3xl font-bold mt-1" style={{ color: '#1A1A2E' }}>{card.value}</p>
            <p className="text-[11px] text-gray-400 mt-1">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="input-base w-36"
        >
          <option value="">All Categories</option>
          {CATEGORY_OPTIONS.filter(Boolean).map(c => (
            <option key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</option>
          ))}
        </select>
        <select
          value={gradeFilter}
          onChange={e => setGradeFilter(e.target.value)}
          className="input-base w-32"
        >
          <option value="">All Grades</option>
          {GRADE_OPTIONS.filter(Boolean).map(g => (
            <option key={g} value={g}>Grade {g}</option>
          ))}
        </select>
        <span className="ml-auto text-xs text-gray-400">{filtered.length} suppliers</span>
      </div>

      {/* Rankings list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-800 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <Trophy size={28} className="mb-2 opacity-30" />
            <p className="text-sm">No suppliers found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {/* Table header */}
            <div className="grid grid-cols-[40px_1fr_80px_80px_1fr_1fr_1fr_60px] gap-4 px-5 py-2.5 bg-gray-50">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">#</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Supplier</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Grade</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 text-right">Score</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Pass Rate</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">CAPA Closure</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Audit Score</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 text-right">YoY</span>
            </div>

            {/* Rows */}
            {filtered.map((r, idx) => {
              const gc = gradeColor(r.grade);
              const passColor = r.passRate >= 85 ? '#16A34A' : r.passRate >= 70 ? '#D97706' : '#DC2626';
              const capaColor = r.capaClosureRate >= 85 ? '#16A34A' : r.capaClosureRate >= 70 ? '#D97706' : '#DC2626';
              const auditColor = r.auditScore >= 85 ? '#16A34A' : r.auditScore >= 70 ? '#D97706' : '#DC2626';

              return (
                <div
                  key={r.id}
                  className="grid grid-cols-[40px_1fr_80px_80px_1fr_1fr_1fr_60px] gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors items-center"
                >
                  {/* Rank */}
                  <span className="text-sm font-bold tabular-nums text-gray-400">
                    {idx + 1}
                  </span>

                  {/* Name + category */}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{r.name}</p>
                    <span className="text-[10px] text-gray-400 uppercase tracking-wider">{r.category}</span>
                  </div>

                  {/* Grade circle */}
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center font-extrabold text-base border-2"
                    style={{ backgroundColor: gc.bg, color: gc.text, borderColor: gc.border }}
                  >
                    {r.grade}
                  </div>

                  {/* Composite score */}
                  <div className="text-right">
                    <span className="text-lg font-bold tabular-nums" style={{ color: '#1A1A2E' }}>
                      {r.score}
                    </span>
                  </div>

                  {/* Pass rate bar */}
                  <ScoreBar value={r.passRate} color={passColor} />

                  {/* CAPA closure bar */}
                  <ScoreBar value={r.capaClosureRate} color={capaColor} />

                  {/* Audit score bar */}
                  <ScoreBar value={r.auditScore} color={auditColor} />

                  {/* YoY delta */}
                  <div className="flex justify-end">
                    <DeltaBadge delta={r.delta} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
