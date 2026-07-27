/**
 * Risk appetite — how much risk the organisation is prepared to carry
 * (ISO 31000 §6.3.4, ISO 9001 §6.1).
 *
 * Without this a risk register records what the risks *are* and never what the
 * organisation has decided is *tolerable*, which is the difference between a
 * register and risk governance. A risk resolving above tolerance is flagged
 * wherever it appears, and — when the appetite demands it — cannot be accepted
 * on a risk owner's signature alone.
 *
 * Tolerance is stored as a normalised 0-100 severity rank rather than a level
 * id, which is what lets one organisation-wide statement span frameworks. A
 * level id would have forced one appetite statement per framework, which is not
 * what the standard describes.
 *
 * See docs/RISK-cross-module-integration-plan.md §D.17.
 */
import { prisma } from '../../lib/prisma';
import { NotFound } from '../../lib/httpError';
import { writeTrail } from '../audit/compliance.service';
import type { AppetiteUpsert } from './risk.schema';

const serialize = (a: {
  id: string;
  name: string;
  organizationId: string | null;
  siteId: string | null;
  categoryId: string | null;
  toleranceRank: number;
  statement: string | null;
  requiresBoardReview: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: a.id,
  name: a.name,
  organization_id: a.organizationId,
  site_id: a.siteId,
  category_id: a.categoryId,
  tolerance_rank: a.toleranceRank,
  statement: a.statement,
  requires_board_review: a.requiresBoardReview,
  is_active: a.isActive,
  created_at: a.createdAt,
  updated_at: a.updatedAt,
});

export const listAppetites = async () => {
  const rows = await prisma.riskAppetite.findMany({
    orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
  });
  return rows.map(serialize);
};

export const createAppetite = async (body: AppetiteUpsert, userId?: string) => {
  const created = await prisma.riskAppetite.create({
    data: {
      name: body.name,
      organizationId: body.organizationId ?? null,
      siteId: body.siteId ?? null,
      categoryId: body.categoryId ?? null,
      toleranceRank: body.toleranceRank,
      statement: body.statement ?? null,
      requiresBoardReview: body.requiresBoardReview,
      isActive: body.isActive,
      createdById: userId ?? null,
    },
  });
  await writeTrail(
    { entityType: 'RiskAppetite', entityId: created.id, action: 'CREATE', newValue: created.name },
    userId,
  );
  return serialize(created);
};

export const updateAppetite = async (id: string, body: AppetiteUpsert, userId?: string) => {
  const existing = await prisma.riskAppetite.findUnique({ where: { id } });
  if (!existing) throw NotFound('Risk appetite not found');
  const updated = await prisma.riskAppetite.update({
    where: { id },
    data: {
      name: body.name,
      organizationId: body.organizationId ?? null,
      siteId: body.siteId ?? null,
      categoryId: body.categoryId ?? null,
      toleranceRank: body.toleranceRank,
      statement: body.statement ?? null,
      requiresBoardReview: body.requiresBoardReview,
      isActive: body.isActive,
    },
  });
  await writeTrail(
    {
      entityType: 'RiskAppetite',
      entityId: id,
      action: 'UPDATE',
      oldValue: `${existing.name} (rank ${existing.toleranceRank})`,
      newValue: `${updated.name} (rank ${updated.toleranceRank})`,
    },
    userId,
  );
  return serialize(updated);
};

export const deleteAppetite = async (id: string, userId?: string) => {
  const existing = await prisma.riskAppetite.findUnique({ where: { id } });
  if (!existing) throw NotFound('Risk appetite not found');
  await prisma.riskAppetite.delete({ where: { id } });
  await writeTrail(
    { entityType: 'RiskAppetite', entityId: id, action: 'DELETE', oldValue: existing.name },
    userId,
  );
};
