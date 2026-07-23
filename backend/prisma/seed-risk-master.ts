/**
 * Risk Management master data seed.
 *
 * Seeds three reference frameworks that between them cover the methodologies
 * most QMS tenants start from, plus a starter category taxonomy:
 *
 *   ICH_Q9_5X5   — pharma QRM, 5x5 Severity x Probability matrix (ICH Q9(R1))
 *   ISO_14971    — medical device, Severity x (P1 x P2) per ISO 14971:2019
 *   AIAG_VDA_FMEA— RPN-free FMEA with S/O/D and Action Priority (AIAG-VDA 1st ed.)
 *
 * Idempotent: re-running upserts by `code` and rewrites the child graph, so it
 * is safe to run against an environment that already has risks recorded — the
 * scales themselves do not change, only missing rows are filled in.
 *
 * Run with: npm run db:seed:risk
 */
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

type LevelSeed = {
  code: string;
  label: string;
  color: string;
  order: number;
  minScore: number | null;
  maxScore: number | null;
  acceptance: 'ACCEPTABLE' | 'ALARP' | 'UNACCEPTABLE';
  requiresCapa?: boolean;
  requiresApproval?: boolean;
  requiresControl?: boolean;
  reviewMonths?: number | null;
};

type FactorSeed = {
  kind: 'SEVERITY' | 'OCCURRENCE' | 'PROBABILITY' | 'DETECTABILITY' | 'EXPOSURE' | 'CUSTOM';
  key: string;
  label: string;
  description?: string;
  order: number;
  levels: { rank: number; label: string; definition: string; color?: string }[];
};

type FrameworkSeed = {
  code: string;
  name: string;
  description: string;
  standard: string;
  methodology: 'MATRIX' | 'FMEA' | 'FMECA';
  formula: 'PRODUCT' | 'ACTION_PRIORITY';
  isDefault: boolean;
  terminology?: Record<string, string>;
  fieldConfig?: Record<string, unknown>;
  factors: FactorSeed[];
  levels: LevelSeed[];
};

// Shared 1..5 severity anchors for the pharma matrix. The `definition` text is
// what makes a score defensible in an inspection, so it is seeded, not left blank.
const ICH_SEVERITY: FactorSeed = {
  kind: 'SEVERITY',
  key: 'S',
  label: 'Severity',
  description: 'Consequence to product quality, patient safety or data integrity',
  order: 0,
  levels: [
    { rank: 1, label: 'Negligible', definition: 'No impact on product quality or patient; cosmetic or administrative only.', color: '#22C55E' },
    { rank: 2, label: 'Minor', definition: 'Minor quality attribute affected; no impact on safety or efficacy; internally detectable.', color: '#84CC16' },
    { rank: 3, label: 'Moderate', definition: 'Product quality affected; potential batch rework or deviation; no patient harm expected.', color: '#F59E0B' },
    { rank: 4, label: 'Major', definition: 'Batch rejection, regulatory observation, or potential for reversible patient harm.', color: '#F97316' },
    { rank: 5, label: 'Critical', definition: 'Product recall, serious or irreversible patient harm, or critical regulatory finding.', color: '#EF4444' },
  ],
};

const ICH_PROBABILITY: FactorSeed = {
  kind: 'PROBABILITY',
  key: 'P',
  label: 'Probability',
  description: 'Likelihood of the hazard occurring within the review period',
  order: 1,
  levels: [
    { rank: 1, label: 'Rare', definition: 'Not known to have occurred; would require multiple failures. < 1 in 10,000 events.', color: '#22C55E' },
    { rank: 2, label: 'Unlikely', definition: 'Has occurred in the industry but not at this site. ~1 in 1,000 events.', color: '#84CC16' },
    { rank: 3, label: 'Possible', definition: 'Has occurred at this site historically. ~1 in 100 events.', color: '#F59E0B' },
    { rank: 4, label: 'Likely', definition: 'Occurs periodically; several occurrences per year. ~1 in 10 events.', color: '#F97316' },
    { rank: 5, label: 'Almost certain', definition: 'Occurs routinely; expected in most batches or runs. > 1 in 2 events.', color: '#EF4444' },
  ],
};

// 5x5 PRODUCT bands: 1..4 low, 5..9 medium, 10..14 high, 15..25 very high.
const ICH_LEVELS: LevelSeed[] = [
  { code: 'LOW', label: 'Low', color: '#22C55E', order: 0, minScore: 1, maxScore: 4, acceptance: 'ACCEPTABLE', reviewMonths: 24 },
  { code: 'MEDIUM', label: 'Medium', color: '#F59E0B', order: 1, minScore: 5, maxScore: 9, acceptance: 'ALARP', requiresControl: true, reviewMonths: 12 },
  { code: 'HIGH', label: 'High', color: '#F97316', order: 2, minScore: 10, maxScore: 14, acceptance: 'ALARP', requiresControl: true, requiresApproval: true, reviewMonths: 6 },
  { code: 'VERY_HIGH', label: 'Very High', color: '#EF4444', order: 3, minScore: 15, maxScore: 25, acceptance: 'UNACCEPTABLE', requiresControl: true, requiresApproval: true, requiresCapa: true, reviewMonths: 3 },
];

const FRAMEWORKS: FrameworkSeed[] = [
  {
    code: 'ICH_Q9_5X5',
    name: 'ICH Q9 — 5x5 Risk Matrix',
    description:
      'Quality Risk Management per ICH Q9(R1). Severity x Probability on 5-point anchored scales, ' +
      'with review cadence and CAPA escalation driven by the resulting risk level.',
    standard: 'ICH Q9(R1)',
    methodology: 'MATRIX',
    formula: 'PRODUCT',
    isDefault: true,
    terminology: { risk: 'Risk', hazard: 'Hazard', control: 'Control Measure', register: 'Risk Register' },
    fieldConfig: { showHazardChain: false, showCause: true, showConsequence: true },
    factors: [ICH_SEVERITY, ICH_PROBABILITY],
    levels: ICH_LEVELS,
  },
  {
    code: 'ISO_14971',
    name: 'ISO 14971 — Medical Device Risk',
    description:
      'Risk management for medical devices per ISO 14971:2019. Severity of harm x probability of ' +
      'occurrence of harm, with the hazard / hazardous-situation / harm chain captured explicitly.',
    standard: 'ISO 14971:2019',
    methodology: 'MATRIX',
    formula: 'PRODUCT',
    isDefault: false,
    terminology: { risk: 'Risk', hazard: 'Hazard', control: 'Risk Control Measure', register: 'Risk Management File' },
    fieldConfig: { showHazardChain: true, showCause: true, showConsequence: true, showBenefitRisk: true },
    factors: [
      {
        kind: 'SEVERITY',
        key: 'S',
        label: 'Severity of Harm',
        description: 'Measure of the possible consequences of a hazard (ISO 14971 §3.19)',
        order: 0,
        levels: [
          { rank: 1, label: 'Negligible', definition: 'Inconvenience or temporary discomfort; no injury.', color: '#22C55E' },
          { rank: 2, label: 'Minor', definition: 'Temporary injury or impairment not requiring medical intervention.', color: '#84CC16' },
          { rank: 3, label: 'Serious', definition: 'Injury or impairment requiring medical intervention.', color: '#F59E0B' },
          { rank: 4, label: 'Critical', definition: 'Permanent impairment or life-threatening injury.', color: '#F97316' },
          { rank: 5, label: 'Catastrophic', definition: 'Patient death.', color: '#EF4444' },
        ],
      },
      {
        kind: 'PROBABILITY',
        key: 'P',
        label: 'Probability of Harm',
        description: 'Combined P1 (hazardous situation occurs) x P2 (hazardous situation leads to harm)',
        order: 1,
        levels: [
          { rank: 1, label: 'Improbable', definition: 'So unlikely it can be assumed it will not occur. < 1e-6.', color: '#22C55E' },
          { rank: 2, label: 'Remote', definition: 'Unlikely but possible over the device lifetime. 1e-6 to 1e-4.', color: '#84CC16' },
          { rank: 3, label: 'Occasional', definition: 'Likely to occur some time over the device lifetime. 1e-4 to 1e-3.', color: '#F59E0B' },
          { rank: 4, label: 'Probable', definition: 'Will occur several times over the device lifetime. 1e-3 to 1e-1.', color: '#F97316' },
          { rank: 5, label: 'Frequent', definition: 'Likely to occur frequently in normal use. > 1e-1.', color: '#EF4444' },
        ],
      },
    ],
    levels: ICH_LEVELS,
  },
  {
    code: 'AIAG_VDA_FMEA',
    name: 'AIAG-VDA FMEA — Action Priority',
    description:
      'Process/design FMEA on 10-point Severity, Occurrence and Detection scales. Produces both a ' +
      'classic RPN (S x O x D) for sorting and an AIAG-VDA Action Priority (High / Medium / Low), ' +
      'which is the modern RPN-free basis for deciding what to act on.',
    standard: 'AIAG-VDA FMEA Handbook (1st ed.)',
    methodology: 'FMEA',
    formula: 'ACTION_PRIORITY',
    isDefault: false,
    terminology: { risk: 'Failure Mode', hazard: 'Failure Mode', control: 'Control', register: 'FMEA' },
    fieldConfig: { showHazardChain: false, showCause: true, showConsequence: true, showFmeaColumns: true },
    factors: [
      {
        kind: 'SEVERITY',
        key: 'S',
        label: 'Severity',
        description: 'Severity of the effect of the failure mode',
        order: 0,
        levels: [
          { rank: 1, label: 'None', definition: 'No discernible effect.', color: '#22C55E' },
          { rank: 2, label: 'Very Minor', definition: 'Defect noticed by discriminating customers only.', color: '#4ADE80' },
          { rank: 3, label: 'Minor', definition: 'Defect noticed by most customers; minor annoyance.', color: '#84CC16' },
          { rank: 4, label: 'Very Low', definition: 'Product operable at reduced performance; customer dissatisfied.', color: '#A3E635' },
          { rank: 5, label: 'Low', definition: 'Comfort or convenience item inoperable.', color: '#FACC15' },
          { rank: 6, label: 'Moderate', definition: 'Product operable but performance degraded; rework required.', color: '#F59E0B' },
          { rank: 7, label: 'High', definition: 'Product operable at significantly reduced performance.', color: '#FB923C' },
          { rank: 8, label: 'Very High', definition: 'Product inoperable with loss of primary function.', color: '#F97316' },
          { rank: 9, label: 'Hazardous with warning', definition: 'Potential safety or regulatory non-compliance, with warning.', color: '#EF4444' },
          { rank: 10, label: 'Hazardous without warning', definition: 'Potential safety or regulatory non-compliance, without warning.', color: '#DC2626' },
        ],
      },
      {
        kind: 'OCCURRENCE',
        key: 'O',
        label: 'Occurrence',
        description: 'Likelihood the cause occurs and produces the failure mode',
        order: 1,
        levels: [
          { rank: 1, label: 'Extremely low', definition: 'Failure eliminated by preventive control. < 1 in 1,500,000.', color: '#22C55E' },
          { rank: 2, label: 'Very low', definition: '1 in 150,000.', color: '#4ADE80' },
          { rank: 3, label: 'Low', definition: '1 in 15,000.', color: '#84CC16' },
          { rank: 4, label: 'Fairly low', definition: '1 in 2,000.', color: '#A3E635' },
          { rank: 5, label: 'Moderate', definition: '1 in 400.', color: '#FACC15' },
          { rank: 6, label: 'Fairly high', definition: '1 in 80.', color: '#F59E0B' },
          { rank: 7, label: 'High', definition: '1 in 20.', color: '#FB923C' },
          { rank: 8, label: 'Very high', definition: '1 in 8.', color: '#F97316' },
          { rank: 9, label: 'Extremely high', definition: '1 in 3.', color: '#EF4444' },
          { rank: 10, label: 'Almost inevitable', definition: '> 1 in 2.', color: '#DC2626' },
        ],
      },
      {
        kind: 'DETECTABILITY',
        key: 'D',
        label: 'Detection',
        description: 'Ability of current controls to detect the cause or failure mode before release',
        order: 2,
        levels: [
          { rank: 1, label: 'Almost certain', definition: 'Control will almost certainly detect; error-proofed.', color: '#22C55E' },
          { rank: 2, label: 'Very high', definition: 'Very high chance of detection by automated control.', color: '#4ADE80' },
          { rank: 3, label: 'High', definition: 'High chance of detection.', color: '#84CC16' },
          { rank: 4, label: 'Moderately high', definition: 'Moderately high chance of detection.', color: '#A3E635' },
          { rank: 5, label: 'Moderate', definition: 'Moderate chance of detection.', color: '#FACC15' },
          { rank: 6, label: 'Low', definition: 'Low chance of detection.', color: '#F59E0B' },
          { rank: 7, label: 'Very low', definition: 'Very low chance of detection.', color: '#FB923C' },
          { rank: 8, label: 'Remote', definition: 'Remote chance of detection; manual inspection only.', color: '#F97316' },
          { rank: 9, label: 'Very remote', definition: 'Very remote chance; no reliable control.', color: '#EF4444' },
          { rank: 10, label: 'Absolute uncertainty', definition: 'No control exists, or control will not detect.', color: '#DC2626' },
        ],
      },
    ],
    // 10x10x10 = 1..1000 RPN bands. Action Priority is computed alongside and is
    // what teams act on; these bands keep the register sortable and colourable.
    levels: [
      { code: 'LOW', label: 'Low', color: '#22C55E', order: 0, minScore: 1, maxScore: 49, acceptance: 'ACCEPTABLE', reviewMonths: 24 },
      { code: 'MEDIUM', label: 'Medium', color: '#F59E0B', order: 1, minScore: 50, maxScore: 99, acceptance: 'ALARP', requiresControl: true, reviewMonths: 12 },
      { code: 'HIGH', label: 'High', color: '#F97316', order: 2, minScore: 100, maxScore: 199, acceptance: 'ALARP', requiresControl: true, requiresApproval: true, reviewMonths: 6 },
      { code: 'VERY_HIGH', label: 'Very High', color: '#EF4444', order: 3, minScore: 200, maxScore: 1000, acceptance: 'UNACCEPTABLE', requiresControl: true, requiresApproval: true, requiresCapa: true, reviewMonths: 3 },
    ],
  },
];

const CATEGORIES: { code: string; name: string; description: string; color: string }[] = [
  { code: 'PATIENT_SAFETY', name: 'Patient / Consumer Safety', description: 'Risks with potential to cause harm to the patient or end consumer', color: '#DC2626' },
  { code: 'PRODUCT_QUALITY', name: 'Product Quality', description: 'Risks to product identity, strength, purity, potency or stability', color: '#F97316' },
  { code: 'DATA_INTEGRITY', name: 'Data Integrity', description: 'ALCOA+ risks to records, electronic systems and audit trails', color: '#8B5CF6' },
  { code: 'REGULATORY', name: 'Regulatory Compliance', description: 'Risks of non-compliance with GxP, submissions or inspection commitments', color: '#3B82F6' },
  { code: 'SUPPLY_CHAIN', name: 'Supply Chain', description: 'Supplier, material availability, logistics and cold-chain risks', color: '#0EA5E9' },
  { code: 'EQUIPMENT', name: 'Equipment & Facilities', description: 'Asset reliability, calibration, qualification and utilities risks', color: '#14B8A6' },
  { code: 'EHS', name: 'Environment, Health & Safety', description: 'Occupational health, safety and environmental risks (ISO 45001 / 14001)', color: '#22C55E' },
  { code: 'IT_CYBER', name: 'IT & Cyber Security', description: 'System availability, access control and information-security risks', color: '#6366F1' },
  { code: 'BUSINESS', name: 'Business & Financial', description: 'Enterprise, financial, reputational and continuity risks (ISO 31000)', color: '#64748B' },
];

const seedFramework = async (seed: FrameworkSeed) => {
  const existing = await prisma.riskFramework.findUnique({ where: { code: seed.code } });

  const framework = existing
    ? await prisma.riskFramework.update({
        where: { code: seed.code },
        data: {
          name: seed.name,
          description: seed.description,
          standard: seed.standard,
          methodology: seed.methodology,
          formula: seed.formula,
          isDefault: seed.isDefault,
          terminology: (seed.terminology ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          fieldConfig: (seed.fieldConfig ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        },
      })
    : await prisma.riskFramework.create({
        data: {
          code: seed.code,
          name: seed.name,
          description: seed.description,
          standard: seed.standard,
          methodology: seed.methodology,
          formula: seed.formula,
          isDefault: seed.isDefault,
          terminology: (seed.terminology ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          fieldConfig: (seed.fieldConfig ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        },
      });

  // Rewrite the child graph. Cells first — they FK onto levels.
  await prisma.riskMatrixCell.deleteMany({ where: { frameworkId: framework.id } });
  await prisma.riskFactor.deleteMany({ where: { frameworkId: framework.id } });
  await prisma.riskLevelDef.deleteMany({ where: { frameworkId: framework.id } });

  for (const factor of seed.factors) {
    await prisma.riskFactor.create({
      data: {
        frameworkId: framework.id,
        kind: factor.kind,
        key: factor.key,
        label: factor.label,
        description: factor.description ?? null,
        order: factor.order,
        levels: {
          create: factor.levels.map((l) => ({
            rank: l.rank,
            label: l.label,
            definition: l.definition,
            color: l.color ?? null,
          })),
        },
      },
    });
  }

  for (const level of seed.levels) {
    await prisma.riskLevelDef.create({
      data: {
        frameworkId: framework.id,
        code: level.code,
        label: level.label,
        color: level.color,
        order: level.order,
        minScore: level.minScore,
        maxScore: level.maxScore,
        acceptance: level.acceptance,
        requiresCapa: level.requiresCapa ?? false,
        requiresApproval: level.requiresApproval ?? false,
        requiresControl: level.requiresControl ?? false,
        reviewMonths: level.reviewMonths ?? null,
      },
    });
  }

  console.log(
    `  ${existing ? 'updated' : 'created'} ${seed.code} — ${seed.factors.length} factors, ${seed.levels.length} levels`,
  );
};

const main = async () => {
  console.log('Seeding Risk Management master data...');

  console.log('Frameworks:');
  for (const seed of FRAMEWORKS) {
    await seedFramework(seed);
  }

  // Exactly one default, regardless of what was there before.
  const defaultSeed = FRAMEWORKS.find((f) => f.isDefault);
  if (defaultSeed) {
    const def = await prisma.riskFramework.findUnique({ where: { code: defaultSeed.code } });
    if (def) {
      await prisma.riskFramework.updateMany({ where: { id: { not: def.id } }, data: { isDefault: false } });
    }
  }

  console.log('Categories:');
  for (const cat of CATEGORIES) {
    const existing = await prisma.riskCategory.findUnique({ where: { code: cat.code } });
    if (existing) {
      await prisma.riskCategory.update({
        where: { code: cat.code },
        data: { name: cat.name, description: cat.description, color: cat.color },
      });
    } else {
      await prisma.riskCategory.create({
        data: { code: cat.code, name: cat.name, description: cat.description, color: cat.color },
      });
    }
    console.log(`  ${existing ? 'updated' : 'created'} ${cat.code}`);
  }

  console.log('Risk master data seed complete.');
};

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
