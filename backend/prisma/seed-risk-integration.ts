/**
 * Risk cross-module integration demo data.
 *
 * The risk module can already score, treat, review and accept a risk. What this
 * seed demonstrates is the part that makes it a QMS module rather than an app:
 * a risk reaching *out* into the documents that control it, the equipment and
 * suppliers it applies to, the CAPAs that mitigate it, the training that
 * enforces it and the audits that evidence it — and every one of those records
 * being able to answer "how risky am I?" without knowing anything about risk.
 *
 *   npm run db:seed:risk-integration     (from the backend workspace)
 *
 * Prerequisites: `npm run db:seed:risk` (frameworks) and `npm run db:seed:risk-data`
 * (the demo risks). This script links what already exists; it invents only the
 * suppliers, because supplier risk tiering is one of the headline integrations
 * and the LIMS demo data ships with no suppliers at all.
 *
 * Idempotent. Links are keyed on (risk, entityType, entityId, relation) and
 * found-or-created, so re-running changes nothing. Nothing is ever deleted.
 *
 * Every link below is a real quality relationship, not filler — the SOP that
 * controls the hazard, the course that keeps the control effective, the supplier
 * the risk actually sits with. That matters because the seed doubles as the
 * worked example of how the module is meant to be used.
 *
 * See docs/RISK-cross-module-integration-plan.md.
 */
import { PrismaClient } from '@prisma/client';
import { recomputeProfile } from '../src/modules/risk/risk-profile.service';

const prisma = new PrismaClient();

/** Relations the risk module recognises (see RiskDetailPage LINK_RELATIONS). */
type Relation = 'CAUSED_BY' | 'MITIGATED_BY' | 'APPLIES_TO' | 'EVIDENCE' | 'ESCALATED_TO';

/**
 * Suppliers to guarantee. The LIMS demo data has none, and a supplier register
 * with nothing in it cannot demonstrate risk-based supplier tiering.
 */
const SUPPLIERS = [
  { code: 'SUP-001', name: 'Hanwha Fine Chemicals', country: 'South Korea', contactName: 'Ji-woo Park' },
  { code: 'SUP-002', name: 'Nordwest Sterile Components', country: 'Germany', contactName: 'Lena Brandt' },
  { code: 'SUP-003', name: 'Meridian Contract Packaging', country: 'India', contactName: 'Rohan Iyer' },
];

/**
 * The link map. `risk` and `ref` are human reference numbers, never ids, so this
 * file stays readable and survives a reseed. `why` is not stored — it documents
 * the quality rationale for the reader, which is the point of a worked example.
 */
const LINKS: { risk: string; type: string; ref: string; relation: Relation; why: string }[] = [
  // ── Sterility assurance ──────────────────────────────────────────────────
  { risk: 'RISK-2025-0001', type: 'Document', ref: 'DOC-2026-0007', relation: 'MITIGATED_BY',
    why: 'EM of classified areas is the detective control for airflow disruption' },
  { risk: 'RISK-2025-0001', type: 'Document', ref: 'DOC-2026-0012', relation: 'EVIDENCE',
    why: 'Terminal sterilisation validation protocol evidences the assurance claim' },

  // ── Cross-contamination ──────────────────────────────────────────────────
  { risk: 'RISK-2025-0002', type: 'Document', ref: 'DOC-2026-0008', relation: 'MITIGATED_BY',
    why: 'Cleaning validation SOP is the primary control on shared product contact parts' },
  { risk: 'RISK-2025-0002', type: 'Capa', ref: 'CAPA-2026-0002', relation: 'MITIGATED_BY',
    why: 'CAPA raised against the cleaning validation policy gap' },

  // ── Environmental monitoring ─────────────────────────────────────────────
  { risk: 'RISK-2025-0003', type: 'Document', ref: 'DOC-2026-0007', relation: 'MITIGATED_BY',
    why: 'The EM SOP defines the excursion response this risk depends on' },
  { risk: 'RISK-2025-0003', type: 'LmsCourse', ref: 'CRS-DEMO-004', relation: 'MITIGATED_BY',
    why: 'Cleanroom behaviour training is the administrative control' },

  // ── Aseptic technique decay — the training-as-a-control case ─────────────
  { risk: 'RISK-2025-0004', type: 'LmsCourse', ref: 'CRS-DEMO-003', relation: 'MITIGATED_BY',
    why: 'Gowning read-and-understand is the recurring competency control' },
  { risk: 'RISK-2025-0004', type: 'LmsCourse', ref: 'CRS-DEMO-001', relation: 'MITIGATED_BY',
    why: 'Annual GMP refresher carries the aseptic technique module' },
  { risk: 'RISK-2025-0004', type: 'Document', ref: 'DOC-2026-0009', relation: 'MITIGATED_BY',
    why: 'The gowning work instruction is what the training teaches' },

  // ── Calibration drift — the equipment criticality case ───────────────────
  { risk: 'RISK-2025-0006', type: 'Equipment', ref: 'EQP-003', relation: 'APPLIES_TO',
    why: 'The balance whose drift the risk is about — drives calibration interval' },
  { risk: 'RISK-2025-0006', type: 'LmsCourse', ref: 'CRS-DEMO-005', relation: 'MITIGATED_BY',
    why: 'Calibration basics training supports the preventive control' },

  // ── Supplier material variability — the supplier tiering case ────────────
  { risk: 'RISK-2025-0007', type: 'Supplier', ref: 'SUP-001', relation: 'APPLIES_TO',
    why: 'The API supplier whose particle size distribution varies' },
  { risk: 'RISK-2025-0007', type: 'Document', ref: 'DOC-2026-0013', relation: 'MITIGATED_BY',
    why: 'Supplier qualification SOP governs the requalification response' },
  { risk: 'RISK-2025-0007', type: 'Sample', ref: 'SMP-2026-0003', relation: 'EVIDENCE',
    why: 'Incoming API sample that surfaced the variability' },

  // ── Single-source stoppers ───────────────────────────────────────────────
  { risk: 'RISK-2025-0009', type: 'Supplier', ref: 'SUP-002', relation: 'APPLIES_TO',
    why: 'Sole source for sterile ready-to-use elastomeric stoppers' },

  // ── Contract manufacturer data integrity ─────────────────────────────────
  { risk: 'RISK-2025-0010', type: 'Document', ref: 'DOC-2026-0003', relation: 'MITIGATED_BY',
    why: 'The data integrity policy is the governing control' },
  { risk: 'RISK-2025-0010', type: 'LmsCourse', ref: 'CRS-DEMO-002', relation: 'MITIGATED_BY',
    why: 'ALCOA+ training is how the policy is enforced at the CM' },
  { risk: 'RISK-2025-0010', type: 'Supplier', ref: 'SUP-003', relation: 'APPLIES_TO',
    why: 'The contract manufacturer holding the uncontrolled records' },

  // ── Undisclosed subcontracting ───────────────────────────────────────────
  { risk: 'RISK-2026-0003', type: 'Supplier', ref: 'SUP-003', relation: 'APPLIES_TO',
    why: 'Same CM — two live risks is exactly why a supplier needs a rolled-up level' },
  { risk: 'RISK-2026-0003', type: 'Document', ref: 'DOC-2026-0013', relation: 'MITIGATED_BY',
    why: 'Supplier qualification SOP covers subcontracting disclosure' },

  // ── WFI microbial ingress ────────────────────────────────────────────────
  { risk: 'RISK-2026-0002', type: 'Document', ref: 'DOC-2026-0007', relation: 'MITIGATED_BY',
    why: 'EM SOP covers the WFI user point sampling regime' },

  // ── OOS as a risk source — the LIMS inbound case ─────────────────────────
  { risk: 'RISK-2025-0007', type: 'OosInvestigation', ref: 'OOS-2026-0001', relation: 'CAUSED_BY',
    why: 'The related-substances OOS traced back to incoming material variability' },
];

/** Resolve each linkable type's records by their human reference number. */
const resolvers: Record<string, () => Promise<Map<string, string>>> = {
  Document: async () =>
    new Map((await prisma.document.findMany({ where: { isDeleted: false }, select: { id: true, docNumber: true } }))
      .map((r) => [r.docNumber, r.id])),
  Capa: async () =>
    new Map((await prisma.capa.findMany({ select: { id: true, capaNumber: true } }))
      .map((r) => [r.capaNumber, r.id])),
  Equipment: async () =>
    new Map((await prisma.equipment.findMany({ where: { isDeleted: false }, select: { id: true, code: true } }))
      .map((r) => [r.code, r.id])),
  Supplier: async () =>
    new Map((await prisma.supplier.findMany({ where: { isDeleted: false }, select: { id: true, code: true } }))
      .map((r) => [r.code, r.id])),
  Sample: async () =>
    new Map((await prisma.sample.findMany({ where: { isDeleted: false }, select: { id: true, sampleNumber: true } }))
      .map((r) => [r.sampleNumber, r.id])),
  LmsCourse: async () =>
    new Map((await prisma.lmsCourse.findMany({ where: { isDeleted: false }, select: { id: true, code: true } }))
      .map((r) => [r.code, r.id])),
  AuditRegister: async () =>
    new Map((await prisma.auditRegister.findMany({ select: { id: true, registerNumber: true } }))
      .map((r) => [r.registerNumber, r.id])),
  OosInvestigation: async () =>
    new Map((await prisma.oosInvestigation.findMany({ select: { id: true, code: true } }))
      .map((r) => [r.code, r.id])),
};

/** Display label captured on the link, mirroring what the API would capture. */
const labelFor = async (type: string, id: string): Promise<string | null> => {
  switch (type) {
    case 'Document': {
      const r = await prisma.document.findUnique({ where: { id }, select: { docNumber: true, title: true } });
      return r ? `${r.docNumber} — ${r.title}` : null;
    }
    case 'Capa': {
      const r = await prisma.capa.findUnique({ where: { id }, select: { capaNumber: true, title: true } });
      return r ? `${r.capaNumber} — ${r.title}` : null;
    }
    case 'Equipment': {
      const r = await prisma.equipment.findUnique({ where: { id }, select: { code: true, name: true } });
      return r ? `${r.code} — ${r.name}` : null;
    }
    case 'Supplier': {
      const r = await prisma.supplier.findUnique({ where: { id }, select: { code: true, name: true } });
      return r ? `${r.code} — ${r.name}` : null;
    }
    case 'Sample': {
      const r = await prisma.sample.findUnique({ where: { id }, select: { sampleNumber: true, productName: true } });
      return r ? `${r.sampleNumber} — ${r.productName}` : null;
    }
    case 'LmsCourse': {
      const r = await prisma.lmsCourse.findUnique({ where: { id }, select: { code: true, title: true } });
      return r ? `${r.code} — ${r.title}` : null;
    }
    case 'AuditRegister': {
      const r = await prisma.auditRegister.findUnique({ where: { id }, select: { registerNumber: true, title: true } });
      return r ? `${r.registerNumber} — ${r.title}` : null;
    }
    case 'OosInvestigation': {
      const r = await prisma.oosInvestigation.findUnique({ where: { id }, select: { code: true, title: true } });
      return r ? `${r.code} — ${r.title}` : null;
    }
    default:
      return null;
  }
};

const main = async () => {
  console.log('\nRisk cross-module integration seed\n' + '─'.repeat(64));

  // 1. Suppliers — created only if absent, never overwritten.
  let suppliersCreated = 0;
  for (const s of SUPPLIERS) {
    const existing = await prisma.supplier.findUnique({ where: { code: s.code }, select: { id: true } });
    if (existing) continue;
    await prisma.supplier.create({ data: { ...s, isActive: true } });
    suppliersCreated += 1;
  }
  console.log(`suppliers: ${suppliersCreated} created, ${SUPPLIERS.length - suppliersCreated} already present`);

  // 2. Resolve every reference up front so a missing record is reported once.
  const risks = new Map(
    (await prisma.risk.findMany({ select: { id: true, riskNumber: true } })).map((r) => [r.riskNumber, r.id]),
  );
  const byType: Record<string, Map<string, string>> = {};
  for (const [type, resolve] of Object.entries(resolvers)) byType[type] = await resolve();

  // 3. Links.
  let created = 0;
  let existed = 0;
  const skipped: string[] = [];
  const touched = new Set<string>();

  for (const l of LINKS) {
    const riskId = risks.get(l.risk);
    const entityId = byType[l.type]?.get(l.ref);
    if (!riskId) { skipped.push(`${l.risk} (risk not found)`); continue; }
    if (!entityId) { skipped.push(`${l.type} ${l.ref} (record not found)`); continue; }

    const already = await prisma.riskLink.findFirst({
      where: { riskId, entityType: l.type, entityId, relation: l.relation },
      select: { id: true },
    });
    if (already) { existed += 1; touched.add(`${l.type}:${entityId}`); continue; }

    await prisma.riskLink.create({
      data: {
        riskId,
        entityType: l.type,
        entityId,
        relation: l.relation,
        label: await labelFor(l.type, entityId),
      },
    });
    created += 1;
    touched.add(`${l.type}:${entityId}`);
  }

  console.log(`links:     ${created} created, ${existed} already present, ${skipped.length} skipped`);
  for (const s of new Set(skipped)) console.log(`           skipped ${s}`);

  // 4. Rebuild the profiles for everything touched. Without this the chips stay
  //    blank until the next risk event — the projection is only ever written by
  //    a recompute, never inferred at read time.
  for (const key of touched) {
    const idx = key.indexOf(':');
    await recomputeProfile(key.slice(0, idx), key.slice(idx + 1));
  }
  console.log(`profiles:  ${touched.size} recomputed`);

  // 5. Show what this actually produced, worst risk first — this is the
  //    "how it works" the seed exists to demonstrate.
  const profiles = await prisma.riskProfile.findMany({
    orderBy: [{ severityRank: 'desc' }],
  });
  console.log('\nRisk profiles now on non-risk records\n' + '─'.repeat(64));
  const names: Record<string, Map<string, string>> = byType;
  for (const p of profiles) {
    const ref =
      [...(names[p.entityType]?.entries() ?? [])].find(([, id]) => id === p.entityId)?.[0] ?? p.entityId.slice(0, 8);
    console.log(
      `  ${p.entityType.padEnd(17)} ${String(ref).padEnd(15)} ` +
        `${(p.highestLevelLabel ?? '—').padEnd(10)} rank=${String(p.severityRank ?? '—').padStart(3)}  ` +
        `open=${p.openRiskCount} controls=${p.openControls}` +
        (p.unacceptableCount ? `  UNACCEPTED×${p.unacceptableCount}` : '') +
        (p.overdueReviews ? `  review overdue×${p.overdueReviews}` : ''),
    );
  }

  console.log('\nWhere to see it\n' + '─'.repeat(64));
  console.log('  /dms/…              risk chip in the header + "Linked risks" card');
  console.log('  /audit/capa/…       "Source risks" in the sidebar');
  console.log('  /lims/equipment     new Risk column (one batched request per page)');
  console.log('  /lims/suppliers     three suppliers, two carrying live risk');
  console.log('  /risk/risks/…       Links tab — every link clickable, none a bare UUID');
  console.log('  GET /api/risk/profile?entityType=Supplier&entityId=…\n');
};

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
