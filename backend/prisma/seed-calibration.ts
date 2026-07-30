/**
 * Calibration module seed — `npm run db:seed:calibration [PHARMA|AUTOMOTIVE|FMCG]`.
 *
 * Applies an industry pack and lays down a small but realistic demo set:
 * reference standards, instruments, plans, a completed passing calibration and
 * a completed FAILING one that raises an out-of-tolerance assessment — because
 * the OOT path is the whole point of the module and an empty one demonstrates
 * nothing.
 *
 * Idempotent: re-running upserts rather than duplicating.
 */
import { PrismaClient } from '@prisma/client';
import { INDUSTRY_PACKS, isPackKey, type PackKey } from '../src/modules/calibration/packs';
import { computeLimits } from '../src/modules/calibration/calibration.lib';

const prisma = new PrismaClient();

const arg = (process.argv[2] ?? 'PHARMA').toUpperCase();
const PACK: PackKey = isPackKey(arg) ? arg : 'PHARMA';

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
const daysAhead = (n: number) => new Date(Date.now() + n * 86_400_000);

/** Instruments per pack — enough to exercise every status the UI renders. */
const DEMO: Record<
  PackKey,
  {
    code: string;
    name: string;
    categoryCode: string;
    serial: string;
    manufacturer: string;
    location: string;
    rangeMin: number;
    rangeMax: number;
    unit: string;
    /** null = no calibration history yet */
    lastCalibratedDaysAgo: number | null;
    intervalDays: number;
  }[]
> = {
  PHARMA: [
    { code: 'INS-0001', name: 'Analytical Balance — QC Lab', categoryCode: 'BALANCE_ANALYTICAL', serial: 'MT-XPR205-1182', manufacturer: 'Mettler Toledo', location: 'QC Lab / Bench 3', rangeMin: 0, rangeMax: 220, unit: 'g', lastCalibratedDaysAgo: 40, intervalDays: 180 },
    { code: 'INS-0002', name: 'HPLC System 02', categoryCode: 'HPLC', serial: 'AG-1260-7741', manufacturer: 'Agilent', location: 'QC Lab / Instrument Room', rangeMin: 0, rangeMax: 10, unit: 'mL/min', lastCalibratedDaysAgo: 170, intervalDays: 180 },
    { code: 'INS-0003', name: 'pH Meter — Bench 1', categoryCode: 'PH_METER', serial: 'HN-HI5221-338', manufacturer: 'Hanna', location: 'QC Lab / Bench 1', rangeMin: 0, rangeMax: 14, unit: 'pH', lastCalibratedDaysAgo: 100, intervalDays: 90 },
    { code: 'INS-0004', name: 'Stability Chamber SC-01', categoryCode: 'STABILITY_CHAMBER', serial: 'TF-3911-002', manufacturer: 'Thermo Fisher', location: 'Stability Room', rangeMin: -20, rangeMax: 60, unit: '°C', lastCalibratedDaysAgo: 20, intervalDays: 180 },
    { code: 'INS-0005', name: 'Reference Weight Set E2', categoryCode: 'REF_WEIGHT_SET', serial: 'RW-E2-0091', manufacturer: 'Rice Lake', location: 'QC Lab / Standards Cabinet', rangeMin: 0, rangeMax: 1000, unit: 'g', lastCalibratedDaysAgo: 120, intervalDays: 730 },
  ],
  AUTOMOTIVE: [
    { code: 'INS-0001', name: 'Torque Wrench — Line 2 Station 4', categoryCode: 'TORQUE_WRENCH', serial: 'NR-QL100N4-556', manufacturer: 'Tohnichi', location: 'Assembly Line 2 / Stn 4', rangeMin: 20, rangeMax: 100, unit: 'N·m', lastCalibratedDaysAgo: 40, intervalDays: 180 },
    { code: 'INS-0002', name: 'Digital Micrometer 0-25', categoryCode: 'CALIPER_MICROMETER', serial: 'MT-293-240-30-882', manufacturer: 'Mitutoyo', location: 'Gauge Crib A', rangeMin: 0, rangeMax: 25, unit: 'mm', lastCalibratedDaysAgo: 355, intervalDays: 365 },
    { code: 'INS-0003', name: 'CMM — Metrology Room', categoryCode: 'CMM', serial: 'ZS-CONTURA-1147', manufacturer: 'Zeiss', location: 'Metrology Room', rangeMin: 0, rangeMax: 900, unit: 'mm', lastCalibratedDaysAgo: 200, intervalDays: 365 },
    { code: 'INS-0004', name: 'Leak Test Machine LT-3', categoryCode: 'LEAK_TEST', serial: 'ATQ-F620-221', manufacturer: 'ATEQ', location: 'Assembly Line 3 / EOL', rangeMin: 0, rangeMax: 5, unit: 'cc/min', lastCalibratedDaysAgo: 30, intervalDays: 180 },
    { code: 'INS-0005', name: 'Gauge Block Set Grade 0', categoryCode: 'GAUGE_BLOCK_SET', serial: 'MT-516-940-10', manufacturer: 'Mitutoyo', location: 'Metrology Room / Standards', rangeMin: 0, rangeMax: 100, unit: 'mm', lastCalibratedDaysAgo: 300, intervalDays: 1095 },
  ],
  FMCG: [
    { code: 'INS-0001', name: 'Metal Detector — Packing Line 1', categoryCode: 'METAL_DETECTOR', serial: 'MT-PF-9921', manufacturer: 'Mettler Toledo Safeline', location: 'Packing Line 1', rangeMin: 0, rangeMax: 10, unit: 'mm', lastCalibratedDaysAgo: 60, intervalDays: 180 },
    { code: 'INS-0002', name: 'Checkweigher — Packing Line 1', categoryCode: 'CHECKWEIGHER', serial: 'IS-XE2-4410', manufacturer: 'Ishida', location: 'Packing Line 1', rangeMin: 0, rangeMax: 1500, unit: 'g', lastCalibratedDaysAgo: 175, intervalDays: 180 },
    { code: 'INS-0003', name: 'Probe Thermometer — Cook Zone', categoryCode: 'PROBE_THERMOMETER', serial: 'TS-104-7781', manufacturer: 'Testo', location: 'Cook Zone', rangeMin: -50, rangeMax: 300, unit: '°C', lastCalibratedDaysAgo: 20, intervalDays: 180 },
    { code: 'INS-0004', name: 'Platform Scale — Goods In', categoryCode: 'PLATFORM_SCALE', serial: 'AV-ZK830-115', manufacturer: 'Avery Weigh-Tronix', location: 'Goods In', rangeMin: 0, rangeMax: 300000, unit: 'g', lastCalibratedDaysAgo: 400, intervalDays: 365 },
    { code: 'INS-0005', name: 'Certified Test Weights M1', categoryCode: 'TEST_WEIGHTS', serial: 'TW-M1-0042', manufacturer: 'Kern', location: 'QA Office / Standards', rangeMin: 0, rangeMax: 20000, unit: 'g', lastCalibratedDaysAgo: 90, intervalDays: 730 },
  ],
};

async function main() {
  const pack = INDUSTRY_PACKS[PACK];
  console.log(`\n▸ Seeding Calibration module with the ${pack.label} pack\n`);

  // ── 1. Config ──
  const existingCfg = await prisma.calibrationConfig.findFirst({ where: { siteId: null } });
  const cfg = existingCfg
    ? await prisma.calibrationConfig.update({
        where: { id: existingCfg.id },
        data: { ...pack.config, industryPack: pack.key },
      })
    : await prisma.calibrationConfig.create({ data: { ...pack.config, industryPack: pack.key, siteId: null } });
  console.log(`  config           ✓ ${pack.key} (OOT window: ${cfg.ootImpactWindow})`);

  // ── 2. Categories + point templates ──
  for (const c of pack.categories) {
    const cat = await prisma.equipmentCategory.upsert({
      where: { code: c.code },
      update: {
        name: c.name,
        kind: c.kind,
        description: c.description ?? null,
        industryPack: pack.key,
        defaultIntervalDays: c.defaultIntervalDays,
        defaultCriticality: c.defaultCriticality,
        defaultToleranceType: c.defaultToleranceType ?? null,
        defaultToleranceValue: c.defaultToleranceValue ?? null,
        requiresMsa: !!c.requiresMsa,
        requiresInUseCheck: !!c.requiresInUseCheck,
        inUseCheckFrequency: c.inUseCheckFrequency ?? null,
        isActive: true,
        isDeleted: false,
      },
      create: {
        code: c.code,
        name: c.name,
        kind: c.kind,
        description: c.description ?? null,
        industryPack: pack.key,
        defaultIntervalDays: c.defaultIntervalDays,
        defaultCriticality: c.defaultCriticality,
        defaultToleranceType: c.defaultToleranceType ?? null,
        defaultToleranceValue: c.defaultToleranceValue ?? null,
        requiresMsa: !!c.requiresMsa,
        requiresInUseCheck: !!c.requiresInUseCheck,
        inUseCheckFrequency: c.inUseCheckFrequency ?? null,
      },
    });
    await prisma.calibrationPointTemplate.deleteMany({ where: { categoryId: cat.id } });
    await prisma.calibrationPointTemplate.createMany({
      data: c.points.map((p) => ({
        categoryId: cat.id,
        sequence: p.sequence,
        label: p.label,
        nominalValue: p.nominalValue ?? null,
        nominalPercentOfSpan: p.nominalPercentOfSpan ?? null,
        toleranceType: p.toleranceType,
        toleranceValue: p.toleranceValue,
      })),
    });
  }
  console.log(`  categories       ✓ ${pack.categories.length} (+ point templates)`);

  // ── 3. Provider ──
  const provider = await prisma.calibrationProvider.upsert({
    where: { code: 'CP-001' },
    update: {},
    create: {
      code: 'CP-001',
      name: PACK === 'AUTOMOTIVE' ? 'PrecisionCal Metrology Services' : 'NABL Accredited Calibration Labs Pvt Ltd',
      type: 'EXTERNAL',
      contactName: 'Service Desk',
      email: 'service@calibration-partner.example',
      country: 'India',
      accreditationBody: 'NABL',
      accreditationNo: 'CC-2291',
      accreditationScope: 'Mechanical, thermal and electro-technical calibration',
      accreditationExpiry: daysAhead(400),
    },
  });
  console.log(`  provider         ✓ ${provider.name}`);

  const siteId = (await prisma.site.findFirst({ where: { code: 'HQ' }, select: { id: true } }))?.id ?? null;

  // ── 4. Instruments + plans ──
  const demo = DEMO[PACK];
  const created: { id: string; code: string; categoryCode: string; planId: string | null }[] = [];

  for (const d of demo) {
    const cat = await prisma.equipmentCategory.findUnique({ where: { code: d.categoryCode } });
    if (!cat) continue;

    const lastCal = d.lastCalibratedDaysAgo !== null ? daysAgo(d.lastCalibratedDaysAgo) : null;
    const nextDue = lastCal ? new Date(lastCal.getTime() + d.intervalDays * 86_400_000) : daysAhead(30);

    const inst = await prisma.calibrationInstrument.upsert({
      where: { code: d.code },
      update: {
        name: d.name,
        categoryId: cat.id,
        kind: cat.kind,
        criticality: cat.defaultCriticality,
        siteId,
        serialNo: d.serial,
        manufacturer: d.manufacturer,
        location: d.location,
        measurementRangeMin: d.rangeMin,
        measurementRangeMax: d.rangeMax,
        unitCode: d.unit,
        lastCalibratedAt: lastCal,
        calibrationDueAt: nextDue,
        isDeleted: false,
      },
      create: {
        code: d.code,
        name: d.name,
        categoryId: cat.id,
        kind: cat.kind,
        criticality: cat.defaultCriticality,
        siteId,
        serialNo: d.serial,
        manufacturer: d.manufacturer,
        location: d.location,
        measurementRangeMin: d.rangeMin,
        measurementRangeMax: d.rangeMax,
        unitCode: d.unit,
        lastCalibratedAt: lastCal,
        calibrationDueAt: nextDue,
        qrToken: `seed${d.code.toLowerCase().replace(/-/g, '')}${PACK.slice(0, 3).toLowerCase()}`,
        ...(PACK === 'PHARMA' ? { aiqGroup: cat.code === 'HPLC' ? 'C' : 'B' } : {}),
        ...(PACK === 'FMCG' && cat.code === 'PLATFORM_SCALE'
          ? { legalMetrologyStampNo: 'LM-2026-8841', legalMetrologyValidUntil: daysAhead(180) }
          : {}),
      },
    });

    // Plan from the category template, resolved against this instrument's span.
    const templates = await prisma.calibrationPointTemplate.findMany({
      where: { categoryId: cat.id },
      orderBy: { sequence: 'asc' },
    });
    const span = d.rangeMax - d.rangeMin;
    const points = templates.map((t) => {
      const pctSpan = t.nominalPercentOfSpan ? Number(t.nominalPercentOfSpan) : null;
      const nominal = pctSpan !== null ? d.rangeMin + (span * pctSpan) / 100 : Number(t.nominalValue ?? 0);
      const lim = computeLimits({
        nominalValue: nominal,
        toleranceType: t.toleranceType,
        toleranceValue: Number(t.toleranceValue),
        spanMin: d.rangeMin,
        spanMax: d.rangeMax,
      });
      return {
        sequence: t.sequence,
        label: t.label,
        nominalValue: nominal,
        unitCode: d.unit,
        toleranceType: t.toleranceType,
        toleranceValue: Number(t.toleranceValue),
        lowerLimit: lim.lowerLimit,
        upperLimit: lim.upperLimit,
      };
    });

    let planId: string | null = null;
    const existingPlan = await prisma.calibrationPlan.findFirst({
      where: { instrumentId: inst.id, isActive: true },
    });
    if (existingPlan) {
      planId = existingPlan.id;
    } else if (points.length) {
      const plan = await prisma.calibrationPlan.create({
        data: {
          instrumentId: inst.id,
          version: 1,
          intervalType: 'DAYS',
          intervalValue: d.intervalDays,
          intervalJustification:
            'Interval inherited from the industry pack default; to be reviewed against as-found drift data after three cycles.',
          providerType: 'EXTERNAL',
          providerId: provider.id,
          requiresMsa: cat.requiresMsa,
          nextDueAt: nextDue,
          points: { create: points },
        },
      });
      planId = plan.id;
    }

    created.push({ id: inst.id, code: d.code, categoryCode: d.categoryCode, planId });
  }
  console.log(`  instruments      ✓ ${created.length} (+ plans)`);

  // ── 5. One APPROVED passing calibration on the first instrument ──
  const first = created[0];
  if (first?.planId) {
    const already = await prisma.calibrationEvent.findFirst({ where: { instrumentId: first.id } });
    if (!already) {
      const plan = await prisma.calibrationPlan.findUnique({
        where: { id: first.planId },
        include: { points: { orderBy: { sequence: 'asc' } } },
      });
      const performedAt = daysAgo(40);
      await prisma.calibrationEvent.create({
        data: {
          eventNo: `${cfg.eventNumberPrefix}-${performedAt.getFullYear()}-00001`,
          instrumentId: first.id,
          planId: plan!.id,
          planVersion: plan!.version,
          type: 'PERIODIC',
          status: 'APPROVED',
          siteId,
          scheduledFor: performedAt,
          performedAt,
          providerType: 'EXTERNAL',
          providerId: provider.id,
          performedByExternal: 'A. Kulkarni (agency technician)',
          ambientTemperature: 22.4,
          ambientHumidity: 48,
          asFoundOutcome: 'PASS',
          asLeftOutcome: 'PASS',
          overallOutcome: 'PASS',
          certificateNo: `${cfg.certificateNumberPrefix}-${performedAt.getFullYear()}-00001`,
          nextDueAt: new Date(performedAt.getTime() + 180 * 86_400_000),
          readings: {
            create: plan!.points.map((p) => {
              const nominal = Number(p.nominalValue);
              // Small in-tolerance offset so the drift chart has real shape.
              const v = nominal + (Number(p.upperLimit) - nominal) * 0.25;
              return {
                sequence: p.sequence,
                label: p.label,
                nominalValue: p.nominalValue,
                unitCode: p.unitCode,
                lowerLimit: p.lowerLimit,
                upperLimit: p.upperLimit,
                asFoundValue: v,
                asFoundError: v - nominal,
                asFoundInTolerance: true,
                asLeftValue: v,
                asLeftError: v - nominal,
                asLeftInTolerance: true,
              };
            }),
          },
        },
      });
      console.log(`  passing calib.   ✓ ${first.code}`);
    }
  }

  // ── 6. A FAILING calibration + its OOT assessment on the second instrument ──
  // The out-of-tolerance path is the module's reason to exist; a seed without
  // one demonstrates nothing.
  const second = created[1];
  if (second?.planId) {
    const already = await prisma.calibrationEvent.findFirst({ where: { instrumentId: second.id } });
    if (!already) {
      const plan = await prisma.calibrationPlan.findUnique({
        where: { id: second.planId },
        include: { points: { orderBy: { sequence: 'asc' } } },
      });
      const performedAt = daysAgo(3);
      const event = await prisma.calibrationEvent.create({
        data: {
          eventNo: `${cfg.eventNumberPrefix}-${performedAt.getFullYear()}-00002`,
          instrumentId: second.id,
          planId: plan!.id,
          planVersion: plan!.version,
          type: 'PERIODIC',
          status: 'PENDING_APPROVAL',
          siteId,
          scheduledFor: daysAgo(5),
          performedAt,
          providerType: 'EXTERNAL',
          providerId: provider.id,
          performedByExternal: 'A. Kulkarni (agency technician)',
          ambientTemperature: 23.1,
          ambientHumidity: 51,
          // As-found out of tolerance, corrected on as-left → CONDITIONAL.
          asFoundOutcome: 'FAIL',
          asLeftOutcome: 'PASS',
          overallOutcome: 'CONDITIONAL',
          adjustmentMade: true,
          readings: {
            create: plan!.points.map((p, i) => {
              const nominal = Number(p.nominalValue);
              const upper = Number(p.upperLimit);
              const band = upper - nominal;
              // First point drifted past the limit; the rest are fine.
              const asFound = i === 0 ? nominal + band * 1.8 : nominal + band * 0.2;
              const asLeft = nominal + band * 0.05;
              return {
                sequence: p.sequence,
                label: p.label,
                nominalValue: p.nominalValue,
                unitCode: p.unitCode,
                lowerLimit: p.lowerLimit,
                upperLimit: p.upperLimit,
                asFoundValue: asFound,
                asFoundError: asFound - nominal,
                asFoundInTolerance: i !== 0,
                asLeftValue: asLeft,
                asLeftError: asLeft - nominal,
                asLeftInTolerance: true,
              };
            }),
          },
        },
      });

      // Standard used, with its traceability chain.
      const refStd = created.find((c) => c.categoryCode.includes('WEIGHT') || c.categoryCode.includes('GAUGE_BLOCK'));
      if (refStd) {
        await prisma.calibrationStandardUse.create({
          data: {
            eventId: event.id,
            standardInstrumentId: refStd.id,
            certificateNo: 'NABL/CC/2026/11482',
            certificateValidUntil: daysAhead(300),
            traceableTo: 'NABL / NPL India',
            wasValidAtUse: true,
          },
        });
      }

      // The impact window, per the pack's configured rule.
      const prevCal = await prisma.calibrationEvent.findFirst({
        where: { instrumentId: second.id, status: 'APPROVED', performedAt: { lt: performedAt } },
        orderBy: { performedAt: 'desc' },
        select: { performedAt: true },
      });
      const from = prevCal?.performedAt ?? daysAgo(180);

      await prisma.outOfToleranceAssessment.create({
        data: {
          eventId: event.id,
          status: 'IMPACT_IN_PROGRESS',
          impactWindowFrom: from,
          impactWindowTo: performedAt,
          affectedBatchRefs: PACK === 'FMCG' ? ['B-26071', 'B-26072', 'B-26073'] : ['LOT-2026-0418', 'LOT-2026-0419'],
          customerNotificationRequired: cfg.ootRequiresCustomerNotification,
          productHoldRequired: cfg.ootRequiresProductHold,
          lastScannedAt: new Date(),
        },
      });

      await prisma.calibrationInstrument.update({
        where: { id: second.id },
        data: { calibrationStatus: 'UNDER_CALIBRATION' },
      });
      console.log(`  failing calib.   ✓ ${second.code} → out-of-tolerance assessment raised`);
    }
  }

  // ── 7. In-use checks, when the pack enables them ──
  if (cfg.enableInUseChecks) {
    const monitored = await prisma.calibrationInstrument.findMany({
      where: { isDeleted: false, category: { requiresInUseCheck: true } },
      take: 2,
      select: { id: true, code: true },
    });
    for (const m of monitored) {
      const existing = await prisma.inUseVerification.count({ where: { instrumentId: m.id } });
      if (existing) continue;
      for (let i = 3; i >= 1; i -= 1) {
        await prisma.inUseVerification.create({
          data: {
            instrumentId: m.id,
            performedAt: new Date(Date.now() - i * 8 * 3_600_000),
            shift: ['A', 'B', 'C'][i % 3],
            outcome: 'PASS',
            readings: [
              { label: 'Test piece 1', nominal: 2.0, observed: 2.0, in_tolerance: true },
              { label: 'Reject confirmation', nominal: 1, observed: 1, in_tolerance: true },
            ],
            batchRef: `B-2607${i}`,
          },
        });
      }
    }
    if (monitored.length) console.log(`  in-use checks    ✓ ${monitored.length} instrument(s), 3 shifts each`);
  }

  // ── 8. MSA study, when the pack enables it ──
  if (cfg.enableMsa) {
    const gauge = created.find((c) => c.categoryCode === 'TORQUE_WRENCH');
    if (gauge) {
      const existing = await prisma.msaStudy.findFirst({ where: { instrumentId: gauge.id } });
      if (!existing) {
        const study = await prisma.msaStudy.create({
          data: {
            studyNo: `MSA-${new Date().getFullYear()}-00001`,
            instrumentId: gauge.id,
            type: 'GAGE_RR_CROSSED',
            performedAt: daysAgo(30),
            partCount: 10,
            operatorCount: 3,
            trialCount: 3,
            toleranceUsed: 8,
            notes: 'Baseline study on receipt, AIAG MSA 4th ed. average-and-range method.',
          },
        });
        // A repeatable pseudo-random set — deterministic so re-seeding matches.
        let seed = 42;
        const rnd = () => {
          seed = (seed * 1103515245 + 12345) % 2147483648;
          return seed / 2147483648;
        };
        const trials = [];
        for (let part = 1; part <= 10; part += 1) {
          const partTrue = 50 + part * 1.5;
          for (let op = 1; op <= 3; op += 1) {
            const opBias = (op - 2) * 0.12;
            for (let t = 1; t <= 3; t += 1) {
              trials.push({
                studyId: study.id,
                partNo: part,
                operator: op,
                trial: t,
                measured: Number((partTrue + opBias + (rnd() - 0.5) * 0.5).toFixed(3)),
              });
            }
          }
        }
        await prisma.msaTrial.createMany({ data: trials });
        console.log(`  MSA study        ✓ ${study.studyNo} (90 trials, ready to compute)`);
      }
    }
  }

  const counts = {
    instruments: await prisma.calibrationInstrument.count({ where: { isDeleted: false } }),
    categories: await prisma.equipmentCategory.count({ where: { isDeleted: false } }),
    plans: await prisma.calibrationPlan.count({ where: { isDeleted: false } }),
    events: await prisma.calibrationEvent.count({ where: { isDeleted: false } }),
    oot: await prisma.outOfToleranceAssessment.count({ where: { isDeleted: false } }),
    checks: await prisma.inUseVerification.count({ where: { isDeleted: false } }),
  };
  console.log(`\n  totals: ${JSON.stringify(counts)}\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
