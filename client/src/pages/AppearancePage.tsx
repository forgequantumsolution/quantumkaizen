import { useMemo, useRef, useState } from 'react';
import {
  Palette, Type as TypeIcon, SwatchBook, Save, Check, RotateCcw,
  Download, Upload, Sun, Moon, Monitor, ChevronDown,
} from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import {
  useAppearanceStore,
  type AppearanceColors,
  type AppearanceTypography,
  type Mode,
  type Density,
  type SansFamily,
  type MonoFamily,
  type HeadingWeight,
} from '@/stores/appearanceStore';
import { presetList, type PresetKey } from '@/components/theme/presets';
import ColorField from '@/components/theme/ColorField';
import AppearancePreview from '@/components/theme/AppearancePreview';

const tabs = [
  { key: 'theme',      label: 'Theme',      icon: SwatchBook },
  { key: 'colors',     label: 'Colors',     icon: Palette },
  { key: 'typography', label: 'Typography', icon: TypeIcon },
] as const;

type Tab = (typeof tabs)[number]['key'];

// ── Color field metadata ────────────────────────────────────────────────────
// Listed in display order. Status colors are gated behind the "advanced"
// toggle to discourage accidentally inverting traffic-light semantics.

interface FieldDef {
  key: keyof AppearanceColors;
  label: string;
  description: string;
  advanced?: boolean;
}

const COLOR_FIELDS: FieldDef[] = [
  { key: 'gold',     label: 'Primary accent',  description: 'Buttons, links, active nav indicator' },
  { key: 'goldDark', label: 'Accent (dark)',   description: 'Pressed / hover state for primary' },
  { key: 'navy',     label: 'Sidebar bg',      description: 'Sidebar and dark surfaces' },
  { key: 'navyMid',  label: 'Sidebar active',  description: 'Active item background in sidebar' },
  { key: 'bg',       label: 'Page background', description: 'Outermost page surface' },
  { key: 'surface',  label: 'Card surface',    description: 'Cards, panels, modals' },
  { key: 'border',   label: 'Border',          description: 'Default dividers and form borders' },
  { key: 'ink',      label: 'Text — primary',  description: 'Headings and body text' },
  { key: 'ink2',     label: 'Text — secondary',description: 'Descriptions and labels' },
  { key: 'ink3',     label: 'Text — muted',    description: 'Placeholder and tertiary' },
  { key: 'success',  label: 'Status — success', description: 'Approved / compliant', advanced: true },
  { key: 'warning',  label: 'Status — warning', description: 'Caution / pending',    advanced: true },
  { key: 'danger',   label: 'Status — danger',  description: 'Errors / overdue',     advanced: true },
];

export default function AppearancePage() {
  const store = useAppearanceStore();

  // Staged copy — edits live here until Save. This keeps the preview accurate
  // and lets users walk away with Reset without polluting the live theme.
  const [staged, setStaged] = useState({
    mode: store.mode,
    preset: store.preset,
    colors: store.colors,
    typography: store.typography,
  });

  const [activeTab, setActiveTab] = useState<Tab>('theme');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Field updaters that mutate the staged copy ─────────────────────────────
  const setMode    = (mode: Mode)             => setStaged((s) => ({ ...s, mode }));
  const setPreset  = (preset: PresetKey)      => {
    const next = presetList.find((p) => p.key === preset)!;
    setStaged((s) => ({ ...s, preset, colors: next.colors }));
  };
  const patchColor = (key: keyof AppearanceColors, value: string) =>
    setStaged((s) => ({ ...s, colors: { ...s.colors, [key]: value }, preset: 'custom' }));
  const patchType  = (patch: Partial<AppearanceTypography>) =>
    setStaged((s) => ({ ...s, typography: { ...s.typography, ...patch } }));

  const isDirty = useMemo(() => {
    return (
      staged.mode    !== store.mode ||
      staged.preset  !== store.preset ||
      JSON.stringify(staged.colors)     !== JSON.stringify(store.colors) ||
      JSON.stringify(staged.typography) !== JSON.stringify(store.typography)
    );
  }, [staged, store.mode, store.preset, store.colors, store.typography]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleSave = () => {
    store.setMode(staged.mode);
    if (staged.preset !== 'custom') {
      store.applyPreset(staged.preset);
    } else {
      store.patchColors(staged.colors);  // forces preset = 'custom'
    }
    store.patchTypography(staged.typography);
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  };

  const handleReset = () => {
    store.resetAll();
    setStaged({
      mode: 'light',
      preset: 'default',
      colors: presetList[0].colors,
      typography: { baseFontPx: 16, density: 'comfortable', sansFamily: 'outfit', monoFamily: 'dm-mono', headingWeight: 700 },
    });
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(staged, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `qk-appearance-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(String(reader.result));
        setStaged({
          mode:       json.mode       ?? staged.mode,
          preset:     json.preset     ?? 'custom',
          colors:     { ...staged.colors,     ...(json.colors     ?? {}) },
          typography: { ...staged.typography, ...(json.typography ?? {}) },
        });
      } catch {
        alert('That file does not look like a valid appearance JSON.');
      }
    };
    reader.readAsText(file);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Appearance"
        description="Customize colors, fonts, and density for the entire site."
        actions={
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImportFile(f);
                e.target.value = '';
              }}
            />
            <Button variant="ghost" onClick={() => fileInputRef.current?.click()}>
              <Upload size={14} /> Import
            </Button>
            <Button variant="ghost" onClick={handleExport}>
              <Download size={14} /> Export
            </Button>
            <Button variant="outline" onClick={handleReset} title="Reset to factory defaults">
              <RotateCcw size={14} /> Reset
            </Button>
            <Button variant="primary" onClick={handleSave} disabled={!isDirty}>
              {saved ? <Check size={15} /> : <Save size={15} />}
              {saved ? 'Saved!' : 'Save Changes'}
            </Button>
          </>
        }
      />

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1 -mb-px" role="tablist">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors duration-150',
                  active ? 'border-slate-900 text-slate-900' : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300',
                )}
              >
                <Icon size={16} className={active ? 'text-slate-900' : 'text-gray-400'} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Two-column: form on the left, live preview on the right */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
        <div className="min-w-0">
          {activeTab === 'theme'      && <ThemeTab    mode={staged.mode}    preset={staged.preset} setMode={setMode} setPreset={setPreset} />}
          {activeTab === 'colors'     && <ColorsTab   colors={staged.colors} patchColor={patchColor} showAdvanced={showAdvanced} setShowAdvanced={setShowAdvanced} />}
          {activeTab === 'typography' && <TypographyTab typography={staged.typography} patch={patchType} />}
        </div>

        <aside className="lg:sticky lg:top-4 space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 px-1">Live preview</div>
          <AppearancePreview colors={staged.colors} typography={staged.typography} />
          <div className="text-[11px] text-gray-500 px-1 leading-relaxed">
            Edits show here immediately. Press <strong>Save</strong> to apply across the site.
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ── Theme tab ─────────────────────────────────────────────────────────────── */

interface ThemeTabProps {
  mode: Mode;
  preset: PresetKey | 'custom';
  setMode: (m: Mode) => void;
  setPreset: (p: PresetKey) => void;
}

function ThemeTab({ mode, preset, setMode, setPreset }: ThemeTabProps) {
  const modes: { value: Mode; label: string; icon: typeof Sun }[] = [
    { value: 'light',  label: 'Light',  icon: Sun },
    { value: 'dark',   label: 'Dark',   icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ];

  return (
    <div className="space-y-8">
      {/* Mode */}
      <section>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Color mode</h3>
        <div className="grid grid-cols-3 gap-3 max-w-md">
          {modes.map(({ value, label, icon: Icon }) => {
            const active = mode === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={cn(
                  'flex flex-col items-center justify-center gap-2 p-4 rounded-lg border-2 transition-all',
                  active ? 'border-gold bg-gold/5 text-gray-900' : 'border-gray-200 hover:border-gray-300 text-gray-600',
                )}
              >
                <Icon size={20} />
                <span className="text-sm font-medium">{label}</span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Dark mode is currently a partial preview — page chrome adapts but
          some branded elements remain in their light styling.
        </p>
      </section>

      {/* Preset */}
      <section>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Color preset</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
          {presetList.map((p) => {
            const active = preset === p.key;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => setPreset(p.key)}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-all',
                  active ? 'border-gold bg-gold/5' : 'border-gray-200 hover:border-gray-300',
                )}
              >
                <div className="flex gap-1 shrink-0">
                  {[p.colors.navy, p.colors.gold, p.colors.bg, p.colors.surface].map((c, i) => (
                    <span
                      key={i}
                      className="w-5 h-8 rounded border border-black/10"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-900">{p.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{p.description}</div>
                </div>
                {active && <Check size={16} className="text-gold shrink-0" />}
              </button>
            );
          })}
        </div>
        {preset === 'custom' && (
          <p className="text-xs text-gray-500 mt-2">
            You're using a custom palette. Pick a preset to overwrite it.
          </p>
        )}
      </section>
    </div>
  );
}

/* ── Colors tab ────────────────────────────────────────────────────────────── */

interface ColorsTabProps {
  colors: AppearanceColors;
  patchColor: (k: keyof AppearanceColors, v: string) => void;
  showAdvanced: boolean;
  setShowAdvanced: (v: boolean) => void;
}

function ColorsTab({ colors, patchColor, showAdvanced, setShowAdvanced }: ColorsTabProps) {
  const basic    = COLOR_FIELDS.filter((f) => !f.advanced);
  const advanced = COLOR_FIELDS.filter((f) =>  f.advanced);

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="divide-y divide-gray-100">
        {basic.map((f) => (
          <ColorField
            key={f.key}
            label={f.label}
            description={f.description}
            value={colors[f.key]}
            onChange={(v) => patchColor(f.key, v)}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 font-medium"
      >
        <ChevronDown size={14} className={cn('transition-transform', showAdvanced ? 'rotate-180' : '')} />
        {showAdvanced ? 'Hide' : 'Show'} advanced (status colors)
      </button>

      {showAdvanced && (
        <div>
          <p className="text-xs text-gray-500 mb-2">
            Status colors carry traffic-light meaning across the system. Change with care.
          </p>
          <div className="divide-y divide-gray-100">
            {advanced.map((f) => (
              <ColorField
                key={f.key}
                label={f.label}
                description={f.description}
                value={colors[f.key]}
                onChange={(v) => patchColor(f.key, v)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Typography tab ────────────────────────────────────────────────────────── */

interface TypographyTabProps {
  typography: AppearanceTypography;
  patch: (p: Partial<AppearanceTypography>) => void;
}

function TypographyTab({ typography: t, patch }: TypographyTabProps) {
  const densities: { value: Density; label: string; hint: string }[] = [
    { value: 'compact',     label: 'Compact',     hint: 'Tight spacing, more on screen' },
    { value: 'comfortable', label: 'Comfortable', hint: 'Default — balanced readability' },
    { value: 'spacious',    label: 'Spacious',    hint: 'Roomier — easier scanning' },
  ];

  const sansOptions: { value: SansFamily; label: string }[] = [
    { value: 'outfit', label: 'Outfit (default)' },
    { value: 'inter',  label: 'Inter' },
    { value: 'system', label: 'System UI' },
  ];

  const monoOptions: { value: MonoFamily; label: string }[] = [
    { value: 'dm-mono',   label: 'DM Mono (default)' },
    { value: 'jetbrains', label: 'JetBrains Mono' },
    { value: 'system',    label: 'System Monospace' },
  ];

  const weightOptions: HeadingWeight[] = [600, 700, 800];

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Base font size */}
      <section>
        <div className="flex items-baseline justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-900">Base font size</h3>
          <span className="text-sm font-mono text-gray-600">{t.baseFontPx}px</span>
        </div>
        <input
          type="range"
          min={12}
          max={18}
          step={1}
          value={t.baseFontPx}
          onChange={(e) => patch({ baseFontPx: Number(e.target.value) })}
          className="w-full accent-[color:var(--color-gold)]"
        />
        <div className="flex justify-between text-[11px] text-gray-500 mt-1">
          <span>12px</span><span>14px</span><span>16px</span><span>18px</span>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Drives every <code className="font-mono text-[11px]">rem</code>-sized
          element across the app.
        </p>
      </section>

      {/* Density */}
      <section>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">UI density</h3>
        <div className="grid grid-cols-3 gap-3">
          {densities.map(({ value, label, hint }) => {
            const active = t.density === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => patch({ density: value })}
                className={cn(
                  'p-3 rounded-lg border-2 text-left transition-all',
                  active ? 'border-gold bg-gold/5' : 'border-gray-200 hover:border-gray-300',
                )}
              >
                <div className="text-sm font-medium text-gray-900">{label}</div>
                <div className="text-xs text-gray-500 mt-0.5">{hint}</div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Sans family */}
      <section>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Sans-serif family</h3>
        <select
          value={t.sansFamily}
          onChange={(e) => patch({ sansFamily: e.target.value as SansFamily })}
          className="w-full max-w-xs h-10 px-3 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gold focus:border-gold"
        >
          {sansOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </section>

      {/* Mono family */}
      <section>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Monospace family</h3>
        <select
          value={t.monoFamily}
          onChange={(e) => patch({ monoFamily: e.target.value as MonoFamily })}
          className="w-full max-w-xs h-10 px-3 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gold focus:border-gold"
        >
          {monoOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </section>

      {/* Heading weight */}
      <section>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Heading weight</h3>
        <div className="flex gap-2">
          {weightOptions.map((w) => {
            const active = t.headingWeight === w;
            return (
              <button
                key={w}
                type="button"
                onClick={() => patch({ headingWeight: w })}
                className={cn(
                  'h-10 px-4 rounded border-2 text-sm transition-all',
                  active ? 'border-gold bg-gold/5 text-gray-900' : 'border-gray-200 hover:border-gray-300 text-gray-600',
                )}
                style={{ fontWeight: w }}
              >
                {w} {w === 700 && '(default)'}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
