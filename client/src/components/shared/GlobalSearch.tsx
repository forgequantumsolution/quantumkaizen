import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ClipboardList, BarChart3, Network, Ticket, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// Static page index for the global search palette. Replace with a real API
// call once you have one (GET /api/search?q=...).
const SEARCH_INDEX = [
  { id: 'PAGE-dashboard', type: 'Page', title: 'Dashboard',  subtitle: 'Main overview',          path: '/dashboard',  icon: BarChart3 },
  { id: 'PAGE-forms',     type: 'Page', title: 'Forms',      subtitle: 'Dynamic form builder',   path: '/forms',      icon: ClipboardList },
  { id: 'PAGE-workflows', type: 'Page', title: 'Workflows',  subtitle: 'Process workflows',      path: '/workflows',  icon: Network },
  { id: 'PAGE-tickets',   type: 'Page', title: 'Tickets',    subtitle: 'Open tickets',           path: '/tickets',    icon: Ticket },
];

const TYPE_COLORS: Record<string, string> = {
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
