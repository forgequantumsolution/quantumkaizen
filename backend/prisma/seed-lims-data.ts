/**
 * Demo data for the whole LIMS module — Labs, Storage, Test Methods,
 * Specifications (+ parameters), Equipment (+ calibration history),
 * Certifications (valid/expiring/expired) and Samples (+ chain of custody +
 * aliquots) — so every LIMS screen shows realistic data.
 *
 *   npm run db:seed:lims   (from the backend workspace)
 *
 * Idempotent: every row is found-or-created by its unique code / number, so
 * re-running is safe and never duplicates.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DAY = 86_400_000;
const d = (days: number) => new Date(Date.now() + days * DAY);

async function main() {
  console.log('🌱  Seeding LIMS demo data…');

  // ── Labs ──
  const labDefs = [
    { code: 'LAB-001', name: 'Central QC Laboratory', type: 'INTERNAL' as const, gmpClass: 'GMP', siteCode: 'HYD-01', location: 'Hyderabad', accreditation: 'NABL, ISO 17025' },
    { code: 'LAB-002', name: 'Microbiology Laboratory', type: 'INTERNAL' as const, gmpClass: 'GMP', siteCode: 'HYD-01', location: 'Hyderabad', accreditation: 'NABL' },
    { code: 'LAB-003', name: 'Apex Analytical Services', type: 'PARTNER' as const, gmpClass: 'GMP', siteCode: 'BLR', location: 'Bengaluru', accreditation: 'NABL, USFDA' },
    { code: 'LAB-004', name: 'StabiTest Contract Lab', type: 'CONTRACT' as const, gmpClass: 'GMP', siteCode: 'MUM', location: 'Mumbai', accreditation: 'ISO 17025' },
  ];
  for (const l of labDefs) {
    await prisma.lab.upsert({ where: { code: l.code }, update: {}, create: l });
  }

  // ── Storage locations ──
  const storageDefs = [
    { code: 'STO-001', name: 'Cold Room A', type: 'Cold Room', tempZone: '2-8°C', location: 'QC Block GF' },
    { code: 'STO-002', name: 'Sample Freezer', type: 'Freezer', tempZone: '-20°C', location: 'QC Block GF' },
    { code: 'STO-003', name: 'Stability Chamber 25/60', type: 'Chamber', tempZone: '25°C/60%RH', location: 'Stability Lab' },
    { code: 'STO-004', name: 'Retained Samples Cabinet', type: 'Cabinet', tempZone: 'RT', location: 'QC Block FF' },
  ];
  for (const s of storageDefs) {
    await prisma.storageLocation.upsert({ where: { code: s.code }, update: {}, create: s });
  }

  // ── Test methods ──
  const methodDefs = [
    { code: 'MTH-001', name: 'Assay by HPLC', technique: 'HPLC', sopRef: 'SOP-QC-101', defaultUnit: '%', price: 1200 },
    { code: 'MTH-002', name: 'Dissolution (Apparatus II)', technique: 'Dissolution', sopRef: 'SOP-QC-110', defaultUnit: '%', price: 1500 },
    { code: 'MTH-003', name: 'Related Substances by HPLC', technique: 'HPLC', sopRef: 'SOP-QC-105', defaultUnit: '%', price: 1800 },
    { code: 'MTH-004', name: 'Water Content (Karl Fischer)', technique: 'Titration', sopRef: 'SOP-QC-120', defaultUnit: '%', price: 600 },
    { code: 'MTH-005', name: 'Description (Visual)', technique: 'Visual', sopRef: 'SOP-QC-001', defaultUnit: null, price: 100 },
  ];
  for (const m of methodDefs) {
    await prisma.testMethod.upsert({ where: { code: m.code }, update: {}, create: m });
  }
  const methods = new Map((await prisma.testMethod.findMany({ select: { id: true, code: true } })).map((m) => [m.code, m.id]));

  // ── Specifications (+ parameters) ──
  const specDefs = [
    {
      code: 'SPEC-001', productName: 'Paracetamol Tablets 500 mg', status: 'APPROVED' as const, pharmacopoeia: 'IP', effectiveDate: d(-60), approvedAt: d(-60),
      params: [
        { name: 'Description', textCriteria: 'White to off-white capsule-shaped tablets', method: 'MTH-005' },
        { name: 'Assay', unit: '%', minValue: 95, maxValue: 105, targetValue: 100, method: 'MTH-001', pharmacopoeiaRef: 'IP' },
        { name: 'Dissolution', unit: '%', minValue: 80, targetValue: 100, method: 'MTH-002', pharmacopoeiaRef: 'IP <Q=80%>' },
        { name: 'Related Substances', unit: '%', maxValue: 0.5, method: 'MTH-003' },
        { name: 'Water Content', unit: '%', maxValue: 5, method: 'MTH-004' },
      ],
    },
    {
      code: 'SPEC-002', productName: 'Amoxicillin Capsules 250 mg', status: 'APPROVED' as const, pharmacopoeia: 'BP', effectiveDate: d(-45), approvedAt: d(-45),
      params: [
        { name: 'Description', textCriteria: 'Hard gelatin capsules, body white / cap maroon', method: 'MTH-005' },
        { name: 'Assay', unit: '%', minValue: 90, maxValue: 120, targetValue: 100, method: 'MTH-001', pharmacopoeiaRef: 'BP' },
        { name: 'Water Content', unit: '%', maxValue: 12, method: 'MTH-004' },
      ],
    },
    {
      code: 'SPEC-003', productName: 'Ibuprofen Suspension 100 mg/5 mL', status: 'DRAFT' as const, pharmacopoeia: 'USP',
      params: [
        { name: 'Description', textCriteria: 'White to off-white viscous suspension', method: 'MTH-005' },
        { name: 'Assay', unit: '%', minValue: 90, maxValue: 110, targetValue: 100, method: 'MTH-001' },
      ],
    },
  ];
  for (const sp of specDefs) {
    const exists = await prisma.specification.findUnique({ where: { code: sp.code } });
    if (exists) continue;
    await prisma.specification.create({
      data: {
        code: sp.code, productName: sp.productName, status: sp.status, pharmacopoeia: sp.pharmacopoeia,
        effectiveDate: sp.effectiveDate ?? null, approvedAt: sp.approvedAt ?? null,
        parameters: {
          create: sp.params.map((p, i) => ({
            name: p.name, unit: p.unit ?? null, minValue: p.minValue ?? null, maxValue: p.maxValue ?? null,
            targetValue: p.targetValue ?? null, textCriteria: p.textCriteria ?? null,
            methodId: p.method ? methods.get(p.method) ?? null : null, pharmacopoeiaRef: p.pharmacopoeiaRef ?? null, position: i,
          })),
        },
      },
    });
  }
  const labs = new Map((await prisma.lab.findMany({ select: { id: true, code: true } })).map((l) => [l.code, l.id]));
  const storage = new Map((await prisma.storageLocation.findMany({ select: { id: true, code: true } })).map((s) => [s.code, s.id]));
  const specs = new Map((await prisma.specification.findMany({ select: { id: true, code: true } })).map((s) => [s.code, s.id]));

  // ── L1: Test definitions (one analyte each) ──
  const testDefDefs = [
    { code: 'TD-DESC', name: 'Description', technique: 'Visual', method: 'MTH-005', analyte: { name: 'Description', unit: null, dataType: 'TEXT', decimals: null } },
    { code: 'TD-ASSAY', name: 'Assay', technique: 'HPLC', method: 'MTH-001', analyte: { name: 'Assay', unit: '%', dataType: 'NUMERIC', decimals: 1 } },
    { code: 'TD-DISS', name: 'Dissolution', technique: 'Dissolution', method: 'MTH-002', analyte: { name: 'Dissolution', unit: '%', dataType: 'NUMERIC', decimals: 0 } },
    { code: 'TD-RS', name: 'Related Substances', technique: 'HPLC', method: 'MTH-003', analyte: { name: 'Related Substances', unit: '%', dataType: 'NUMERIC', decimals: 2 } },
    { code: 'TD-WATER', name: 'Water Content', technique: 'Titration', method: 'MTH-004', analyte: { name: 'Water Content', unit: '%', dataType: 'NUMERIC', decimals: 1 } },
  ];
  for (const t of testDefDefs) {
    if (await prisma.testDefinition.findUnique({ where: { code: t.code } })) continue;
    await prisma.testDefinition.create({
      data: {
        code: t.code, name: t.name, technique: t.technique, methodId: methods.get(t.method) ?? null, status: 'APPROVED',
        analytes: { create: [{ name: t.analyte.name, unit: t.analyte.unit, dataType: t.analyte.dataType, decimals: t.analyte.decimals, sequence: 0 }] },
      },
    });
  }
  const testDefs = new Map((await prisma.testDefinition.findMany({ select: { id: true, code: true } })).map((t) => [t.code, t.id]));

  // ── L1: Test panels ──
  const panelDefs = [
    { code: 'PNL-PCM', name: 'Paracetamol Tablets — Release Panel', items: ['TD-DESC', 'TD-ASSAY', 'TD-DISS', 'TD-RS', 'TD-WATER'] },
    { code: 'PNL-AMX', name: 'Amoxicillin Capsules — Release Panel', items: ['TD-DESC', 'TD-ASSAY', 'TD-WATER'] },
    { code: 'PNL-IBU', name: 'Ibuprofen Suspension — Release Panel', items: ['TD-DESC', 'TD-ASSAY'] },
  ];
  for (const p of panelDefs) {
    if (await prisma.testPanel.findUnique({ where: { code: p.code } })) continue;
    await prisma.testPanel.create({
      data: { code: p.code, name: p.name, items: { create: p.items.map((c, i) => ({ testDefinitionId: testDefs.get(c)!, sequence: i })) } },
    });
  }
  const panels = new Map((await prisma.testPanel.findMany({ select: { id: true, code: true } })).map((p) => [p.code, p.id]));

  // ── L0: Products (linked to their default panel) ──
  const productDefs = [
    { code: 'PRD-001', name: 'Paracetamol Tablets 500 mg', grade: 'IP', dosageForm: 'Tablet', strength: '500 mg', category: 'Analgesic', panel: 'PNL-PCM' },
    { code: 'PRD-002', name: 'Amoxicillin Capsules 250 mg', grade: 'BP', dosageForm: 'Capsule', strength: '250 mg', category: 'Antibiotic', panel: 'PNL-AMX' },
    { code: 'PRD-003', name: 'Metformin API', grade: 'IH', dosageForm: 'API', strength: null, category: 'Antidiabetic', panel: null },
    { code: 'PRD-004', name: 'Ibuprofen Suspension 100 mg/5 mL', grade: 'USP', dosageForm: 'Suspension', strength: '100 mg/5 mL', category: 'NSAID', panel: 'PNL-IBU' },
  ];
  for (const p of productDefs) {
    await prisma.product.upsert({
      where: { code: p.code }, update: { defaultPanelId: p.panel ? panels.get(p.panel) ?? null : null },
      create: { code: p.code, name: p.name, grade: p.grade, dosageForm: p.dosageForm, strength: p.strength, category: p.category, defaultPanelId: p.panel ? panels.get(p.panel) ?? null : null },
    });
  }
  const products = new Map((await prisma.product.findMany({ select: { id: true, code: true } })).map((p) => [p.code, p.id]));

  // ── L1: Approved spec versions (+ lines) — the limit authority for evaluation ──
  const specVersionDefs = [
    { code: 'SV-PCM-R1', product: 'PRD-001', spec: 'SPEC-001', name: 'Paracetamol Tablets 500 mg — Release', pharmacopoeia: 'IP', lines: [
      { name: 'Description', textCriteria: 'White to off-white capsule-shaped tablets', test: 'TD-DESC' },
      { name: 'Assay', unit: '%', minValue: 95, maxValue: 105, targetValue: 100, decimals: 1, test: 'TD-ASSAY' },
      { name: 'Dissolution', unit: '%', minValue: 80, decimals: 0, test: 'TD-DISS' },
      { name: 'Related Substances', unit: '%', maxValue: 0.5, decimals: 2, test: 'TD-RS' },
      { name: 'Water Content', unit: '%', maxValue: 5, decimals: 1, test: 'TD-WATER' },
    ] },
    { code: 'SV-AMX-R1', product: 'PRD-002', spec: 'SPEC-002', name: 'Amoxicillin Capsules 250 mg — Release', pharmacopoeia: 'BP', lines: [
      { name: 'Description', textCriteria: 'Hard gelatin capsules, body white / cap maroon', test: 'TD-DESC' },
      { name: 'Assay', unit: '%', minValue: 90, maxValue: 120, targetValue: 100, decimals: 1, test: 'TD-ASSAY' },
      { name: 'Water Content', unit: '%', maxValue: 12, decimals: 1, test: 'TD-WATER' },
    ] },
    { code: 'SV-IBU-R1', product: 'PRD-004', spec: 'SPEC-003', name: 'Ibuprofen Suspension — Release', pharmacopoeia: 'USP', lines: [
      { name: 'Description', textCriteria: 'White to off-white viscous suspension', test: 'TD-DESC' },
      { name: 'Assay', unit: '%', minValue: 90, maxValue: 110, targetValue: 100, decimals: 1, test: 'TD-ASSAY' },
    ] },
  ];
  for (const sv of specVersionDefs) {
    if (await prisma.specVersion.findUnique({ where: { code: sv.code } })) continue;
    await prisma.specVersion.create({
      data: {
        code: sv.code, name: sv.name, productId: products.get(sv.product) ?? null, specificationId: specs.get(sv.spec) ?? null,
        stage: 'RELEASE', status: 'APPROVED', pharmacopoeia: sv.pharmacopoeia, effectiveDate: d(-40), approvedAt: d(-40),
        lines: { create: sv.lines.map((ln, i) => ({
          name: ln.name, unit: ln.unit ?? null, minValue: ln.minValue ?? null, maxValue: ln.maxValue ?? null,
          targetValue: ln.targetValue ?? null, textCriteria: ln.textCriteria ?? null, decimals: ln.decimals ?? null,
          testDefinitionId: testDefs.get(ln.test) ?? null, sequence: i,
        })) },
      },
    });
  }
  const specVersions = new Map((await prisma.specVersion.findMany({ select: { id: true, code: true } })).map((s) => [s.code, s.id]));

  // ── Equipment (+ calibration) ──
  const eqDefs = [
    { code: 'EQP-001', name: 'HPLC System 1', category: 'HPLC', lab: 'LAB-001', serialNo: 'AG-1290-771', manufacturer: 'Agilent', model: '1290 Infinity II', freq: 365, lastCal: -30, result: 'PASS' as const },
    { code: 'EQP-002', name: 'Dissolution Apparatus', category: 'Dissolution', lab: 'LAB-001', serialNo: 'EL-DT80-12', manufacturer: 'Electrolab', model: 'TDT-08L', freq: 180, lastCal: -200, result: 'PASS' as const },
    { code: 'EQP-003', name: 'Analytical Balance', category: 'Balance', lab: 'LAB-001', serialNo: 'MT-XPR205-3', manufacturer: 'Mettler Toledo', model: 'XPR205', freq: 365, lastCal: -352, result: 'PASS' as const },
    { code: 'EQP-004', name: 'Karl Fischer Titrator', category: 'Titrator', lab: 'LAB-002', serialNo: 'MET-V20-09', manufacturer: 'Metrohm', model: '870 KF Titrino', freq: 365, lastCal: -100, result: 'PASS' as const },
  ];
  for (const e of eqDefs) {
    if (await prisma.equipment.findUnique({ where: { code: e.code } })) continue;
    const lastCal = d(e.lastCal);
    const due = new Date(lastCal.getTime() + e.freq * DAY);
    await prisma.equipment.create({
      data: {
        code: e.code, name: e.name, category: e.category, labId: labs.get(e.lab) ?? null, serialNo: e.serialNo,
        manufacturer: e.manufacturer, model: e.model, status: 'ACTIVE', calibrationFrequencyDays: e.freq,
        lastCalibratedAt: lastCal, calibrationDueAt: due,
        calibrations: { create: { calibratedAt: lastCal, result: e.result, nextDueAt: due, certificateNo: `CAL-${e.code}-01`, performedBy: 'Calibration Agency' } },
      },
    });
  }

  // ── Certifications ──
  const certDefs = [
    { code: 'CERT-001', type: 'GMP', number: 'GMP/2024/HYD/118', lab: 'LAB-001', issuedBy: 'State FDA', issue: -300, expiry: 300 },
    { code: 'CERT-002', type: 'NABL', number: 'TC-9921', lab: 'LAB-001', issuedBy: 'NABL', issue: -700, expiry: 20 },
    { code: 'CERT-003', type: 'ISO 17025', number: 'ISO/17025/4471', lab: 'LAB-004', issuedBy: 'BIS', issue: -800, expiry: -10 },
    { code: 'CERT-004', type: 'USFDA', number: 'FEI-3009284711', lab: 'LAB-003', issuedBy: 'USFDA', issue: -200, expiry: 500 },
  ];
  for (const c of certDefs) {
    await prisma.certification.upsert({
      where: { code: c.code }, update: {},
      create: { code: c.code, type: c.type, number: c.number, labId: labs.get(c.lab) ?? null, issuedBy: c.issuedBy, issueDate: d(c.issue), expiryDate: d(c.expiry) },
    });
  }

  // ── Samples (+ custody + aliquots) — linked to a Product + effective spec version ──
  const sampleDefs = [
    { num: 'SMP-2026-0001', product: 'Paracetamol Tablets 500 mg', prod: 'PRD-001', specVer: 'SV-PCM-R1', batch: 'PCM-2601', type: 'Finished Product', spec: 'SPEC-001', lab: 'LAB-001', loc: 'STO-001', status: 'IN_TESTING' as const, priority: 'Normal', qty: 60, unit: 'tablets',
      custody: [{ action: 'REGISTERED' as const, to: 'STO-001', h: 'R. Kumar', off: -3 }, { action: 'RECEIVED' as const, to: 'STO-001', h: 'QC Receipt', off: -3 }, { action: 'STORED' as const, to: 'STO-001', h: 'S. Iyer', off: -2 }],
      aliquots: [{ loc: 'STO-001', temp: '2-8°C', qty: 20, unit: 'tablets', exp: 365 }] },
    { num: 'SMP-2026-0002', product: 'Amoxicillin Capsules 250 mg', prod: 'PRD-002', specVer: 'SV-AMX-R1', batch: 'AMX-2602', type: 'Finished Product', spec: 'SPEC-002', lab: 'LAB-001', loc: 'STO-004', status: 'REGISTERED' as const, priority: 'High', qty: 40, unit: 'capsules',
      custody: [{ action: 'REGISTERED' as const, to: 'STO-004', h: 'R. Kumar', off: -1 }], aliquots: [] },
    { num: 'SMP-2026-0003', product: 'Metformin API', prod: 'PRD-003', specVer: null, batch: 'MET-RM-118', type: 'Raw Material', spec: null, lab: 'LAB-001', loc: 'STO-002', status: 'IN_REVIEW' as const, priority: 'Normal', qty: 100, unit: 'g',
      custody: [{ action: 'REGISTERED' as const, to: 'STO-002', h: 'R. Kumar', off: -6 }, { action: 'ALIQUOTED' as const, to: 'STO-002', h: 'A. Sharma', off: -5 }],
      aliquots: [{ loc: 'STO-002', temp: '-20°C', qty: 10, unit: 'g', exp: 730 }] },
    { num: 'SMP-2026-0004', product: 'Ibuprofen Suspension', prod: 'PRD-004', specVer: 'SV-IBU-R1', batch: 'IBU-2604', type: 'Stability', spec: 'SPEC-003', lab: 'LAB-004', loc: 'STO-003', status: 'RELEASED' as const, priority: 'Low', qty: 12, unit: 'bottles',
      custody: [{ action: 'REGISTERED' as const, to: 'STO-003', h: 'R. Kumar', off: -20 }, { action: 'STORED' as const, to: 'STO-003', h: 'Stability Cell', off: -20 }], aliquots: [] },
  ];
  for (const s of sampleDefs) {
    const productId = products.get(s.prod) ?? null;
    const specVersionId = s.specVer ? specVersions.get(s.specVer) ?? null : null;
    const existing = await prisma.sample.findUnique({ where: { sampleNumber: s.num } });
    if (existing) {
      // Backfill the product/spec link onto samples seeded before this wiring existed.
      if (!existing.productId || !existing.specVersionId) {
        await prisma.sample.update({ where: { id: existing.id }, data: { productId: productId ?? existing.productId, specVersionId: specVersionId ?? existing.specVersionId } });
      }
      continue;
    }
    await prisma.sample.create({
      data: {
        sampleNumber: s.num, barcode: s.num, productName: s.product, productId, batchNo: s.batch, sampleType: s.type,
        specificationId: s.spec ? specs.get(s.spec) ?? null : null, specVersionId, labId: labs.get(s.lab) ?? null,
        currentLocationId: storage.get(s.loc) ?? null, status: s.status, priority: s.priority, quantity: s.qty, unit: s.unit,
        collectedAt: d(s.custody[0].off - 1), receivedAt: d(s.custody[0].off),
        custodyEvents: { create: s.custody.map((c) => ({ action: c.action, toLocationId: storage.get(c.to) ?? null, handlerName: c.h, occurredAt: d(c.off) })) },
        aliquots: { create: s.aliquots.map((a, i) => ({ code: `${s.num}-A${String(i + 1).padStart(2, '0')}`, storageLocationId: storage.get(a.loc) ?? null, tempZone: a.temp, quantity: a.qty, unit: a.unit, expiryAt: d(a.exp), status: 'STORED' })) },
      },
    });
  }

  // ── Pre-assigned tests on SMP-2026-0001 (one OOS) so the testing + OOS screens
  //    show realistic execution out of the box. Idempotent: skip if tests exist. ──
  const pcmSample = await prisma.sample.findUnique({ where: { sampleNumber: 'SMP-2026-0001' }, include: { sampleTests: true } });
  if (pcmSample && pcmSample.sampleTests.length === 0) {
    const svId = specVersions.get('SV-PCM-R1')!;
    const lines = await prisma.specLine.findMany({ where: { specVersionId: svId } });
    const lineByName = new Map(lines.map((l) => [l.name.toLowerCase(), l]));
    // analyte name -> entered value (Related Substances breaches the 0.5 max → OOS)
    const entries: Record<string, { numeric?: number; text?: string }> = {
      'Description': { text: 'Complies' }, 'Assay': { numeric: 99.4 }, 'Dissolution': { numeric: 92 },
      'Related Substances': { numeric: 0.8 }, 'Water Content': { numeric: 3.2 },
    };
    let oosResultId: string | null = null; let oosTestId: string | null = null;
    for (const td of testDefDefs) {
      const ln = lineByName.get(td.analyte.name.toLowerCase()) ?? null;
      const e = entries[td.analyte.name] ?? {};
      const numeric = e.numeric ?? null; const text = e.text ?? null;
      let evaluation = 'NA'; let oos = false;
      if (numeric != null) {
        oos = (ln?.minValue != null && numeric < ln.minValue) || (ln?.maxValue != null && numeric > ln.maxValue);
        evaluation = oos ? 'OOS' : 'PASS';
      }
      const st = await prisma.sampleTest.create({
        data: {
          sampleId: pcmSample.id, testDefinitionId: testDefs.get(td.code)!, testName: td.name, specVersionId: svId,
          status: 'COMPLETED', completedAt: d(-1), startedAt: d(-2), analystName: 'A. Sharma', overallResult: oos ? 'OOS' : 'PASS',
          results: { create: [{
            analyteName: td.analyte.name, unit: td.analyte.unit, specLineId: ln?.id ?? null, minValue: ln?.minValue ?? null,
            maxValue: ln?.maxValue ?? null, decimals: ln?.decimals ?? null, numericValue: numeric, textValue: text, evaluation, isOutOfSpec: oos,
          }] },
        },
        include: { results: true },
      });
      if (oos && !oosResultId) { oosResultId = st.results[0].id; oosTestId = st.id; }
    }
    if (oosResultId && oosTestId) {
      const count = await prisma.oosInvestigation.count();
      await prisma.oosInvestigation.create({
        data: { code: `OOS-2026-${String(count + 1).padStart(4, '0')}`, title: 'OOS — Related Substances', sampleId: pcmSample.id, sampleTestId: oosTestId, resultId: oosResultId, phase: 'PHASE_1A', status: 'OPEN' },
      });
    }
  }

  const counts = {
    labs: await prisma.lab.count(), storage: await prisma.storageLocation.count(), methods: await prisma.testMethod.count(),
    specs: await prisma.specification.count(), equipment: await prisma.equipment.count(), certs: await prisma.certification.count(), samples: await prisma.sample.count(),
    products: await prisma.product.count(), testDefs: await prisma.testDefinition.count(), panels: await prisma.testPanel.count(),
    specVersions: await prisma.specVersion.count(), sampleTests: await prisma.sampleTest.count(), oos: await prisma.oosInvestigation.count(),
  };
  console.log('✅  LIMS seed complete:', counts);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
