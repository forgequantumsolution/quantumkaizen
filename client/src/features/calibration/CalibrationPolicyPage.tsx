import { App, InputNumber, Select, Spin, Switch, Tag } from 'antd';
import { SlidersHorizontal } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import CalibrationPageHeader from './CalibrationPageHeader';
import { useHasPermission } from '@/stores/authStore';
import { useCalibrationConfig, useUpdateCalibrationConfig, type CalibrationConfig } from '@/lib/api/calibration';

/**
 * Policy & Rules — the columns an industry pack sets, exposed individually.
 *
 * Saved per field rather than behind a Save button: these are independent
 * switches, and a half-applied form is a worse failure than a slow one.
 */
export default function CalibrationPolicyPage() {
  const { data: config, isLoading } = useCalibrationConfig();
  const canUpdate = useHasPermission('calibration_config.update');
  const { message } = App.useApp();
  const update = useUpdateCalibrationConfig();

  if (isLoading || !config) {
    return (
      <PageContainer>
        <div className="flex justify-center py-20">
          <Spin />
        </div>
      </PageContainer>
    );
  }

  const save = async (patch: Partial<CalibrationConfig>) => {
    try {
      await update.mutateAsync(patch);
      message.success('Saved');
    } catch (e) {
      message.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed');
    }
  };

  const Toggle = ({ k }: { k: keyof CalibrationConfig }) => (
    <Switch disabled={!canUpdate} checked={!!config[k]} onChange={(v) => save({ [k]: v } as Partial<CalibrationConfig>)} />
  );

  const Num = ({ k, max = 365 }: { k: keyof CalibrationConfig; max?: number }) => (
    <InputNumber
      disabled={!canUpdate}
      min={0}
      max={max}
      value={config[k] as number}
      onChange={(v) => v !== null && save({ [k]: v } as Partial<CalibrationConfig>)}
      style={{ width: 90 }}
    />
  );

  return (
    <PageContainer>
      <CalibrationPageHeader
        title="Policy & Rules"
        icon={SlidersHorizontal}
        actions={
          <Tag color={config.industry_pack === 'CUSTOM' ? 'default' : 'gold'} className="!text-[11px] !mr-0">
            {config.industry_pack === 'CUSTOM' ? 'Custom configuration' : `${config.industry_pack} pack`}
          </Tag>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="Scheduling">
          <Row label="Due-soon window" hint="Days before the due date an instrument is flagged.">
            <Num k="due_soon_window_days" />
          </Row>
          <Row label="Auto-create lead time" hint="How far ahead of due the calibration record is created.">
            <Num k="auto_spawn_lead_days" />
          </Row>
          <Row label="Grace period" hint="Days past due before an instrument becomes overdue. GxP regimes use 0.">
            <Num k="grace_days" max={90} />
          </Row>
          <Row
            label="Interval basis"
            hint="Anniversary-based prevents interval creep — four days late must not push every future date four days out."
          >
            <Select
              disabled={!canUpdate}
              value={config.interval_reset_basis}
              onChange={(v) => save({ interval_reset_basis: v })}
              style={{ width: 200 }}
              options={[
                { value: 'PERFORMED_DATE', label: 'From date performed' },
                { value: 'PREVIOUS_DUE_DATE', label: 'From previous due date' },
              ]}
            />
          </Row>
          <Row label="Allow early calibration" hint="Permit work inside the early window before the due date.">
            <Toggle k="allow_early_calibration" />
          </Row>
        </Section>

        <Section title="Enforcement">
          <Row label="Block use when overdue" hint="An overdue instrument cannot be used to produce data.">
            <Toggle k="block_use_when_overdue" />
          </Row>
          <Row label="Block use when failed" hint="A failed instrument is taken out of service automatically.">
            <Toggle k="block_use_when_failed" />
          </Row>
          <Row label="Require competency" hint="The performer must hold a completed training record for the plan's course.">
            <Toggle k="require_competency_to_perform" />
          </Row>
          <Row label="Require reason for change" hint="Superseding a calibration plan requires a documented reason.">
            <Toggle k="require_reason_for_change" />
          </Row>
        </Section>

        <Section title="Signatures — 21 CFR 11 / EU GMP Annex 11">
          <Row label="Performer signature" hint="Signed when readings are submitted.">
            <Toggle k="require_performer_signature" />
          </Row>
          <Row label="Reviewer signature" hint="Second-person review before approval. Turning this off collapses the review stage.">
            <Toggle k="require_reviewer_signature" />
          </Row>
          <Row label="Approver signature" hint="Final QA approval; issues the certificate and advances the schedule.">
            <Toggle k="require_approver_signature" />
          </Row>
        </Section>

        <Section title="Out of tolerance">
          <Row label="Impact assessment required" hint="A calibration cannot be approved while its assessment is open.">
            <Toggle k="oot_impact_assessment_required" />
          </Row>
          <Row
            label="Impact window"
            hint="Where the suspect period begins. FMCG measures from the last passing shift check — hours ago, not months."
          >
            <Select
              disabled={!canUpdate}
              value={config.oot_impact_window}
              onChange={(v) => save({ oot_impact_window: v })}
              style={{ width: 215 }}
              options={[
                { value: 'SINCE_LAST_CALIBRATION', label: 'Since last calibration' },
                { value: 'SINCE_LAST_PASSING_CHECK', label: 'Since last passing check' },
                { value: 'FIXED_DAYS', label: 'Fixed 90 days' },
              ]}
            />
          </Row>
          <Row label="Customer notification" hint="IATF 16949 §7.1.5.2.1 — suspect product may already have shipped.">
            <Toggle k="oot_requires_customer_notification" />
          </Row>
          <Row label="Product hold" hint="BRCGS / FSSC — product produced inside the window goes on hold.">
            <Toggle k="oot_requires_product_hold" />
          </Row>
        </Section>

        <Section title="Capabilities" className="lg:col-span-2">
          <p className="text-[11px] text-gray-500 mb-1 -mt-1">
            These decide whether a surface exists at all here — permissions decide who may see it. A capability turned
            off hides its tab rather than showing an empty one.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
            <div>
              <Row label="MSA / Gage R&R" hint="Automotive. Gates plan activation on an acceptable study.">
                <Toggle k="enable_msa" />
              </Row>
              <Row label="In-use verification checks" hint="FMCG shift checks and pharma daily balance checks.">
                <Toggle k="enable_in_use_checks" />
              </Row>
            </div>
            <div>
              <Row label="Legal metrology" hint="FMCG weights & measures stamp validity, tracked separately from calibration.">
                <Toggle k="enable_legal_metrology" />
              </Row>
              <Row label="AIQ groups" hint="Pharma USP ⟨1058⟩ A / B / C instrument classification.">
                <Toggle k="enable_aiq_groups" />
              </Row>
            </div>
          </div>
        </Section>

        <Section title="Numbering" className="lg:col-span-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
            <Row label="Record prefix" hint={`Calibration records read ${config.event_number_prefix}-YYYY-00001.`}>
              <span className="font-mono text-xs text-gray-600">{config.event_number_prefix}</span>
            </Row>
            <Row label="Certificate prefix" hint={`Certificates read ${config.certificate_number_prefix}-…`}>
              <span className="font-mono text-xs text-gray-600">{config.certificate_number_prefix}</span>
            </Row>
          </div>
        </Section>
      </div>
    </PageContainer>
  );
}

function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-gray-200/80 bg-white shadow-sm p-4 ${className ?? ''}`}>
      <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">{title}</h3>
      <div>{children}</div>
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-gray-100 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold text-gray-800">{label}</div>
        {hint && <div className="text-[11px] text-gray-500 leading-snug mt-0.5">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
