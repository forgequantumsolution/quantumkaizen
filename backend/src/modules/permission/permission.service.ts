import { prisma } from '../../lib/prisma';

export interface PermissionGroup {
  module: string;
  permissions: {
    id: string;
    key: string;
    action: string;
    description: string;
  }[];
}

export const list = async () => {
  const all = await prisma.permission.findMany({
    orderBy: [{ module: 'asc' }, { action: 'asc' }],
  });
  return all;
};

export const grouped = async (): Promise<PermissionGroup[]> => {
  const all = await prisma.permission.findMany({
    orderBy: [{ module: 'asc' }, { action: 'asc' }],
  });
  const map = new Map<string, PermissionGroup>();
  for (const p of all) {
    if (!map.has(p.module)) map.set(p.module, { module: p.module, permissions: [] });
    map.get(p.module)!.permissions.push({
      id: p.id,
      key: p.key,
      action: p.action,
      description: p.description,
    });
  }
  return [...map.values()];
};
