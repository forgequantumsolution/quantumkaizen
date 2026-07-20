import { prisma } from '../../lib/prisma';
import { Conflict, NotFound } from '../../lib/httpError';
import { INDUSTRIES, type UpdateOrganizationInput } from './organization.schema';

export const getCurrent = async () => {
  const org = await prisma.organization.findFirst({
    orderBy: { createdAt: 'asc' },
  });
  if (!org) throw NotFound('Organization not configured');
  return org;
};

export const update = async (input: UpdateOrganizationInput) => {
  const current = await getCurrent();

  if (input.tenantCode && input.tenantCode !== current.tenantCode) {
    const conflict = await prisma.organization.findUnique({
      where: { tenantCode: input.tenantCode },
      select: { id: true },
    });
    if (conflict && conflict.id !== current.id) throw Conflict('Tenant code already in use');
  }

  return prisma.organization.update({
    where: { id: current.id },
    data: {
      name: input.name,
      tenantCode: input.tenantCode,
      industry: input.industry,
      website: input.website === '' ? null : input.website,
      address: input.address,
      standards: input.standards,
      timezone: input.timezone,
      dateFormat: input.dateFormat,
      logoUrl: input.logoUrl === '' ? null : input.logoUrl,
      reportFooterText: input.reportFooterText === '' ? null : input.reportFooterText,
    },
  });
};

export const listIndustries = () => INDUSTRIES;
