import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface FilterPreset {
  id: string;
  module: string;
  name: string;
  filters: Record<string, string>;
  createdAt: string;
}

interface FilterPresetsState {
  presets: FilterPreset[];
  savePreset: (module: string, name: string, filters: Record<string, string>) => void;
  deletePreset: (id: string) => void;
  getPresetsForModule: (module: string) => FilterPreset[];
}

export const useFilterPresetsStore = create<FilterPresetsState>()(
  persist(
    (set, get) => ({
      presets: [],
      savePreset: (module, name, filters) => {
        const preset: FilterPreset = {
          id: `${module}-${Date.now()}`,
          module,
          name,
          filters,
          createdAt: new Date().toISOString(),
        };
        set({ presets: [...get().presets, preset] });
      },
      deletePreset: (id) => set({ presets: get().presets.filter((p) => p.id !== id) }),
      getPresetsForModule: (module) => get().presets.filter((p) => p.module === module),
    }),
    { name: 'qk-filter-presets' }
  )
);
