import { useState } from 'react';
import { Plus, Trash2, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WhyEntry { id: string; why: string; answer: string; }

interface RootCauseBuilderProps {
  mode: '5why' | 'fishbone';
  onModeChange: (m: '5why' | 'fishbone') => void;
  whys: WhyEntry[];
  onWhysChange: (w: WhyEntry[]) => void;
  fishboneCategories: Record<string, string[]>;
  onFishboneChange: (c: Record<string, string[]>) => void;
}

const FISHBONE_CATS = ['People', 'Process', 'Machine', 'Material', 'Environment', 'Measurement'];

export default function RootCauseBuilder({
  mode, onModeChange, whys, onWhysChange, fishboneCategories, onFishboneChange
}: RootCauseBuilderProps) {
  const addWhy = () => onWhysChange([...whys, { id: Date.now().toString(), why: `Why ${whys.length + 1}`, answer: '' }]);
  const removeWhy = (id: string) => onWhysChange(whys.filter(w => w.id !== id));
  const updateWhy = (id: string, answer: string) => onWhysChange(whys.map(w => w.id === id ? { ...w, answer } : w));
  const addCause = (cat: string) => {
    const updated = { ...fishboneCategories, [cat]: [...(fishboneCategories[cat] || []), ''] };
    onFishboneChange(updated);
  };
  const updateCause = (cat: string, idx: number, val: string) => {
    const updated = { ...fishboneCategories, [cat]: fishboneCategories[cat].map((c, i) => i === idx ? val : c) };
    onFishboneChange(updated);
  };
  const removeCause = (cat: string, idx: number) => {
    const updated = { ...fishboneCategories, [cat]: fishboneCategories[cat].filter((_, i) => i !== idx) };
    onFishboneChange(updated);
  };

  return (
    <div className="space-y-3">
      {/* Mode toggle */}
      <div className="flex items-center gap-2">
        {(['5why', 'fishbone'] as const).map(m => (
          <button key={m} onClick={() => onModeChange(m)}
            className={cn('px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors', mode === m ? 'bg-slate-900 text-white border-slate-900' : 'border-gray-200 text-gray-600 hover:bg-gray-50')}>
            {m === '5why' ? '5-Why Analysis' : 'Fishbone Diagram'}
          </button>
        ))}
      </div>

      {mode === '5why' && (
        <div className="space-y-2">
          {whys.map((why, idx) => (
            <div key={why.id} className="flex items-start gap-2">
              <div className="flex items-center gap-1.5 mt-2.5 shrink-0">
                {idx > 0 && <ChevronRight size={12} className="text-gray-300" />}
                <span className="text-xs font-semibold text-slate-900 w-14">{why.why}?</span>
              </div>
              <input value={why.answer} onChange={e => updateWhy(why.id, e.target.value)}
                placeholder="Because..." className="input-base flex-1 text-sm" />
              {idx > 0 && (
                <button onClick={() => removeWhy(why.id)} className="mt-2.5 text-gray-300 hover:text-red-400 transition-colors shrink-0">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
          {whys.length < 5 && (
            <button onClick={addWhy} className="flex items-center gap-1.5 text-xs text-slate-900 font-medium hover:underline mt-1">
              <Plus size={12} /> Add Why
            </button>
          )}
          {whys.length > 0 && whys[whys.length - 1].answer && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs font-semibold text-amber-800">Root Cause</p>
              <p className="text-sm text-amber-900 mt-0.5">{whys[whys.length - 1].answer}</p>
            </div>
          )}
        </div>
      )}

      {mode === 'fishbone' && (
        <div className="grid grid-cols-2 gap-3">
          {FISHBONE_CATS.map(cat => (
            <div key={cat} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-700">{cat}</span>
                <button onClick={() => addCause(cat)} className="text-slate-900 hover:text-blue-600 transition-colors">
                  <Plus size={13} />
                </button>
              </div>
              {(fishboneCategories[cat] || []).map((cause, idx) => (
                <div key={idx} className="flex items-center gap-1 mt-1">
                  <input value={cause} onChange={e => updateCause(cat, idx, e.target.value)}
                    placeholder="Enter cause..." className="input-base text-xs py-1 flex-1" />
                  <button onClick={() => removeCause(cat, idx)} className="text-gray-300 hover:text-red-400 transition-colors shrink-0">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              {!(fishboneCategories[cat]?.length) && (
                <p className="text-xs text-gray-400 italic">No causes added</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
