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

  // ── Samples (+ custody + aliquots) ──
  const sampleDefs = [
    { num: 'SMP-2026-0001', product: 'Paracetamol Tablets 500 mg', batch: 'PCM-2601', type: 'Finished Product', spec: 'SPEC-001', lab: 'LAB-001', loc: 'STO-001', status: 'IN_TESTING' as const, priority: 'Normal', qty: 60, unit: 'tablets',
      custody: [{ action: 'REGISTERED' as const, to: 'STO-001', h: 'R. Kumar', off: -3 }, { action: 'RECEIVED' as const, to: 'STO-001', h: 'QC Receipt', off: -3 }, { action: 'STORED' as const, to: 'STO-001', h: 'S. Iyer', off: -2 }],
      aliquots: [{ loc: 'STO-001', temp: '2-8°C', qty: 20, unit: 'tablets', exp: 365 }] },
    { num: 'SMP-2026-0002', product: 'Amoxicillin Capsules 250 mg', batch: 'AMX-2602', type: 'Finished Product', spec: 'SPEC-002', lab: 'LAB-001', loc: 'STO-004', status: 'REGISTERED' as const, priority: 'High', qty: 40, unit: 'capsules',
      custody: [{ action: 'REGISTERED' as const, to: 'STO-004', h: 'R. Kumar', off: -1 }], aliquots: [] },
    { num: 'SMP-2026-0003', product: 'Metformin API', batch: 'MET-RM-118', type: 'Raw Material', spec: null, lab: 'LAB-001', loc: 'STO-002', status: 'IN_REVIEW' as const, priority: 'Normal', qty: 100, unit: 'g',
      custody: [{ action: 'REGISTERED' as const, to: 'STO-002', h: 'R. Kumar', off: -6 }, { action: 'ALIQUOTED' as const, to: 'STO-002', h: 'A. Sharma', off: -5 }],
      aliquots: [{ loc: 'STO-002', temp: '-20°C', qty: 10, unit: 'g', exp: 730 }] },
    { num: 'SMP-2026-0004', product: 'Ibuprofen Suspension', batch: 'IBU-2604', type: 'Stability', spec: 'SPEC-003', lab: 'LAB-004', loc: 'STO-003', status: 'RELEASED' as const, priority: 'Low', qty: 12, unit: 'bottles',
      custody: [{ action: 'REGISTERED' as const, to: 'STO-003', h: 'R. Kumar', off: -20 }, { action: 'STORED' as const, to: 'STO-003', h: 'Stability Cell', off: -20 }], aliquots: [] },
  ];
  for (const s of sampleDefs) {
    if (await prisma.sample.findUnique({ where: { sampleNumber: s.num } })) continue;
    await prisma.sample.create({
      data: {
        sampleNumber: s.num, barcode: s.num, productName: s.product, batchNo: s.batch, sampleType: s.type,
        specificationId: s.spec ? specs.get(s.spec) ?? null : null, labId: labs.get(s.lab) ?? null,
        currentLocationId: storage.get(s.loc) ?? null, status: s.status, priority: s.priority, quantity: s.qty, unit: s.unit,
        collectedAt: d(s.custody[0].off - 1), receivedAt: d(s.custody[0].off),
        custodyEvents: { create: s.custody.map((c) => ({ action: c.action, toLocationId: storage.get(c.to) ?? null, handlerName: c.h, occurredAt: d(c.off) })) },
        aliquots: { create: s.aliquots.map((a, i) => ({ code: `${s.num}-A${String(i + 1).padStart(2, '0')}`, storageLocationId: storage.get(a.loc) ?? null, tempZone: a.temp, quantity: a.qty, unit: a.unit, expiryAt: d(a.exp), status: 'STORED' })) },
      },
    });
  }

  const counts = {
    labs: await prisma.lab.count(), storage: await prisma.storageLocation.count(), methods: await prisma.testMethod.count(),
    specs: await prisma.specification.count(), equipment: await prisma.equipment.count(), certs: await prisma.certification.count(), samples: await prisma.sample.count(),
  };
  console.log('✅  LIMS seed complete:', counts);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
