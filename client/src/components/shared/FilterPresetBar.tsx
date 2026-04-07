import { useState } from 'react';
import { Bookmark, BookmarkPlus, X } from 'lucide-react';
import { useFilterPresetsStore, type FilterPreset } from '@/stores/filterPresetsStore';

interface FilterPresetBarProps {
  module: string;
  currentFilters: Record<string, string>;
  onApplyPreset: (filters: Record<string, string>) => void;
}

export function FilterPresetBar({ module, currentFilters, onApplyPreset }: FilterPresetBarProps) {
  const { savePreset, deletePreset, getPresetsForModule } = useFilterPresetsStore();
  const modulePresets = getPresetsForModule(module);
  const [saving, setSaving] = useState(false);
  const [presetName, setPresetName] = useState('');

  const hasActiveFilters = Object.values(currentFilters).some(Boolean);

  if (modulePresets.length === 0 && !hasActiveFilters) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Bookmark size={13} className="text-gray-400 shrink-0" />
      {modulePresets.map((p: FilterPreset) => (
        <div key={p.id} className="flex items-center gap-1 bg-slate-900/5 border border-slate-900/15 rounded-full pl-2.5 pr-1 py-0.5">
          <button
            onClick={() => onApplyPreset(p.filters)}
            className="text-xs text-slate-900 font-medium"
          >
            {p.name}
          </button>
          <button
            onClick={() => deletePreset(p.id)}
            className="text-gray-400 hover:text-red-500 transition-colors"
          >
            <X size={11} />
          </button>
        </div>
      ))}
      {hasActiveFilters && (
        saving ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && presetName.trim()) {
                  savePreset(module, presetName.trim(), currentFilters);
                  setPresetName('');
                  setSaving(false);
                }
                if (e.key === 'Escape') setSaving(false);
              }}
              placeholder="Preset name…"
              className="text-xs border border-gray-300 rounded-full px-2 py-0.5 outline-none focus:border-blue-500 w-28"
            />
            <button onClick={() => setSaving(false)} className="text-gray-400 hover:text-gray-600">
              <X size={12} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setSaving(true)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-slate-900 transition-colors"
          >
            <BookmarkPlus size={12} />
            Save filters
          </button>
        )
      )}
    </div>
  );
}
