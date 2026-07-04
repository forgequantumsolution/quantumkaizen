import { AutoComplete } from 'antd';
import { useUnits } from '@/lib/api/unit';

/**
 * Unit-of-measure picker backed by the Units master (`/lims/units`), while still
 * allowing free-text so legacy/ad-hoc units keep working (W-1d). Drop-in for the
 * free-text unit `<Input>`s across the LIMS forms.
 */
export default function UnitSelect({
  value,
  onChange,
  size,
  disabled,
  placeholder = 'e.g. %',
}: {
  value: string | null | undefined;
  onChange: (v: string | null) => void;
  size?: 'small' | 'middle' | 'large';
  disabled?: boolean;
  placeholder?: string;
}) {
  const { data } = useUnits();
  const options = (data?.data ?? [])
    .map((u) => u.symbol || u.code)
    .filter((v, i, a) => v && a.indexOf(v) === i)
    .map((sym) => {
      const u = (data?.data ?? []).find((x) => (x.symbol || x.code) === sym);
      return { value: sym, label: u?.name ? `${sym} — ${u.name}` : sym };
    });

  return (
    <AutoComplete
      value={value ?? undefined}
      options={options}
      size={size}
      disabled={disabled}
      allowClear
      style={{ width: '100%' }}
      placeholder={placeholder}
      filterOption={(input, opt) => String(opt?.value ?? '').toLowerCase().includes(input.toLowerCase())}
      onChange={(v) => onChange((v as string) || null)}
    />
  );
}
