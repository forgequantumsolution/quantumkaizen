import { Lock } from 'lucide-react';

/**
 * Prominent "Approved — Read Only" affordance for completed GMP records
 * (FQS-QK-UIUX-003 §8). Completed records must be visibly locked, not merely
 * rendered with disabled fields — this pairs with the existing `.form-readonly`
 * styling so the lock state reads at a glance.
 */
export function ReadOnlyBanner({ label = 'Record Approved — Read Only' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-state-closed/30 bg-surface-secondary px-3 py-2 text-xs font-medium text-state-closed">
      <Lock size={13} className="shrink-0" />
      {label}
    </div>
  );
}
