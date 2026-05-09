import { defaultFontSizes, type AppearanceColors, type AppearanceTypography } from '@/stores/appearanceStore';

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
  // preview scales independently of the global html font-size — and
  // crucially, it reads from the *staged* typography object so users see
  // uncommitted edits before pressing Save.
  const px = (rem: number) => `${rem * (typography.baseFontPx ?? 16)}px`;
  // Defensive: a stale persisted blob could leave fontSizes undefined in the
  // brief window before the page's staged init normalises it.
  const fs = typography.fontSizes ?? defaultFontSizes;

  return (
    <div
      className="rounded-lg overflow-hidden border shadow-md"
      style={{ borderColor: colors.border, backgroundColor: colors.bg }}
    >
      <div className="grid grid-cols-[180px_1fr] min-h-[480px]">
        {/* Fake sidebar */}
        <div
          className="flex flex-col gap-1.5 p-4"
          style={{ backgroundColor: colors.navy }}
        >
          <div className="flex items-center gap-2 mb-3">
            <div
              className="w-7 h-7 rounded flex items-center justify-center text-[12px] font-black"
              style={{ backgroundColor: colors.gold, color: colors.navy }}
            >
              Q
            </div>
            <span style={{ color: '#FFF', fontSize: px(0.875), fontWeight: 600 }}>
              Quantum
            </span>
          </div>
          <div
            className="px-2 py-1 mb-1"
            style={{ color: '#4A4A6A', fontSize: px(0.6875), fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase' }}
          >
            Overview
          </div>
          {[
            { label: 'Dashboard', active: true },
            { label: 'Analytics', active: false },
            { label: 'Documents', active: false },
            { label: 'Audits',    active: false },
            { label: 'Settings',  active: false },
          ].map((item) => (
            <div
              key={item.label}
              className="px-3 py-2 rounded"
              style={{
                backgroundColor: item.active ? colors.navyMid : 'transparent',
                color: item.active ? colors.gold : '#7A7A9A',
                borderLeft: item.active ? `3px solid ${colors.gold}` : '3px solid transparent',
                fontSize: px(fs.bodySm),
              }}
            >
              {item.label}
            </div>
          ))}
        </div>

        {/* Fake page body */}
        <div className="p-6 flex flex-col gap-4" style={{ backgroundColor: colors.bg }}>
          <div>
            <div
              style={{
                color: colors.ink,
                fontSize: px(fs.h1),
                fontWeight: typography.headingWeight,
                lineHeight: 1.2,
                letterSpacing: '-0.015em',
              }}
            >
              Page title — h1
            </div>
            <div
              style={{
                color: colors.ink,
                fontSize: px(fs.h2),
                fontWeight: typography.headingWeight,
                lineHeight: 1.3,
                marginTop: 4,
              }}
            >
              Section heading — h2
            </div>
            <div style={{ color: colors.ink3, fontSize: px(fs.caption), marginTop: 2 }}>
              The quick brown fox jumps over the lazy dog
            </div>
          </div>

          <div
            className="rounded-md p-4 border"
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
            }}
          >
            <div style={{ color: colors.ink, fontSize: px(fs.h3), fontWeight: 600, marginBottom: 6 }}>
              h3 subhead
            </div>
            <div style={{ color: colors.ink2, fontSize: px(fs.body), lineHeight: 1.55 }}>
              Body sample — surfaces tell us how cards and panels read against
              the page background, with realistic line-height.
            </div>
            <div style={{ color: colors.ink3, fontSize: px(fs.bodySm), marginTop: 4 }}>
              Body small — supporting copy.
            </div>
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span
                className="font-semibold rounded px-2 py-0.5"
                style={{
                  backgroundColor: `${colors.success}22`,
                  color: colors.success,
                  fontSize: px(fs.caption),
                }}
              >
                Approved
              </span>
              <span
                className="font-semibold rounded px-2 py-0.5"
                style={{
                  backgroundColor: `${colors.warning}22`,
                  color: colors.warning,
                  fontSize: px(fs.caption),
                }}
              >
                Pending
              </span>
              <span
                className="font-semibold rounded px-2 py-0.5"
                style={{
                  backgroundColor: `${colors.danger}22`,
                  color: colors.danger,
                  fontSize: px(fs.caption),
                }}
              >
                Overdue
              </span>
            </div>
          </div>

          <div className="flex gap-2 mt-1">
            <button
              type="button"
              className="px-4 py-2 rounded font-medium"
              style={{
                backgroundColor: colors.gold,
                color: '#FFF',
                border: `1px solid ${colors.goldDark}`,
                fontSize: px(fs.body),
              }}
            >
              Primary action
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded font-medium"
              style={{
                backgroundColor: colors.surface,
                color: colors.ink,
                border: `1px solid ${colors.border}`,
                fontSize: px(fs.body),
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
