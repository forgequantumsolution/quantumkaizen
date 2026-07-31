/**
 * Calibration configuration + equipment categories.
 *
 * This is where "multi-industry" actually lives: applying a pack writes config
 * columns and category rows, and every other service in the module reads those
 * instead of asking what industry the tenant is in.
 */
import { Prisma } from '@prisma/client';
import type { CalibrationConfig, EquipmentCategory } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { BadRequest, Conflict, NotFound } from '../../lib/httpError';
import { getOrganization, trail } from './integrations';
import { DEFAULT_CONFIG, computeLimits, num, resolveConfig } from './calibration.lib';
import { INDUSTRY_PACKS, PACK_KEYS, suggestPack, type PackKey } from './packs';
import type {
  ApplyPackInput,
  CategoryUpsertInput,
  ListCategoriesQuery,
  CheckItemUpsertInput,
  PointTemplateUpsertInput,
  UpdateConfigInput,
} from './calibration.schema';

// ─────────────────────────── Serialization ───────────────────────────

export const serializeConfig = (c: CalibrationConfig) => ({
  id: c.id,
  site_id: c.siteId,
  industry_pack: c.industryPack,
  event_number_prefix: c.eventNumberPrefix,
  certificate_number_prefix: c.certificateNumberPrefix,
  due_soon_window_days: c.dueSoonWindowDays,
  auto_spawn_lead_days: c.autoSpawnLeadDays,
  grace_days: c.graceDays,
  allow_early_calibration: c.allowEarlyCalibration,
  early_window_days: c.earlyWindowDays,
  interval_reset_basis: c.intervalResetBasis,
  block_use_when_overdue: c.blockUseWhenOverdue,
  block_use_when_failed: c.blockUseWhenFailed,
  require_competency_to_perform: c.requireCompetencyToPerform,
  require_performer_signature: c.requirePerformerSignature,
  require_reviewer_signature: c.requireReviewerSignature,
  require_approver_signature: c.requireApproverSignature,
  require_reason_for_change: c.requireReasonForChange,
  oot_impact_assessment_required: c.ootImpactAssessmentRequired,
  oot_impact_window: c.ootImpactWindow,
  oot_auto_spawn: c.ootAutoSpawn,
  oot_requires_customer_notification: c.ootRequiresCustomerNotification,
  oot_requires_product_hold: c.ootRequiresProductHold,
  enable_msa: c.enableMsa,
  enable_in_use_checks: c.enableInUseChecks,
  enable_legal_metrology: c.enableLegalMetrology,
  enable_aiq_groups: c.enableAiqGroups,
  enable_usage_intervals: c.enableUsageIntervals,
  updated_at: c.updatedAt,
});

type CategoryRow = Prisma.EquipmentCategoryGetPayload<{ include: { pointTemplates: true; checkItems: true } }>;

export const serializeCategory = (c: CategoryRow | EquipmentCategory, count?: number) => ({
  id: c.id,
  code: c.code,
  name: c.name,
  kind: c.kind,
  site_id: c.siteId,
  industry_pack: c.industryPack,
  description: c.description,
  default_interval_days: c.defaultIntervalDays,
  default_criticality: c.defaultCriticality,
  default_tolerance_type: c.defaultToleranceType,
  default_tolerance_value: num(c.defaultToleranceValue),
  requires_msa: c.requiresMsa,
  requires_in_use_check: c.requiresInUseCheck,
  in_use_check_frequency: c.inUseCheckFrequency,
  is_active: c.isActive,
  instrument_count: count ?? undefined,
  check_items:
    'checkItems' in c
      ? [...c.checkItems]
          .sort((a, b) => a.sequence - b.sequence)
          .map((i) => ({
            id: i.id,
            sequence: i.sequence,
            label: i.label,
            check_type: i.checkType,
            nominal_value: num(i.nominalValue),
            tolerance_value: num(i.toleranceValue),
            unit_code: i.unitCode,
            is_required: i.isRequired,
            guidance: i.guidance,
          }))
      : undefined,
  point_templates:
    'pointTemplates' in c
      ? [...c.pointTemplates]
          .sort((a, b) => a.sequence - b.sequence)
          .map((p) => ({
            id: p.id,
            sequence: p.sequence,
            label: p.label,
            nominal_value: num(p.nominalValue),
            nominal_percent_of_span: num(p.nominalPercentOfSpan),
            unit_code: p.unitCode,
            tolerance_type: p.toleranceType,
            tolerance_value: num(p.toleranceValue),
          }))
      : undefined,
  created_at: c.createdAt,
  updated_at: c.updatedAt,
});

// ─────────────────────────── Config ───────────────────────────

export const getConfig = async (siteId?: string | null) => {
  const cfg = await resolveConfig(siteId ?? null);
  const org = await getOrganization();
  return {
    ...serializeConfig(cfg),
    /** True when nothing is stored yet — the UI shows the pack picker up front. */
    is_default: cfg.id === DEFAULT_CONFIG.id,
    organization_industry: org?.industry ?? null,
    suggested_pack: suggestPack(org?.industry),
  };
};

const CONFIG_FIELD_MAP: Record<string, keyof Prisma.CalibrationConfigUncheckedCreateInput> = {
  industry_pack: 'industryPack',
  event_number_prefix: 'eventNumberPrefix',
  certificate_number_prefix: 'certificateNumberPrefix',
  due_soon_window_days: 'dueSoonWindowDays',
  auto_spawn_lead_days: 'autoSpawnLeadDays',
  grace_days: 'graceDays',
  allow_early_calibration: 'allowEarlyCalibration',
  early_window_days: 'earlyWindowDays',
  interval_reset_basis: 'intervalResetBasis',
  block_use_when_overdue: 'blockUseWhenOverdue',
  block_use_when_failed: 'blockUseWhenFailed',
  require_competency_to_perform: 'requireCompetencyToPerform',
  require_performer_signature: 'requirePerformerSignature',
  require_reviewer_signature: 'requireReviewerSignature',
  require_approver_signature: 'requireApproverSignature',
  require_reason_for_change: 'requireReasonForChange',
  oot_impact_assessment_required: 'ootImpactAssessmentRequired',
  oot_impact_window: 'ootImpactWindow',
  oot_auto_spawn: 'ootAutoSpawn',
  oot_requires_customer_notification: 'ootRequiresCustomerNotification',
  oot_requires_product_hold: 'ootRequiresProductHold',
  enable_msa: 'enableMsa',
  enable_in_use_checks: 'enableInUseChecks',
  enable_legal_metrology: 'enableLegalMetrology',
  enable_aiq_groups: 'enableAiqGroups',
  enable_usage_intervals: 'enableUsageIntervals',
};

export const updateConfig = async (input: UpdateConfigInput, userId?: string) => {
  const siteId = input.site_id ?? null;
  const data: Record<string, unknown> = {};
  for (const [apiKey, column] of Object.entries(CONFIG_FIELD_MAP)) {
    const v = (input as Record<string, unknown>)[apiKey];
    if (v !== undefined) data[column] = v;
  }

  const existing = siteId
    ? await prisma.calibrationConfig.findUnique({ where: { siteId } })
    : await prisma.calibrationConfig.findFirst({ where: { siteId: null } });

  const saved = existing
    ? await prisma.calibrationConfig.update({ where: { id: existing.id }, data })
    : await prisma.calibrationConfig.create({ data: { ...data, siteId, createdById: userId ?? null } });

  await trail(
    {
      entityType: 'CalibrationConfig',
      entityId: saved.id,
      action: existing ? 'UPDATE' : 'CREATE',
      newValue: JSON.stringify(data),
      reason: 'Calibration configuration changed',
    },
    userId,
  );

  return serializeConfig(saved);
};

/** Pack catalogue for the picker — definitions only, nothing applied. */
export const listPacks = async () => {
  const org = await getOrganization();
  const applied = await prisma.equipmentCategory.groupBy({
    by: ['industryPack'],
    where: { isDeleted: false, industryPack: { not: null } },
    _count: { _all: true },
  });
  const appliedMap = new Map(applied.map((a) => [a.industryPack, a._count._all]));

  return {
    data: PACK_KEYS.map((k) => {
      const p = INDUSTRY_PACKS[k];
      return {
        key: p.key,
        label: p.label,
        summary: p.summary,
        standards: p.standards,
        suggested_for: p.suggestedFor,
        category_count: p.categories.length,
        point_count: p.categories.reduce((n, c) => n + c.points.length, 0),
        applied_category_count: appliedMap.get(p.key) ?? 0,
        config: p.config,
        categories: p.categories.map((c) => ({
          code: c.code,
          name: c.name,
          kind: c.kind,
          default_interval_days: c.defaultIntervalDays,
          default_criticality: c.defaultCriticality,
          requires_msa: !!c.requiresMsa,
          requires_in_use_check: !!c.requiresInUseCheck,
          in_use_check_frequency: c.inUseCheckFrequency ?? null,
          point_count: c.points.length,
        })),
      };
    }),
    organization_industry: org?.industry ?? null,
    suggested_pack: suggestPack(org?.industry),
  };
};

/**
 * Apply a pack: upsert its config columns and its categories.
 *
 * Deliberately does NOT touch instruments or plans. Categories are suggestions
 * until someone creates a plan from one, so applying a pack can never rewrite a
 * tolerance an instrument has already been judged against.
 */
export const applyPack = async (input: ApplyPackInput, userId?: string) => {
  const pack = INDUSTRY_PACKS[input.pack as PackKey];
  if (!pack) throw BadRequest(`Unknown industry pack: ${input.pack}`);
  const siteId = input.site_id ?? null;

  // ── config ──
  const existing = siteId
    ? await prisma.calibrationConfig.findUnique({ where: { siteId } })
    : await prisma.calibrationConfig.findFirst({ where: { siteId: null } });

  const configData = { ...pack.config, industryPack: pack.key };
  const config = existing
    ? await prisma.calibrationConfig.update({ where: { id: existing.id }, data: configData })
    : await prisma.calibrationConfig.create({ data: { ...configData, siteId, createdById: userId ?? null } });

  // ── categories ──
  let created = 0;
  let updated = 0;
  for (const c of pack.categories) {
    const existingCat = await prisma.equipmentCategory.findUnique({ where: { code: c.code } });
    const data = {
      name: c.name,
      kind: c.kind,
      description: c.description ?? null,
      industryPack: pack.key,
      siteId,
      defaultIntervalDays: c.defaultIntervalDays,
      defaultCriticality: c.defaultCriticality,
      defaultToleranceType: c.defaultToleranceType ?? null,
      defaultToleranceValue: c.defaultToleranceValue ?? null,
      requiresMsa: !!c.requiresMsa,
      requiresInUseCheck: !!c.requiresInUseCheck,
      inUseCheckFrequency: c.inUseCheckFrequency ?? null,
      isActive: true,
      isDeleted: false,
    };

    const cat = existingCat
      ? await prisma.equipmentCategory.update({ where: { id: existingCat.id }, data })
      : await prisma.equipmentCategory.create({ data: { ...data, code: c.code, createdById: userId ?? null } });
    existingCat ? (updated += 1) : (created += 1);

    // The in-use checklist is what makes a shift check specific to the device.
    await prisma.inUseCheckItem.deleteMany({ where: { categoryId: cat.id } });
    if (c.checkItems?.length) {
      await prisma.inUseCheckItem.createMany({
        data: c.checkItems.map((it) => ({
          categoryId: cat.id,
          sequence: it.sequence,
          label: it.label,
          checkType: it.checkType,
          nominalValue: it.nominalValue ?? null,
          toleranceValue: it.toleranceValue ?? null,
          unitCode: it.unitCode ?? null,
          isRequired: it.isRequired ?? true,
          guidance: it.guidance ?? null,
        })),
      });
    }

    // Point templates are replaced wholesale — a partially-updated point set is
    // worse than either version of it.
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

  // `replace` retires the other packs' categories that nobody is using. Ones in
  // use stay — deactivating a category an instrument points at would orphan it.
  let deactivated = 0;
  if (input.mode === 'replace') {
    const others = await prisma.equipmentCategory.findMany({
      where: { isDeleted: false, industryPack: { notIn: [pack.key] }, NOT: { industryPack: null } },
      select: { id: true, _count: { select: { instruments: true } } },
    });
    const unused = others.filter((o) => o._count.instruments === 0).map((o) => o.id);
    if (unused.length) {
      const res = await prisma.equipmentCategory.updateMany({
        where: { id: { in: unused } },
        data: { isActive: false },
      });
      deactivated = res.count;
    }
  }

  await trail(
    {
      entityType: 'CalibrationConfig',
      entityId: config.id,
      action: 'UPDATE',
      field: 'industryPack',
      newValue: pack.key,
      reason: `Applied ${pack.label} industry pack (${input.mode}): ${created} created, ${updated} updated, ${deactivated} deactivated`,
    },
    userId,
  );

  return {
    pack: pack.key,
    mode: input.mode,
    categories_created: created,
    categories_updated: updated,
    categories_deactivated: deactivated,
    config: serializeConfig(config),
  };
};

// ─────────────────────────── Categories ───────────────────────────

export const listCategories = async (q: ListCategoriesQuery) => {
  const where: Prisma.EquipmentCategoryWhereInput = { isDeleted: false };
  if (q.kind) where.kind = q.kind;
  if (q.industry_pack) where.industryPack = q.industry_pack;
  if (q.is_active !== undefined) where.isActive = q.is_active;
  if (q.search) {
    where.OR = [
      { name: { contains: q.search, mode: 'insensitive' } },
      { code: { contains: q.search, mode: 'insensitive' } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.equipmentCategory.count({ where }),
    prisma.equipmentCategory.findMany({
      where,
      include: { pointTemplates: true, checkItems: true, _count: { select: { instruments: true } } },
      orderBy: [{ kind: 'asc' }, { name: 'asc' }],
      skip: (q.page - 1) * q.page_size,
      take: q.page_size,
    }),
  ]);

  return {
    data: rows.map((r) => serializeCategory(r, r._count.instruments)),
    total,
    page: q.page,
    page_size: q.page_size,
  };
};

export const getCategory = async (id: string) => {
  const c = await prisma.equipmentCategory.findFirst({
    where: { id, isDeleted: false },
    include: { pointTemplates: true, checkItems: true, _count: { select: { instruments: true } } },
  });
  if (!c) throw NotFound('Category not found');
  return serializeCategory(c, c._count.instruments);
};

const slugCode = (name: string) =>
  name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60) || 'CATEGORY';

export const createCategory = async (input: CategoryUpsertInput, userId?: string) => {
  const code = input.code?.trim() || slugCode(input.name);
  const clash = await prisma.equipmentCategory.findUnique({ where: { code } });
  if (clash) throw Conflict(`Category code "${code}" already exists`);

  const created = await prisma.equipmentCategory.create({
    data: {
      code,
      name: input.name,
      kind: input.kind,
      description: input.description ?? null,
      siteId: input.site_id ?? null,
      defaultIntervalDays: input.default_interval_days ?? null,
      defaultCriticality: input.default_criticality ?? 'MAJOR',
      defaultToleranceType: input.default_tolerance_type ?? null,
      defaultToleranceValue: input.default_tolerance_value ?? null,
      requiresMsa: input.requires_msa ?? false,
      requiresInUseCheck: input.requires_in_use_check ?? false,
      inUseCheckFrequency: input.in_use_check_frequency ?? null,
      isActive: input.is_active ?? true,
      createdById: userId ?? null,
    },
    include: { pointTemplates: true, checkItems: true },
  });

  await trail(
    { entityType: 'EquipmentCategory', entityId: created.id, action: 'CREATE', newValue: created.name },
    userId,
  );
  return serializeCategory(created, 0);
};

export const updateCategory = async (id: string, input: CategoryUpsertInput, userId?: string) => {
  const existing = await prisma.equipmentCategory.findFirst({ where: { id, isDeleted: false } });
  if (!existing) throw NotFound('Category not found');

  const updated = await prisma.equipmentCategory.update({
    where: { id },
    data: {
      name: input.name,
      kind: input.kind,
      description: input.description ?? null,
      siteId: input.site_id ?? null,
      defaultIntervalDays: input.default_interval_days ?? null,
      defaultCriticality: input.default_criticality ?? existing.defaultCriticality,
      defaultToleranceType: input.default_tolerance_type ?? null,
      defaultToleranceValue: input.default_tolerance_value ?? null,
      requiresMsa: input.requires_msa ?? existing.requiresMsa,
      requiresInUseCheck: input.requires_in_use_check ?? existing.requiresInUseCheck,
      inUseCheckFrequency: input.in_use_check_frequency ?? null,
      isActive: input.is_active ?? existing.isActive,
    },
    include: { pointTemplates: true, checkItems: true, _count: { select: { instruments: true } } },
  });

  await trail(
    { entityType: 'EquipmentCategory', entityId: id, action: 'UPDATE', oldValue: existing.name, newValue: updated.name },
    userId,
  );
  return serializeCategory(updated, updated._count.instruments);
};

export const deleteCategory = async (id: string, userId?: string) => {
  const existing = await prisma.equipmentCategory.findFirst({
    where: { id, isDeleted: false },
    include: { _count: { select: { instruments: true } } },
  });
  if (!existing) throw NotFound('Category not found');
  if (existing._count.instruments > 0) {
    throw Conflict(
      `${existing._count.instruments} instrument(s) use this category — deactivate it instead of deleting`,
    );
  }
  await prisma.equipmentCategory.update({ where: { id }, data: { isDeleted: true, isActive: false } });
  await trail({ entityType: 'EquipmentCategory', entityId: id, action: 'DELETE', oldValue: existing.name }, userId);
};

/** Replaces the category's whole template set — atomic, like a plan's points. */
export const replacePointTemplates = async (
  categoryId: string,
  points: PointTemplateUpsertInput[],
  userId?: string,
) => {
  const cat = await prisma.equipmentCategory.findFirst({ where: { id: categoryId, isDeleted: false } });
  if (!cat) throw NotFound('Category not found');

  const seqs = new Set(points.map((p) => p.sequence));
  if (seqs.size !== points.length) throw BadRequest('Point sequences must be unique');

  await prisma.$transaction([
    prisma.calibrationPointTemplate.deleteMany({ where: { categoryId } }),
    prisma.calibrationPointTemplate.createMany({
      data: points.map((p) => ({
        categoryId,
        sequence: p.sequence,
        label: p.label,
        nominalValue: p.nominal_value ?? null,
        nominalPercentOfSpan: p.nominal_percent_of_span ?? null,
        unitCode: p.unit_code ?? null,
        toleranceType: p.tolerance_type,
        toleranceValue: p.tolerance_value,
      })),
    }),
  ]);

  await trail(
    {
      entityType: 'EquipmentCategory',
      entityId: categoryId,
      action: 'UPDATE',
      field: 'pointTemplates',
      newValue: `${points.length} point(s)`,
    },
    userId,
  );

  return getCategory(categoryId);
};

/** Replaces the category's whole in-use checklist — atomic, like plan points. */
export const replaceCheckItems = async (
  categoryId: string,
  items: CheckItemUpsertInput[],
  userId?: string,
) => {
  const cat = await prisma.equipmentCategory.findFirst({ where: { id: categoryId, isDeleted: false } });
  if (!cat) throw NotFound('Category not found');

  const seqs = new Set(items.map((i) => i.sequence));
  if (seqs.size !== items.length) throw BadRequest('Checklist sequences must be unique');

  await prisma.$transaction([
    prisma.inUseCheckItem.deleteMany({ where: { categoryId } }),
    prisma.inUseCheckItem.createMany({
      data: items.map((i) => ({
        categoryId,
        sequence: i.sequence,
        label: i.label,
        checkType: i.check_type,
        nominalValue: i.check_type === 'NUMERIC' ? i.nominal_value ?? null : null,
        toleranceValue: i.check_type === 'NUMERIC' ? i.tolerance_value ?? null : null,
        unitCode: i.unit_code ?? null,
        isRequired: i.is_required ?? true,
        guidance: i.guidance ?? null,
      })),
    }),
  ]);

  await trail(
    { entityType: 'EquipmentCategory', entityId: categoryId, action: 'UPDATE', field: 'checkItems', newValue: `${items.length} item(s)` },
    userId,
  );
  return getCategory(categoryId);
};

/**
 * Resolve a category's templates into concrete plan points for one instrument —
 * span-relative nominals become real numbers, and every point gets stored limits.
 */
export const materializePoints = (
  templates: {
    sequence: number;
    label: string;
    nominalValue: Prisma.Decimal | null;
    nominalPercentOfSpan: Prisma.Decimal | null;
    unitCode: string | null;
    toleranceType: Prisma.EquipmentCategoryCreateInput['defaultToleranceType'];
    toleranceValue: Prisma.Decimal;
  }[],
  instrument: { measurementRangeMin: Prisma.Decimal | null; measurementRangeMax: Prisma.Decimal | null; mpe: Prisma.Decimal | null },
) => {
  const lo = num(instrument.measurementRangeMin) ?? 0;
  const hi = num(instrument.measurementRangeMax) ?? 0;
  const span = hi - lo;

  return templates
    .slice()
    .sort((a, b) => a.sequence - b.sequence)
    .map((t) => {
      const pct = num(t.nominalPercentOfSpan);
      const nominal = pct !== null ? lo + (span * pct) / 100 : num(t.nominalValue) ?? 0;
      const tType = (t.toleranceType ?? 'ABSOLUTE') as 'ABSOLUTE';
      const tVal = num(t.toleranceValue) ?? 0;
      const limits = computeLimits({
        nominalValue: nominal,
        toleranceType: tType,
        toleranceValue: tVal,
        spanMin: lo,
        spanMax: hi,
        mpe: num(instrument.mpe),
      });
      return {
        sequence: t.sequence,
        label: t.label,
        nominalValue: nominal,
        unitCode: t.unitCode,
        toleranceType: tType,
        toleranceValue: tVal,
        lowerLimit: limits.lowerLimit,
        upperLimit: limits.upperLimit,
      };
    });
};
