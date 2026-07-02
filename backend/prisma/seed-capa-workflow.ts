/**
 * Standalone, production-safe seed for the CAPA dynamic workflow.
 *
 * Seeds ONLY the `CAPA` WorkflowType, the `CAPA Handling v1` workflow (6 stages),
 * and its 6 per-stage forms. It does NOT touch users, roles, permissions or any
 * demo data — so it is safe to run against production. It looks up its
 * dependencies (workflow stage statuses, built-in field types, roles) that the
 * base seed already created; if those are missing it exits with a clear message.
 *
 * Idempotent: guarded by WorkflowType name, workflow name and form templateKey,
 * so re-running is a no-op.
 *
 *   Run:  npm run db:seed:capa      (backend workspace)
 *   or:   npx tsx prisma/seed-capa-workflow.ts
 */
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱  Seeding CAPA workflow + per-stage forms (standalone)...');

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

  const FT_TEXT = (await prisma.fieldType.findUnique({ where: { name: 'text' } }))?.id ?? null;
  const FT_TEXTAREA = (await prisma.fieldType.findUnique({ where: { name: 'textarea' } }))?.id ?? null;
  const FT_SELECT = (await prisma.fieldType.findUnique({ where: { name: 'select' } }))?.id ?? null;
  const FT_DATE = (await prisma.fieldType.findUnique({ where: { name: 'date' } }))?.id ?? null;
  const FT_SWITCH = (await prisma.fieldType.findUnique({ where: { name: 'switch' } }))?.id ?? null;
  if (!FT_TEXT || !FT_TEXTAREA || !FT_SELECT || !FT_DATE || !FT_SWITCH) {
    throw new Error(
      'Missing one or more built-in field types (text/textarea/select/date/switch). ' +
        'Run the base seed once first (npm run db:seed).',
    );
  }

  const roleByName = new Map((await prisma.role.findMany()).map((r) => [r.name, r.id]));
  const adminUser = await prisma.user.findFirst({
    where: { email: 'info@forgequantumsolution.com' },
    select: { id: true },
  });

  // ── CAPA WorkflowType ────────────────────────────────────────────────────
  const capaType = await prisma.workflowType.upsert({
    where: { name: 'CAPA' },
    update: {},
    create: {
      name: 'CAPA',
      codePrefix: 'CAPA',
      iconConfig: { create: { iconName: 'shield-check' } },
    },
  });

  // ── Per-stage forms ──────────────────────────────────────────────────────
  type CapaFieldSpec = {
    fieldId: string;
    name: string;
    label: string;
    typeId: string | null;
    typeName: string;
    required?: boolean;
    width?: string;
    options?: Array<{ label: string; value: string }>;
  };

  // Idempotent by templateKey — returns the existing form id on re-seed.
  const upsertCapaForm = async (
    templateKey: string,
    title: string,
    description: string,
    sectionName: string,
    fields: CapaFieldSpec[],
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
        workflowType: 'CAPA',
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

  const sel = (opts: string[]) => opts.map((o) => ({ label: o, value: o }));

  const capaInitiationFormId = await upsertCapaForm(
    'capa-initiation',
    'CAPA Initiation',
    'Problem statement and classification captured when the CAPA is raised.',
    'Initiation',
    [
      { fieldId: 'f-problem', name: 'problemStatement', label: 'Problem statement', typeId: FT_TEXTAREA, typeName: 'textarea', required: true },
      { fieldId: 'f-source', name: 'source', label: 'Source', typeId: FT_SELECT, typeName: 'select', required: true, width: '50', options: sel(['Non-Conformance', 'Audit Finding', 'Customer Complaint', 'Deviation', 'OOS', 'Internal']) },
      { fieldId: 'f-type', name: 'capaType', label: 'CAPA type', typeId: FT_SELECT, typeName: 'select', required: true, width: '50', options: sel(['Corrective', 'Preventive', 'Both']) },
      { fieldId: 'f-severity', name: 'severity', label: 'Severity', typeId: FT_SELECT, typeName: 'select', required: true, width: '50', options: sel(['Critical', 'Major', 'Minor']) },
      { fieldId: 'f-process', name: 'affectedProcess', label: 'Affected product / process', typeId: FT_TEXT, typeName: 'text', width: '50' },
      { fieldId: 'f-detected', name: 'dateDetected', label: 'Date detected', typeId: FT_DATE, typeName: 'date', width: '50' },
    ],
  );

  const capaRcaFormId = await upsertCapaForm(
    'capa-rca',
    'Root Cause Analysis',
    'Investigation and 5-Why analysis leading to a confirmed root cause.',
    'Investigation & Root Cause',
    [
      { fieldId: 'f-invsum', name: 'investigationSummary', label: 'Investigation summary', typeId: FT_TEXTAREA, typeName: 'textarea', required: true },
      { fieldId: 'f-why1', name: 'why1', label: 'Why 1', typeId: FT_TEXT, typeName: 'text' },
      { fieldId: 'f-why2', name: 'why2', label: 'Why 2', typeId: FT_TEXT, typeName: 'text' },
      { fieldId: 'f-why3', name: 'why3', label: 'Why 3', typeId: FT_TEXT, typeName: 'text' },
      { fieldId: 'f-why4', name: 'why4', label: 'Why 4', typeId: FT_TEXT, typeName: 'text' },
      { fieldId: 'f-why5', name: 'why5', label: 'Why 5', typeId: FT_TEXT, typeName: 'text' },
      { fieldId: 'f-category', name: 'rootCauseCategory', label: 'Root cause category', typeId: FT_SELECT, typeName: 'select', required: true, width: '50', options: sel(['Man', 'Machine', 'Material', 'Method', 'Measurement', 'Environment']) },
      { fieldId: 'f-rootcause', name: 'confirmedRootCause', label: 'Confirmed root cause', typeId: FT_TEXTAREA, typeName: 'textarea', required: true },
    ],
  );

  const capaPlanFormId = await upsertCapaForm(
    'capa-action-plan',
    'CAPA Action Plan',
    'Corrective and preventive actions with owners and target dates.',
    'Action Plan',
    [
      { fieldId: 'f-corrective', name: 'correctiveActions', label: 'Corrective actions', typeId: FT_TEXTAREA, typeName: 'textarea', required: true },
      { fieldId: 'f-preventive', name: 'preventiveActions', label: 'Preventive actions', typeId: FT_TEXTAREA, typeName: 'textarea', required: true },
      { fieldId: 'f-responsible', name: 'responsiblePerson', label: 'Responsible person', typeId: FT_TEXT, typeName: 'text', width: '50' },
      { fieldId: 'f-target', name: 'targetDate', label: 'Target completion date', typeId: FT_DATE, typeName: 'date', required: true, width: '50' },
      { fieldId: 'f-risk', name: 'riskIfNotDone', label: 'Risk if not implemented', typeId: FT_SELECT, typeName: 'select', width: '50', options: sel(['High', 'Medium', 'Low']) },
    ],
  );

  const capaImplFormId = await upsertCapaForm(
    'capa-implementation',
    'Implementation Record',
    'Record of actions completed and the objective evidence.',
    'Implementation',
    [
      { fieldId: 'f-done', name: 'actionsCompleted', label: 'Actions completed', typeId: FT_TEXTAREA, typeName: 'textarea', required: true },
      { fieldId: 'f-evidence', name: 'evidence', label: 'Evidence / references', typeId: FT_TEXTAREA, typeName: 'textarea' },
      { fieldId: 'f-actual', name: 'actualCompletionDate', label: 'Actual completion date', typeId: FT_DATE, typeName: 'date', required: true, width: '50' },
      { fieldId: 'f-deviation', name: 'deviationsFromPlan', label: 'Deviations from plan', typeId: FT_TEXTAREA, typeName: 'textarea' },
    ],
  );

  const capaEffFormId = await upsertCapaForm(
    'capa-effectiveness',
    'Effectiveness Verification',
    'Verification that the root cause was eliminated over the 30/60/90-day window.',
    'Effectiveness Verification',
    [
      { fieldId: 'f-method', name: 'verificationMethod', label: 'Verification method', typeId: FT_TEXTAREA, typeName: 'textarea', required: true },
      { fieldId: 'f-c30', name: 'check30', label: '30-day check', typeId: FT_SELECT, typeName: 'select', width: '33', options: sel(['Pending', 'Pass', 'Fail']) },
      { fieldId: 'f-c60', name: 'check60', label: '60-day check', typeId: FT_SELECT, typeName: 'select', width: '33', options: sel(['Pending', 'Pass', 'Fail']) },
      { fieldId: 'f-c90', name: 'check90', label: '90-day check', typeId: FT_SELECT, typeName: 'select', width: '33', options: sel(['Pending', 'Pass', 'Fail']) },
      { fieldId: 'f-conclusion', name: 'effectivenessConclusion', label: 'Effectiveness conclusion', typeId: FT_TEXTAREA, typeName: 'textarea', required: true },
    ],
  );

  const capaClosureFormId = await upsertCapaForm(
    'capa-closure',
    'CAPA Closure',
    'Final QA sign-off and closure of the CAPA.',
    'Closure',
    [
      { fieldId: 'f-summary', name: 'closureSummary', label: 'Closure summary', typeId: FT_TEXTAREA, typeName: 'textarea', required: true },
      { fieldId: 'f-residual', name: 'residualRiskAcceptable', label: 'Residual risk acceptable?', typeId: FT_SWITCH, typeName: 'switch', width: '50' },
      { fieldId: 'f-approver', name: 'qaApprover', label: 'QA approver', typeId: FT_TEXT, typeName: 'text', required: true, width: '50' },
      { fieldId: 'f-closuredate', name: 'closureDate', label: 'Closure date', typeId: FT_DATE, typeName: 'date', required: true, width: '50' },
    ],
  );

  // ── CAPA Handling v1 workflow ────────────────────────────────────────────
  const existingCapaWf = await prisma.workflow.findFirst({ where: { name: 'CAPA Handling v1' } });
  if (existingCapaWf) {
    console.log('    "CAPA Handling v1" already exists — forms ensured, workflow left as-is.');
  } else {
    const roleConnectC = (names: string[] = []) =>
      names
        .map((n) => roleByName.get(n))
        .filter((id): id is string => Boolean(id))
        .map((id) => ({ id }));
    await prisma.$transaction(
      async (tx) => {
        const wf = await tx.workflow.create({
          data: {
            name: 'CAPA Handling v1',
            typeId: capaType.id,
            status: 'APPROVED',
            workflowStatus: 'ACTIVE',
            createdById: adminUser?.id ?? null,
          },
        });

        const mkStage = (name: string, canonicalId: string, isInitialStage = false) =>
          tx.workflowStage.create({
            data: { workflowId: wf.id, name, canonicalId, isInitialStage, stageType: 'STAGE' },
          });

        const initiation = await mkStage('Initiation', 'capa-initiation', true);
        const investigation = await mkStage('Investigation & Root Cause', 'capa-investigation');
        const plan = await mkStage('Action Plan', 'capa-action-plan');
        const implementation = await mkStage('Implementation', 'capa-implementation');
        const verification = await mkStage('Effectiveness Verification', 'capa-verification');
        const closure = await mkStage('Closure', 'capa-closure');

        // Primary Approve/Forward on every stage; a Return option on the mid
        // stages lets a reviewer send the CAPA back for more work.
        for (const s of [initiation, investigation, plan, implementation, verification, closure]) {
          await tx.workflowStageAction.create({
            data: { workflowStageId: s.id, workflowActionId: approveStatus.id, isPrimary: true },
          });
        }
        if (returnStatus) {
          for (const s of [investigation, plan, implementation, verification]) {
            await tx.workflowStageAction.create({
              data: { workflowStageId: s.id, workflowActionId: returnStatus.id, isPrimary: false },
            });
          }
        }

        // Linear transitions Initiation → … → Closure.
        const transition = (from: { id: string }, to: { id: string }) =>
          tx.workflowTransition.create({
            data: { workflowId: wf.id, fromStageId: from.id, toStageId: to.id, branchOrder: 0 },
          });
        await transition(initiation, investigation);
        await transition(investigation, plan);
        await transition(plan, implementation);
        await transition(implementation, verification);
        await transition(verification, closure);

        // Bind each stage's REQUIRED form. QE fills the working stages; QMS_ADMIN
        // signs off at Closure. Auditors get view access throughout.
        const bind = (stageId: string, formId: string, fillRoles: string[], viewRoles: string[]) =>
          tx.stageFormBinding.create({
            data: {
              workflowId: wf.id,
              stageId,
              formId,
              isRequired: true,
              position: 0,
              fillMode: 'ANYONE',
              allowedFillRoles: { connect: roleConnectC(fillRoles) },
              allowedViewRoles: { connect: roleConnectC(viewRoles) },
            },
          });

        await bind(initiation.id, capaInitiationFormId, ['QUALITY_ENGINEER'], ['QMS_ADMIN', 'AUDITOR']);
        await bind(investigation.id, capaRcaFormId, ['QUALITY_ENGINEER'], ['QMS_ADMIN', 'AUDITOR']);
        await bind(plan.id, capaPlanFormId, ['QUALITY_ENGINEER'], ['QMS_ADMIN', 'AUDITOR']);
        await bind(implementation.id, capaImplFormId, ['QUALITY_ENGINEER'], ['QMS_ADMIN', 'AUDITOR']);
        await bind(verification.id, capaEffFormId, ['QUALITY_ENGINEER'], ['QMS_ADMIN', 'AUDITOR']);
        await bind(closure.id, capaClosureFormId, ['QMS_ADMIN'], ['QUALITY_ENGINEER', 'AUDITOR']);
      },
      { timeout: 30_000, maxWait: 5_000 },
    );
  }

  console.log('✅  CAPA workflow ready: 6 stages (Initiation → Closure) + 6 required stage forms.');
}

main()
  .catch((e) => {
    console.error('❌  CAPA workflow seed failed:', e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
