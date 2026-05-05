import type { AppearanceColors, AppearanceTypography } from '@/stores/appearanceStore';

interface Props {
  colors: AppearanceColors;
  typography: AppearanceTypography;
}

/**
 * Self-contained preview block showing a fake sidebar slice + a card of
 * sample UI. Renders entirely from the supplied `colors`/`typography` props
 * so the user can see uncommitted edits before pressing Save (i.e. it does
 * NOT read from the store directly).
 */
export default function AppearancePreview({ colors, typography }: Props) {
  // Inline rem-equivalent computed from the chosen base font size so the
  // preview scales independently of the global html font-size.
  const px = (rem: number) => `${rem * typography.baseFontPx}px`;

  return (
    <div
      className="rounded-lg overflow-hidden border shadow-sm"
      style={{ borderColor: colors.border, backgroundColor: colors.bg }}
    >
      <div className="grid grid-cols-[140px_1fr] min-h-[280px]">
        {/* Fake sidebar */}
        <div
          className="flex flex-col gap-2 p-3"
          style={{ backgroundColor: colors.navy }}
        >
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-6 h-6 rounded flex items-center justify-center text-[11px] font-black"
              style={{ backgroundColor: colors.gold, color: colors.navy }}
            >
              Q
            </div>
            <span style={{ color: '#FFF', fontSize: px(0.75), fontWeight: 600 }}>
              Quantum
            </span>
          </div>
          {[
            { label: 'Dashboard', active: true },
            { label: 'Documents', active: false },
            { label: 'Audits',    active: false },
            { label: 'Settings',  active: false },
          ].map((item) => (
            <div
              key={item.label}
              className="px-2 py-1.5 rounded text-xs"
              style={{
                backgroundColor: item.active ? colors.navyMid : 'transparent',
                color: item.active ? colors.gold : '#7A7A9A',
                borderLeft: item.active ? `3px solid ${colors.gold}` : '3px solid transparent',
                fontSize: px(0.8125),
              }}
            >
              {item.label}
            </div>
          ))}
        </div>

        {/* Fake page body */}
        <div className="p-4 flex flex-col gap-3" style={{ backgroundColor: colors.bg }}>
          <div>
            <div
              style={{
                color: colors.ink,
                fontSize: px(1.125),
                fontWeight: typography.headingWeight,
                lineHeight: 1.25,
              }}
            >
              Page heading sample
            </div>
            <div style={{ color: colors.ink3, fontSize: px(0.75), marginTop: 2 }}>
              The quick brown fox jumps over the lazy dog
            </div>
          </div>

          <div
            className="rounded p-3 border"
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
            }}
          >
            <div style={{ color: colors.ink2, fontSize: px(0.8125) }}>
              A surface card demonstrates body text contrast against the page
              background.
            </div>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span
                className="text-[10px] font-semibold rounded px-1.5 py-0.5"
                style={{ backgroundColor: `${colors.success}22`, color: colors.success }}
              >
                Success
              </span>
              <span
                className="text-[10px] font-semibold rounded px-1.5 py-0.5"
                style={{ backgroundColor: `${colors.warning}22`, color: colors.warning }}
              >
                Warning
              </span>
              <span
                className="text-[10px] font-semibold rounded px-1.5 py-0.5"
                style={{ backgroundColor: `${colors.danger}22`, color: colors.danger }}
              >
                Danger
              </span>
            </div>
          </div>

          <div className="flex gap-2 mt-1">
            <button
              type="button"
              className="px-3 py-1.5 rounded text-xs font-medium"
              style={{
                backgroundColor: colors.gold,
                color: '#FFF',
                border: `1px solid ${colors.goldDark}`,
                fontSize: px(0.8125),
              }}
            >
              Primary action
            </button>
            <button
              type="button"
              className="px-3 py-1.5 rounded text-xs font-medium"
              style={{
                backgroundColor: colors.surface,
                color: colors.ink,
                border: `1px solid ${colors.border}`,
                fontSize: px(0.8125),
              }}
            >
              Secondary
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
