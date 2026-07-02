import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Search, X, TestTube, RefreshCw, FileText, Ticket, AlertTriangle, Award,
  type LucideIcon,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

// Cross-module search hits from GET /api/search?q= (FQS-QK-UIUX-003 §4).
interface SearchHit {
  type: 'Sample' | 'CAPA' | 'Document' | 'Ticket' | 'OOS' | 'CoA';
  id: string;
  title: string;
  subtitle: string;
  path: string;
}

const TYPE_ICON: Record<SearchHit['type'], LucideIcon> = {
  Sample: TestTube,
  CAPA: RefreshCw,
  Document: FileText,
  Ticket: Ticket,
  OOS: AlertTriangle,
  CoA: Award,
};

const TYPE_COLORS: Record<SearchHit['type'], string> = {
  Sample: 'bg-blue-50 text-blue-600',
  CAPA: 'bg-amber-50 text-amber-700',
  Document: 'bg-gray-100 text-gray-600',
  Ticket: 'bg-indigo-50 text-indigo-600',
  OOS: 'bg-red-50 text-red-600',
  CoA: 'bg-emerald-50 text-emerald-700',
};

interface GlobalSearchProps {
  onClose: () => void;
}

export default function GlobalSearch({ onClose }: GlobalSearchProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Debounce typing before hitting the API.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query.trim()), 200);
    return () => clearTimeout(t);
  }, [query]);

  const { data, isFetching } = useQuery({
    queryKey: ['global-search', debouncedQ],
    queryFn: async () =>
      (await api.get('/search', { params: { q: debouncedQ } })).data.results as SearchHit[],
    enabled: debouncedQ.length >= 2,
    staleTime: 30_000,
  });

  const results = debouncedQ.length >= 2 ? data ?? [] : [];

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

  const tooShort = debouncedQ.length < 2;

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
            placeholder="Search samples, CAPAs, documents, tickets, OOS, CoAs…"
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
          {tooShort ? (
            <div className="py-8 text-center">
              <p className="text-sm text-gray-400">Type at least 2 characters to search records</p>
            </div>
          ) : isFetching && results.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-gray-400">Searching…</p>
            </div>
          ) : results.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-gray-400">No results for "{debouncedQ}"</p>
            </div>
          ) : (
            results.map((item, idx) => {
              const Icon = TYPE_ICON[item.type];
              return (
                <button
                  key={`${item.type}-${item.id}`}
                  data-idx={idx}
                  onClick={() => handleSelect(item.path)}
                  onMouseEnter={() => setSelectedIdx(idx)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors duration-100',
                    idx === selectedIdx ? 'bg-slate-900/5' : 'hover:bg-gray-50'
                  )}
                >
                  <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', TYPE_COLORS[item.type])}>
                    <Icon size={13} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate font-mono">{item.title}</p>
                    <p className="text-xs text-gray-400 truncate">{item.subtitle}</p>
                  </div>
                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0', TYPE_COLORS[item.type])}>
                    {item.type}
                  </span>
                  {idx === selectedIdx && (
                    <kbd className="text-[10px] text-gray-300 font-mono border border-gray-200 rounded px-1.5 py-0.5">↵</kbd>
                  )}
                </button>
              );
            })
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
