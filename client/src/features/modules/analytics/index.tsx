/**
 * Module analytics registry (spec §6). Maps a module's name to its purpose-built
 * analytics component. Each component is a separate file deriving every KPI from
 * that module's own records (read-only, spec §9). Modules without a bespoke
 * component fall back to the generic profile-driven ModuleDashboard, so nothing
 * regresses.
 *
 * ModulePage renders <ModuleAnalytics tickets moduleName /> on its Overview tab.
 */
import type { ComponentType } from 'react';
import type { TicketSummary } from '@/lib/api/ticket';
import ModuleDashboard from '../ModuleDashboard';
import type { ModuleAnalyticsProps, DrillView } from './types';

import CapaAnalytics from './CapaAnalytics';
import ChangeControlAnalytics from './ChangeControlAnalytics';
import DeviationAnalytics from './DeviationAnalytics';
import ComplaintAnalytics from './ComplaintAnalytics';
import RiskAnalytics from './RiskAnalytics';
import DocumentApprovalAnalytics from './DocumentApprovalAnalytics';
import EquipmentAnalytics from './EquipmentAnalytics';
import InspectionAnalytics from './InspectionAnalytics';
import MaintenanceAnalytics from './MaintenanceAnalytics';
import SupplierQualityAnalytics from './SupplierQualityAnalytics';
import CalibrationAnalytics from './CalibrationAnalytics';
import BatchDispositionAnalytics from './BatchDispositionAnalytics';
import ElectronicLogbookAnalytics from './ElectronicLogbookAnalytics';
import RecallAnalytics from './RecallAnalytics';

const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Ordered keyword rules — first match on the normalised module name wins. */
const RULES: Array<{ match: string[]; component: ComponentType<ModuleAnalyticsProps> }> = [
  // Ahead of the broader rules below: "Batch Disposition" must not be caught by
  // a looser keyword before it reaches its own panel.
  { match: ['batchdisposition', 'batchrelease', 'disposition'], component: BatchDispositionAnalytics },
  { match: ['electroniclogbook', 'logbook', 'elog'], component: ElectronicLogbookAnalytics },
  { match: ['recall', 'fieldaction', 'withdrawal'], component: RecallAnalytics },
  { match: ['capa', 'correctiveaction', 'preventiveaction'], component: CapaAnalytics },
  { match: ['changecontrol', 'change'], component: ChangeControlAnalytics },
  { match: ['deviation', 'incident'], component: DeviationAnalytics },
  { match: ['productcomplaint', 'complaint', 'grievance'], component: ComplaintAnalytics },
  { match: ['documentapproval', 'documentreview'], component: DocumentApprovalAnalytics },
  { match: ['riskmanagement', 'risk'], component: RiskAnalytics },
  { match: ['equipment', 'instrument', 'asset'], component: EquipmentAnalytics },
  { match: ['inspection'], component: InspectionAnalytics },
  { match: ['maintenance'], component: MaintenanceAnalytics },
  { match: ['supplierquality', 'supplier', 'vendor'], component: SupplierQualityAnalytics },
  { match: ['calibration'], component: CalibrationAnalytics },
];

/** Resolve the analytics component for a module name (null → use fallback). */
export function analyticsComponentFor(
  moduleName: string,
): ComponentType<ModuleAnalyticsProps> | null {
  const norm = normalise(moduleName);
  for (const rule of RULES) {
    if (rule.match.some((k) => norm.includes(k))) return rule.component;
  }
  return null;
}

/**
 * Drop-in replacement for <ModuleDashboard>: renders the module-specific
 * analytics panel when one exists, otherwise the generic dashboard.
 */
export default function ModuleAnalytics({
  tickets,
  moduleName,
  onDrill,
}: {
  tickets: TicketSummary[];
  moduleName: string;
  onDrill?: (view: DrillView) => void;
}) {
  const Specific = analyticsComponentFor(moduleName);
  if (Specific) return <Specific tickets={tickets} moduleName={moduleName} onDrill={onDrill} />;
  return <ModuleDashboard tickets={tickets} moduleName={moduleName} showIndicators={false} />;
}
