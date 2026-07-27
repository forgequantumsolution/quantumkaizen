/**
 * The risk chip other modules render on their own records.
 *
 *   <RiskProfileChip entityType="Supplier" entityId={s.id} />                 // fetches
 *   <RiskProfileChip entityType="Supplier" entityId={s.id} profile={p} />     // pre-fetched
 *
 * In a list, pass `profile` from `useRiskProfiles` — one batched request for the
 * page. Left to fetch its own, a 200-row table would issue 200 requests.
 *
 * Renders nothing when the record has no scored risk: a column of "—" across
 * every row of every table in the platform is noise, and absence of a chip
 * already reads as "no risk on file". Callers that need the difference between
 * "no risks" and "not loaded" should use the hook directly.
 *
 * The colour is the tenant's own configured band colour carried on the profile,
 * never a hard-coded ramp — so HIGH looks identical here and on the risk page.
 * See docs/RISK-cross-module-integration-plan.md §C.2.
 */
import { AlertTriangle } from 'lucide-react';
import { useHasPermission } from '@/stores/authStore';
import { useRiskProfile, type RiskProfile } from '@/lib/api/risk';

const base =
  'inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded border whitespace-nowrap';

export interface RiskProfileChipProps {
  entityType: string;
  entityId: string;
  /** Pre-fetched profile (batch path). Omit to let the chip fetch its own. */
  profile?: RiskProfile;
  /** Show open-risk count alongside the level. */
  showCount?: boolean;
  /** Render a muted "No risk" chip instead of nothing when there is no level. */
  showWhenEmpty?: boolean;
  className?: string;
}

export default function RiskProfileChip({
  entityType,
  entityId,
  profile,
  showCount = false,
  showWhenEmpty = false,
  className,
}: RiskProfileChipProps) {
  // Both hooks must run unconditionally — `||` would short-circuit the second
  // call and change the hook count between renders.
  const canReadProfile = useHasPermission('risk_profile.read');
  const canReadRisk = useHasPermission('risk.read');
  const canRead = canReadProfile || canReadRisk;
  // Only self-fetch when no profile was handed down — otherwise the batch fetch
  // in the parent would be pointless.
  const { data: fetched } = useRiskProfile(
    !profile && canRead ? entityType : undefined,
    !profile && canRead ? entityId : undefined,
  );
  const p = profile ?? fetched;

  if (!canRead || !p) return null;

  if (!p.highest_level_code) {
    if (!showWhenEmpty) return null;
    return (
      <span className={`${base} bg-gray-50 text-gray-400 border-gray-200 border-dashed ${className ?? ''}`}>
        No risk
      </span>
    );
  }

  const color = p.highest_level_color ?? '#64748B';
  // An unaccepted unacceptable risk is the one state that must be visible at a
  // glance — it is what blocks batch release and change approval downstream.
  const flagged = p.unacceptable_count > 0;

  const title =
    `${p.highest_level_label} — ${p.open_risk_count} open risk${p.open_risk_count === 1 ? '' : 's'}` +
    (p.unacceptable_count ? `, ${p.unacceptable_count} unaccepted unacceptable` : '') +
    (p.overdue_reviews ? `, ${p.overdue_reviews} review${p.overdue_reviews === 1 ? '' : 's'} overdue` : '') +
    (p.open_controls ? `, ${p.open_controls} control${p.open_controls === 1 ? '' : 's'} open` : '');

  return (
    <span
      className={`${base} ${className ?? ''}`}
      style={{ backgroundColor: `${color}18`, color, borderColor: `${color}55` }}
      title={title}
    >
      {flagged && <AlertTriangle size={11} className="shrink-0" />}
      {p.highest_level_label}
      {showCount && p.open_risk_count > 0 && (
        <span className="font-semibold tabular-nums">{p.open_risk_count}</span>
      )}
    </span>
  );
}
