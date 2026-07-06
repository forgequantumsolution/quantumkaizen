import type { AppearanceColors } from '@/stores/appearanceStore';

export type PresetKey = 'default' | 'sapphire' | 'emerald' | 'slate';

export interface Preset {
  key: PresetKey;
  label: string;
  description: string;
  colors: AppearanceColors;
}

/** Original Quantum Kairoz palette — values mirror src/index.css :root. */
export const defaultColors: AppearanceColors = {
  gold: '#C9A84C',
  goldDark: '#A88937',
  navy: '#0D0E17',
  navyMid: '#1E2035',
  bg: '#F4F6FA',
  surface: '#FFFFFF',
  border: '#E8ECF2',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
  ink: '#0D0E17',
  ink2: '#4A5568',
  ink3: '#718096',
};

const sapphire: AppearanceColors = {
  gold: '#3B82F6',     // accent → blue-500
  goldDark: '#1D4ED8', // blue-700
  navy: '#0B1220',
  navyMid: '#172033',
  bg: '#F4F6FB',
  surface: '#FFFFFF',
  border: '#E2E8F0',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
  ink: '#0B1220',
  ink2: '#475569',
  ink3: '#64748B',
};

const emerald: AppearanceColors = {
  gold: '#10B981',     // accent → emerald-500
  goldDark: '#059669',
  navy: '#0A1814',
  navyMid: '#152521',
  bg: '#F3F8F6',
  surface: '#FFFFFF',
  border: '#E1ECE6',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
  ink: '#0A1814',
  ink2: '#3F5750',
  ink3: '#6B8278',
};

const slate: AppearanceColors = {
  gold: '#64748B',     // accent → slate-500 (monochrome look)
  goldDark: '#475569',
  navy: '#0F172A',
  navyMid: '#1E293B',
  bg: '#F8FAFC',
  surface: '#FFFFFF',
  border: '#E2E8F0',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
  ink: '#0F172A',
  ink2: '#475569',
  ink3: '#64748B',
};

export const presets: Record<PresetKey, Preset> = {
  default: {
    key: 'default',
    label: 'Default Gold',
    description: 'Original Quantum Kairoz palette',
    colors: defaultColors,
  },
  sapphire: {
    key: 'sapphire',
    label: 'Sapphire',
    description: 'Cool blue accent on a deep navy chrome',
    colors: sapphire,
  },
  emerald: {
    key: 'emerald',
    label: 'Emerald',
    description: 'Calm green with deep forest sidebar',
    colors: emerald,
  },
  slate: {
    key: 'slate',
    label: 'Slate',
    description: 'Monochrome — accents in cool slate',
    colors: slate,
  },
};

export const presetList: Preset[] = [
  presets.default,
  presets.sapphire,
  presets.emerald,
  presets.slate,
];
