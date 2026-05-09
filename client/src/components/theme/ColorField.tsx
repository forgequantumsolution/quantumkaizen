import { useEffect, useState } from 'react';

interface Props {
  label: string;
  description?: string;
  value: string;        // hex, e.g. "#C9A84C"
  onChange: (hex: string) => void;
}

const HEX_RE = /^#([0-9a-fA-F]{6})$/;

/**
 * Combined color picker + hex input. Keeps a local "draft" string so the
 * user can mid-type partial hex values without us screaming at them.
 */
export default function ColorField({ label, description, value, onChange }: Props) {
  const [draft, setDraft] = useState(value);

  // Re-sync the visible hex string when the parent value changes (e.g. preset
  // applied) — but not while the user is in the middle of typing.
  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = (next: string) => {
    if (HEX_RE.test(next)) onChange(next.toUpperCase());
  };

  return (
    <div className="flex items-center gap-3 py-2">
      <label className="flex items-center gap-3 cursor-pointer">
        <span
          className="block w-9 h-9 rounded-md border border-gray-300 shadow-sm overflow-hidden relative"
          style={{ backgroundColor: value }}
        >
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            aria-label={label}
          />
        </span>
      </label>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900">{label}</div>
        {description && <div className="text-xs text-gray-500 mt-0.5">{description}</div>}
      </div>
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (HEX_RE.test(draft)) commit(draft);
          else setDraft(value);  // revert invalid input
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') { setDraft(value); (e.target as HTMLInputElement).blur(); }
        }}
        className="w-24 h-8 px-2 text-xs font-mono uppercase tracking-tight border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gold focus:border-gold"
        spellCheck={false}
      />
    </div>
  );
}
