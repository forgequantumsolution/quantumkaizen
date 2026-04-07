import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, FileText, AlertTriangle, CheckCircle2, Shield, ClipboardCheck, Activity, Scale, Truck, GitBranch, MessageSquareWarning, GraduationCap, BarChart3, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// Mock search index — in production this would call GET /api/search?q=...
const SEARCH_INDEX = [
  // Documents
  { id: 'DOC-001', type: 'Document', title: 'Quality Manual v3.2', subtitle: 'ISO 9001:2015 · Approved', path: '/dms/documents/DOC-001', icon: FileText },
  { id: 'DOC-002', type: 'Document', title: 'Production SOP-047', subtitle: 'Controlled · Rev 4', path: '/dms/documents/DOC-002', icon: FileText },
  // Non-Conformances
  { id: 'NC-001', type: 'Non-Conformance', title: 'Surface defect — Batch #2234', subtitle: 'Open · Major · Production', path: '/qms/non-conformances/NC-001', icon: AlertTriangle },
  { id: 'NC-002', type: 'Non-Conformance', title: 'Incorrect torque specification', subtitle: 'In Review · Minor', path: '/qms/non-conformances/NC-002', icon: AlertTriangle },
  // CAPAs
  { id: 'CAPA-001', type: 'CAPA', title: 'Root cause — weld defect recurrence', subtitle: 'In Progress · High Priority', path: '/qms/capa/CAPA-001', icon: CheckCircle2 },
  { id: 'CAPA-002', type: 'CAPA', title: 'Supplier incoming inspection gap', subtitle: 'Open · Medium', path: '/qms/capa/CAPA-002', icon: CheckCircle2 },
  // Risks
  { id: 'RISK-001', type: 'Risk', title: 'Single-source supplier dependency', subtitle: 'High · Unmitigated', path: '/qms/risks/RISK-001', icon: Shield },
  // Audits
  { id: 'AUD-001', type: 'Audit', title: 'ISO 9001 Internal Audit — Production', subtitle: 'Completed · Mar 2026', path: '/qms/audits/AUD-001', icon: ClipboardCheck },
  // FMEA
  { id: 'FMEA-001', type: 'FMEA', title: 'Welding Process FMEA v2', subtitle: 'AIAG-VDA · 12 failure modes', path: '/qms/fmea/FMEA-001', icon: Activity },
  // Compliance
  { id: 'COMP-001', type: 'Compliance', title: 'ISO 9001 Compliance Register', subtitle: '87% compliant', path: '/qms/compliance', icon: Scale },
  // Suppliers
  { id: 'SUP-001', type: 'Supplier', title: 'Acme Components Pvt Ltd', subtitle: 'Approved · Score 92', path: '/qms/suppliers/SUP-001', icon: Truck },
  // Change Control
  { id: 'CC-001', type: 'Change Request', title: 'Update welding parameter limits', subtitle: 'Under Review', path: '/qms/change-control/CC-001', icon: GitBranch },
  // Complaints
  { id: 'CMP-001', type: 'Complaint', title: 'Customer complaint — Part #A4422', subtitle: 'Open · High', path: '/qms/complaints/CMP-001', icon: MessageSquareWarning },
  // Training
  { id: 'TRN-001', type: 'Training', title: 'IATF 16949 Awareness Program', subtitle: '24 enrolled · 89% complete', path: '/lms/training/TRN-001', icon: GraduationCap },
  // Pages
  { id: 'PAGE-dashboard', type: 'Page', title: 'Dashboard', subtitle: 'Main overview', path: '/dashboard', icon: BarChart3 },
  { id: 'PAGE-audit-log', type: 'Page', title: 'Audit Log', subtitle: 'System activity trail', path: '/audit-log', icon: FileText },
];

const TYPE_COLORS: Record<string, string> = {
  Document: 'bg-blue-100 text-blue-700',
  'Non-Conformance': 'bg-red-100 text-red-700',
  CAPA: 'bg-amber-100 text-amber-700',
  Risk: 'bg-orange-100 text-orange-700',
  Audit: 'bg-purple-100 text-purple-700',
  FMEA: 'bg-indigo-100 text-indigo-700',
  Compliance: 'bg-green-100 text-green-700',
  Supplier: 'bg-teal-100 text-teal-700',
  'Change Request': 'bg-cyan-100 text-cyan-700',
  Complaint: 'bg-pink-100 text-pink-700',
  Training: 'bg-violet-100 text-violet-700',
  Page: 'bg-gray-100 text-gray-600',
};

interface GlobalSearchProps {
  onClose: () => void;
}

export default function GlobalSearch({ onClose }: GlobalSearchProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const results = query.trim().length < 1
    ? SEARCH_INDEX.slice(0, 8)
    : SEARCH_INDEX.filter(item =>
        item.title.toLowerCase().includes(query.toLowerCase()) ||
        item.type.toLowerCase().includes(query.toLowerCase()) ||
        item.subtitle.toLowerCase().includes(query.toLowerCase()) ||
        item.id.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 10);

  useEffect(() => {
    setSelectedIdx(0);
    inputRef.current?.focus();
  }, [query]);

  const handleSelect = useCallback((path: string) => {
    navigate(path);
    onClose();
  }, [navigate, onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIdx(i => Math.min(i + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIdx(i => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        if (results[selectedIdx]) handleSelect(results[selectedIdx].path);
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [results, selectedIdx, handleSelect, onClose]);

  // Scroll selected into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${selectedIdx}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIdx]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-xl mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100">
          <Search size={18} className="text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search records, documents, modules..."
            className="flex-1 text-sm text-gray-900 placeholder-gray-400 outline-none bg-transparent"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-gray-300 hover:text-gray-500 transition-colors">
              <X size={14} />
            </button>
          )}
          <kbd className="hidden sm:flex items-center gap-0.5 text-[10px] text-gray-300 font-mono border border-gray-200 rounded px-1.5 py-0.5">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="overflow-y-auto max-h-80 py-2">
          {results.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-gray-400">No results for "{query}"</p>
            </div>
          ) : (
            <>
              {!query && (
                <p className="px-4 py-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Recent & Suggested</p>
              )}
              {results.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    data-idx={idx}
                    onClick={() => handleSelect(item.path)}
                    onMouseEnter={() => setSelectedIdx(idx)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors duration-100',
                      idx === selectedIdx ? 'bg-slate-900/5' : 'hover:bg-gray-50'
                    )}
                  >
                    <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', TYPE_COLORS[item.type] ?? 'bg-gray-100 text-gray-500')}>
                      <Icon size={13} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                      <p className="text-xs text-gray-400 truncate">{item.subtitle}</p>
                    </div>
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0', TYPE_COLORS[item.type] ?? 'bg-gray-100 text-gray-500')}>
                      {item.type}
                    </span>
                    {idx === selectedIdx && (
                      <kbd className="text-[10px] text-gray-300 font-mono border border-gray-200 rounded px-1.5 py-0.5">↵</kbd>
                    )}
                  </button>
                );
              })}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-4 py-2 flex items-center gap-4 bg-gray-50">
          <span className="flex items-center gap-1 text-[10px] text-gray-400"><kbd className="font-mono border border-gray-200 bg-white rounded px-1">↑↓</kbd> navigate</span>
          <span className="flex items-center gap-1 text-[10px] text-gray-400"><kbd className="font-mono border border-gray-200 bg-white rounded px-1">↵</kbd> open</span>
          <span className="flex items-center gap-1 text-[10px] text-gray-400"><kbd className="font-mono border border-gray-200 bg-white rounded px-1">Esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
