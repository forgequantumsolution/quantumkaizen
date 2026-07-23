/**
 * Standalone, production-safe seed for the Risk Management dynamic workflow.
 *
 * Seeds ONLY the `Risk Management` WorkflowType, the `Risk Management v1` workflow (6
 * stages following the ICH Q9 quality-risk-management cycle) and its 6
 * per-stage forms. It does NOT touch users, roles, permissions or demo data, so
 * it is safe to run against production. Dependencies created by the base seed
 * (workflow stage statuses, built-in field types, roles) are looked up; if they
 * are missing it exits with a clear message.
 *
 * Idempotent: guarded by WorkflowType name, workflow name and form templateKey,
 * so re-running is a no-op.
 *
 * Two things this unlocks:
 *   1. The engine gets a workflow that Risk records can be driven by — the
 *      `Risk.workflowId / workflowTicketId / workflowTicketUniqueId` link triple
 *      (the same pattern Capa and AuditRegister use).
 *   2. The sidebar auto-generates a "Risk Management" entry from the WorkflowType,
 *      and the analytics registry resolves it to RiskAnalytics — both normalise
 *      the type name to "riskmanagement" (analytics also still matches "risk"),
 *      which Sidebar.tsx's ICON_BY_KEY / MODULE_GROUP now recognise.
 *
 *   Run:  npm run db:seed:risk-workflow      (backend workspace)
 *   or:   npx tsx prisma/seed-risk-workflow.ts
 */
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Stage canonicalId → RiskStatus. canonicalId is stable across workflow
 * versions, so this is the mapping a future risk-workflow sync service uses to
 * derive a risk's status from its ticket's current stage — exactly how
 * capa.service.ts's CAPA_STATUS_FOR_STAGE works.
 */
export const RISK_STATUS_FOR_STAGE: Record<string, string> = {
  'risk-identification': 'IDENTIFIED',
  'risk-assessment': 'UNDER_ASSESSMENT',
  'risk-control-planning': 'TREATMENT_PLANNED',
  'risk-control-implementation': 'TREATMENT_IN_PROGRESS',
  'risk-residual-review': 'RESIDUAL_ASSESSED',
  'risk-acceptance': 'ACCEPTED',
};

async function main() {
  console.log('🌱  Seeding Risk Management workflow + per-stage forms (standalone)...');

  // ── Dependencies created by the base seed ────────────────────────────────
  const approveStatus = await prisma.workflowStageStatus.findUnique({
    where: { name: 'Approve / Forward' },
  });
  const returnStatus = await prisma.workflowStageStatus.findUnique({ where: { name: 'Return' } });
  if (!approveStatus) {
    throw new Error(
      'Missing WorkflowStageStatus "Approve / Forward". Run the base seed once first ' +
        '(npm run db:seed) so workflow stage statuses, field types and roles exist.',
    );
  }

  const ft = async (name: string) =>
    (await prisma.fieldType.findUnique({ where: { name } }))?.id ?? null;

  const FT_TEXT = await ft('text');
  const FT_TEXTAREA = await ft('textarea');
  const FT_SELECT = await ft('select');
  const FT_DATE = await ft('date');
  const FT_SWITCH = await ft('switch');
  const FT_NUMBER = await ft('number');
  if (!FT_TEXT || !FT_TEXTAREA || !FT_SELECT || !FT_DATE || !FT_SWITCH || !FT_NUMBER) {
    throw new Error(
      'Missing one or more built-in field types (text/textarea/select/date/switch/number). ' +
        'Run the base seed once first (npm run db:seed).',
    );
  }

  const roleByName = new Map((await prisma.role.findMany()).map((r) => [r.name, r.id]));
  const adminUser = await prisma.user.findFirst({
    where: { email: 'info@forgequantumsolution.com' },
    select: { id: true },
  });

  // The scoring scales here mirror the seeded ICH_Q9_5X5 framework so a form
  // filled on a ticket lines up with the typed Risk record's scoring.
  const framework = await prisma.riskFramework.findUnique({
    where: { code: 'ICH_Q9_5X5' },
    include: { factors: { include: { levels: { orderBy: { rank: 'asc' } } }, orderBy: { order: 'asc' } } },
  });
  if (!framework) {
    throw new Error(
      'Missing risk framework "ICH_Q9_5X5". Run the risk master seed first (npm run db:seed:risk).',
    );
  }
  const scaleOptions = (factorKey: string) => {
    const factor = framework.factors.find((f) => f.key === factorKey);
    if (!factor) return [];
    return factor.levels.map((l) => ({ label: `${l.rank} — ${l.label}`, value: String(l.rank) }));
  };

  // ── Risk Management WorkflowType ─────────────────────────────────────────
  // Named "Risk Management". The sidebar's pickIcon/groupForModule and the
  // analytics registry all normalise to "riskmanagement" (analytics also still
  // matches "risk"); Sidebar.tsx carries the matching ICON_BY_KEY / MODULE_GROUP
  // entries and the seeded iconConfig ('shield-alert') is used first regardless.
  // Migrate any pre-existing "Risk" type from earlier seed runs to the new name
  // so re-running never leaves a duplicate.
  const legacy = await prisma.workflowType.findUnique({ where: { name: 'Risk' } });
  if (legacy) {
    await prisma.workflowType.update({
      where: { id: legacy.id },
      data: { name: 'Risk Management' },
    });
  }
  const riskType = await prisma.workflowType.upsert({
    where: { name: 'Risk Management' },
    update: {},
    create: {
      name: 'Risk Management',
      codePrefix: 'RSK',
      supportsFindings: true,
      iconConfig: { create: { iconName: 'shield-alert' } },
    },
  });

  // ── Per-stage forms ──────────────────────────────────────────────────────
  type FieldSpec = {
    fieldId: string;
    name: string;
    label: string;
    typeId: string | null;
    typeName: string;
    required?: boolean;
    width?: string;
    options?: Array<{ label: string; value: string }>;
  };

  const sel = (values: string[]) => values.map((v) => ({ label: v, value: v }));

  // Idempotent by templateKey — returns the existing form id on re-seed.
  const upsertForm = async (
    templateKey: string,
    title: string,
    description: string,
    sectionName: string,
    fields: FieldSpec[],
  ): Promise<string> => {
    const existing = await prisma.form.findFirst({
      where: { templateKey, version: 1 },
      select: { id: true },
    });
    if (existing) return existing.id;

    const form = await prisma.form.create({
      data: {
        templateKey,
        title,
        description,
        version: 1,
        versionId: `${templateKey}-v1`,
        status: 'PUBLISHED',
        kind: 'FORM',
        workflowType: 'Risk Management',
      },
      select: { id: true },
    });
    const section = await prisma.formSection.create({
      data: { formId: form.id, sectionId: `sec-${templateKey}`, name: sectionName, position: 0 },
      select: { id: true },
    });
    for (const [i, f] of fields.entries()) {
      await prisma.formField.create({
        data: {
          sectionId: section.id,
          fieldId: f.fieldId,
          name: f.name,
          label: f.label,
          position: i,
          width: f.width ?? '100',
          required: f.required ?? false,
          typeId: f.typeId,
          typeName: f.typeName,
          options: f.options ? (f.options as unknown as Prisma.InputJsonValue) : undefined,
        },
      });
    }
    return form.id;
  };

  const identificationFormId = await upsertForm(
    'risk-identification',
    'Risk Identification',
    'What could go wrong, where, and who raised it (ICH Q9 — risk identification).',
    'Risk Identification',
    [
      { fieldId: 'f-title', name: 'riskTitle', label: 'Risk title', typeId: FT_TEXT, typeName: 'text', required: true },
      { fieldId: 'f-category', name: 'riskCategory', label: 'Risk category', typeId: FT_SELECT, typeName: 'select', required: true, width: '50', options: sel(['Patient / Consumer Safety', 'Product Quality', 'Data Integrity', 'Regulatory Compliance', 'Supply Chain', 'Equipment & Facilities', 'Environment, Health & Safety', 'IT & Cyber Security', 'Business & Financial']) },
      { fieldId: 'f-source', name: 'riskSource', label: 'Identified from', typeId: FT_SELECT, typeName: 'select', width: '50', options: sel(['Deviation', 'Audit finding', 'Change control', 'Complaint', 'OOS / OOT', 'Periodic review', 'Proactive assessment', 'Regulatory update']) },
      { fieldId: 'f-hazard', name: 'hazard', label: 'Hazard', typeId: FT_TEXTAREA, typeName: 'textarea', required: true },
      { fieldId: 'f-cause', name: 'cause', label: 'Potential cause(s)', typeId: FT_TEXTAREA, typeName: 'textarea' },
      { fieldId: 'f-consequence', name: 'consequence', label: 'Potential consequence(s)', typeId: FT_TEXTAREA, typeName: 'textarea', required: true },
      { fieldId: 'f-process', name: 'affectedProcess', label: 'Affected process / product / system', typeId: FT_TEXT, typeName: 'text', width: '50' },
      { fieldId: 'f-identifieddate', name: 'identifiedDate', label: 'Date identified', typeId: FT_DATE, typeName: 'date', required: true, width: '50' },
    ],
  );

  const assessmentFormId = await upsertForm(
    'risk-assessment',
    'Risk Assessment',
    'Initial risk analysis and evaluation against the approved scoring scales (ICH Q9 5x5).',
    'Risk Assessment',
    [
      { fieldId: 'f-method', name: 'assessmentMethod', label: 'Assessment methodology', typeId: FT_SELECT, typeName: 'select', required: true, width: '50', options: sel(['Risk Matrix', 'FMEA', 'FMECA', 'HACCP', 'HAZOP', 'PHA', 'Risk Ranking & Filtering']) },
      { fieldId: 'f-team', name: 'assessmentTeam', label: 'Assessment team', typeId: FT_TEXTAREA, typeName: 'textarea', required: true },
      { fieldId: 'f-severity', name: 'initialSeverity', label: 'Severity (S)', typeId: FT_SELECT, typeName: 'select', required: true, width: '50', options: scaleOptions('S') },
      { fieldId: 'f-probability', name: 'initialProbability', label: 'Probability (P)', typeId: FT_SELECT, typeName: 'select', required: true, width: '50', options: scaleOptions('P') },
      { fieldId: 'f-rationale', name: 'scoringRationale', label: 'Scoring rationale', typeId: FT_TEXTAREA, typeName: 'textarea', required: true },
      { fieldId: 'f-existing', name: 'existingControls', label: 'Existing controls', typeId: FT_TEXTAREA, typeName: 'textarea' },
      { fieldId: 'f-acceptable', name: 'initiallyAcceptable', label: 'Acceptable without further control?', typeId: FT_SWITCH, typeName: 'switch', width: '50' },
    ],
  );

  const planningFormId = await upsertForm(
    'risk-control-planning',
    'Risk Control Plan',
    'Risk reduction strategy and the controls selected (ICH Q9 — risk control).',
    'Risk Control Plan',
    [
      { fieldId: 'f-strategy', name: 'treatmentStrategy', label: 'Treatment strategy', typeId: FT_SELECT, typeName: 'select', required: true, width: '50', options: sel(['Avoid', 'Reduce', 'Transfer', 'Accept']) },
      { fieldId: 'f-hierarchy', name: 'controlHierarchy', label: 'Control hierarchy level', typeId: FT_SELECT, typeName: 'select', width: '50', options: sel(['Elimination', 'Substitution', 'Engineering control', 'Administrative control', 'PPE', 'Inherent safety by design', 'Protective measure', 'Information for safety']) },
      { fieldId: 'f-controls', name: 'proposedControls', label: 'Proposed control measures', typeId: FT_TEXTAREA, typeName: 'textarea', required: true },
      { fieldId: 'f-owner', name: 'controlOwner', label: 'Control owner', typeId: FT_TEXT, typeName: 'text', width: '50' },
      { fieldId: 'f-target', name: 'targetDate', label: 'Target implementation date', typeId: FT_DATE, typeName: 'date', required: true, width: '50' },
      { fieldId: 'f-targetscore', name: 'targetRiskScore', label: 'Target risk score after control', typeId: FT_NUMBER, typeName: 'number', width: '50' },
      { fieldId: 'f-capa', name: 'capaRequired', label: 'CAPA required?', typeId: FT_SWITCH, typeName: 'switch', width: '50' },
    ],
  );

  const implementationFormId = await upsertForm(
    'risk-control-implementation',
    'Control Implementation Record',
    'Evidence that the selected controls were implemented as planned.',
    'Implementation',
    [
      { fieldId: 'f-implemented', name: 'controlsImplemented', label: 'Controls implemented', typeId: FT_TEXTAREA, typeName: 'textarea', required: true },
      { fieldId: 'f-evidence', name: 'evidence', label: 'Objective evidence / references', typeId: FT_TEXTAREA, typeName: 'textarea', required: true },
      { fieldId: 'f-docs', name: 'documentsUpdated', label: 'SOPs / documents updated', typeId: FT_TEXTAREA, typeName: 'textarea' },
      { fieldId: 'f-training', name: 'trainingCompleted', label: 'Training completed?', typeId: FT_SWITCH, typeName: 'switch', width: '50' },
      { fieldId: 'f-actual', name: 'actualCompletionDate', label: 'Actual completion date', typeId: FT_DATE, typeName: 'date', required: true, width: '50' },
      { fieldId: 'f-deviations', name: 'deviationsFromPlan', label: 'Deviations from the plan', typeId: FT_TEXTAREA, typeName: 'textarea' },
    ],
  );

  const residualFormId = await upsertForm(
    'risk-residual-review',
    'Residual Risk Review',
    'Re-scoring after controls, and confirmation the controls are effective.',
    'Residual Risk Review',
    [
      { fieldId: 'f-effective', name: 'controlsEffective', label: 'Are the controls effective?', typeId: FT_SWITCH, typeName: 'switch', required: true, width: '50' },
      { fieldId: 'f-verification', name: 'verificationMethod', label: 'Effectiveness verification method', typeId: FT_TEXTAREA, typeName: 'textarea', required: true },
      { fieldId: 'f-rseverity', name: 'residualSeverity', label: 'Residual severity (S)', typeId: FT_SELECT, typeName: 'select', required: true, width: '50', options: scaleOptions('S') },
      { fieldId: 'f-rprobability', name: 'residualProbability', label: 'Residual probability (P)', typeId: FT_SELECT, typeName: 'select', required: true, width: '50', options: scaleOptions('P') },
      { fieldId: 'f-rrationale', name: 'residualRationale', label: 'Residual scoring rationale', typeId: FT_TEXTAREA, typeName: 'textarea', required: true },
      { fieldId: 'f-newrisks', name: 'newRisksIntroduced', label: 'New risks introduced by the controls', typeId: FT_TEXTAREA, typeName: 'textarea' },
    ],
  );

  const acceptanceFormId = await upsertForm(
    'risk-acceptance',
    'Risk Acceptance & Closure',
    'Formal QA acceptance of residual risk and the periodic review commitment.',
    'Acceptance & Closure',
    [
      { fieldId: 'f-decision', name: 'acceptanceDecision', label: 'Acceptance decision', typeId: FT_SELECT, typeName: 'select', required: true, width: '50', options: sel(['Accept', 'Accept with conditions', 'Reject — further control required']) },
      { fieldId: 'f-justification', name: 'acceptanceJustification', label: 'Acceptance justification', typeId: FT_TEXTAREA, typeName: 'textarea', required: true },
      { fieldId: 'f-benefitrisk', name: 'benefitRiskRationale', label: 'Benefit-risk rationale (if residual risk remains unacceptable)', typeId: FT_TEXTAREA, typeName: 'textarea' },
      { fieldId: 'f-communicated', name: 'riskCommunicated', label: 'Risk communicated to stakeholders?', typeId: FT_SWITCH, typeName: 'switch', width: '50' },
      { fieldId: 'f-reviewdate', name: 'nextReviewDate', label: 'Next periodic review date', typeId: FT_DATE, typeName: 'date', required: true, width: '50' },
      { fieldId: 'f-approver', name: 'qaApprover', label: 'QA approver', typeId: FT_TEXT, typeName: 'text', required: true, width: '50' },
      { fieldId: 'f-closuredate', name: 'closureDate', label: 'Closure date', typeId: FT_DATE, typeName: 'date', required: true, width: '50' },
    ],
  );

  // ── Risk Management v1 workflow ──────────────────────────────────────────
  const existingWf = await prisma.workflow.findFirst({ where: { name: 'Risk Management v1' } });
  if (existingWf) {
    console.log('    "Risk Management v1" already exists — forms ensured, workflow left as-is.');
  } else {
    const roleConnect = (names: string[] = []) =>
      names
        .map((n) => roleByName.get(n))
        .filter((id): id is string => Boolean(id))
        .map((id) => ({ id }));

    await prisma.$transaction(
      async (tx) => {
        const wf = await tx.workflow.create({
          data: {
            name: 'Risk Management v1',
            typeId: riskType.id,
            status: 'APPROVED',
            workflowStatus: 'ACTIVE',
            createdById: adminUser?.id ?? null,
          },
        });

        const mkStage = (name: string, canonicalId: string, isInitialStage = false) =>
          tx.workflowStage.create({
            data: { workflowId: wf.id, name, canonicalId, isInitialStage, stageType: 'STAGE' },
          });

        // The ICH Q9 cycle: identify -> assess -> control -> implement ->
        // review residual -> accept & close.
        const identification = await mkStage('Risk Identification', 'risk-identification', true);
        const assessment = await mkStage('Risk Assessment', 'risk-assessment');
        const planning = await mkStage('Risk Control Planning', 'risk-control-planning');
        const implementation = await mkStage('Control Implementation', 'risk-control-implementation');
        const residual = await mkStage('Residual Risk Review', 'risk-residual-review');
        const acceptance = await mkStage('Risk Acceptance & Closure', 'risk-acceptance');

        const stages = [identification, assessment, planning, implementation, residual, acceptance];

        for (const s of stages) {
          await tx.workflowStageAction.create({
            data: { workflowStageId: s.id, workflowActionId: approveStatus.id, isPrimary: true },
          });
        }
        // A Return option on the working stages lets a reviewer send the risk
        // back — e.g. QA rejecting a residual score that is not justified.
        if (returnStatus) {
          for (const s of [assessment, planning, implementation, residual]) {
            await tx.workflowStageAction.create({
              data: { workflowStageId: s.id, workflowActionId: returnStatus.id, isPrimary: false },
            });
          }
        }

        const transition = (from: { id: string }, to: { id: string }) =>
          tx.workflowTransition.create({
            data: { workflowId: wf.id, fromStageId: from.id, toStageId: to.id, branchOrder: 0 },
          });
        await transition(identification, assessment);
        await transition(assessment, planning);
        await transition(planning, implementation);
        await transition(implementation, residual);
        await transition(residual, acceptance);

        const bind = (stageId: string, formId: string, fillRoles: string[], viewRoles: string[]) =>
          tx.stageFormBinding.create({
            data: {
              workflowId: wf.id,
              stageId,
              formId,
              isRequired: true,
              position: 0,
              fillMode: 'ANYONE',
              allowedFillRoles: { connect: roleConnect(fillRoles) },
              allowedViewRoles: { connect: roleConnect(viewRoles) },
            },
          });

        // QE performs the assessment and implementation work; QA (QMS_ADMIN)
        // owns the residual review and the acceptance decision.
        await bind(identification.id, identificationFormId, ['QUALITY_ENGINEER'], ['QMS_ADMIN', 'AUDITOR']);
        await bind(assessment.id, assessmentFormId, ['QUALITY_ENGINEER'], ['QMS_ADMIN', 'AUDITOR']);
        await bind(planning.id, planningFormId, ['QUALITY_ENGINEER'], ['QMS_ADMIN', 'AUDITOR']);
        await bind(implementation.id, implementationFormId, ['QUALITY_ENGINEER'], ['QMS_ADMIN', 'AUDITOR']);
        await bind(residual.id, residualFormId, ['QMS_ADMIN'], ['QUALITY_ENGINEER', 'AUDITOR']);
        await bind(acceptance.id, acceptanceFormId, ['QMS_ADMIN'], ['QUALITY_ENGINEER', 'AUDITOR']);
      },
      { timeout: 30_000, maxWait: 5_000 },
    );
  }

  console.log(
    '✅  Risk workflow ready: WorkflowType "Risk Management" (RSK) + 6 stages ' +
      '(Identification → Acceptance & Closure) + 6 required stage forms.',
  );
  console.log(
    '    The sidebar will now show a "Risk Management" entry for anyone holding wf_type.<id>.read.',
  );
}

main()
  .catch((e) => {
    console.error('❌  Risk workflow seed failed:', e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
