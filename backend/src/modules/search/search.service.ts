/**
 * Global search across GMP records (FQS-QK-UIUX-003 §4). One query hits the
 * entities an inspector/analyst looks up by reference number under time
 * pressure: samples, CAPAs, documents, tickets, OOS/OOT, CoAs. Read-only.
 *
 * NOTE: results are gated by auth only, not per-entity permission — a follow-up
 * should scope each entity to the caller's read permissions.
 */
import { prisma } from '../../lib/prisma';

export type SearchType = 'Sample' | 'CAPA' | 'Document' | 'Ticket' | 'OOS' | 'CoA';

export interface SearchHit {
  type: SearchType;
  id: string;
  title: string;    // human reference (sample number, CAPA number, …)
  subtitle: string; // secondary context (product, title, …)
  path: string;     // frontend detail route
}

const TAKE = 5; // per entity type
const ci = (q: string) => ({ contains: q, mode: 'insensitive' as const });
const join = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(' · ');

export async function search(qRaw: string): Promise<SearchHit[]> {
  const q = qRaw.trim();
  if (q.length < 2) return [];

  const [samples, capas, documents, tickets, oos, coas] = await Promise.all([
    prisma.sample.findMany({
      where: { isDeleted: false, OR: [{ sampleNumber: ci(q) }, { barcode: ci(q) }, { batchNo: ci(q) }, { productName: ci(q) }] },
      select: { id: true, sampleNumber: true, productName: true, batchNo: true },
      take: TAKE,
    }),
    prisma.capa.findMany({
      where: { OR: [{ capaNumber: ci(q) }, { title: ci(q) }, { description: ci(q) }] },
      select: { id: true, capaNumber: true, title: true },
      take: TAKE,
    }),
    prisma.document.findMany({
      where: { isDeleted: false, OR: [{ docNumber: ci(q) }, { title: ci(q) }, { description: ci(q) }] },
      select: { id: true, docNumber: true, title: true },
      take: TAKE,
    }),
    prisma.ticket.findMany({
      where: { isDeleted: false, OR: [{ uniqueId: ci(q) }, { title: ci(q) }, { description: ci(q) }] },
      select: { id: true, uniqueId: true, title: true },
      take: TAKE,
    }),
    prisma.oosInvestigation.findMany({
      where: { OR: [{ code: ci(q) }, { title: ci(q) }] },
      select: { id: true, code: true, title: true },
      take: TAKE,
    }),
    prisma.coa.findMany({
      where: { isDeleted: false, OR: [{ coaNumber: ci(q) }, { productName: ci(q) }, { batchNo: ci(q) }] },
      select: { id: true, coaNumber: true, productName: true, batchNo: true },
      take: TAKE,
    }),
  ]);

  return [
    ...samples.map((s): SearchHit => ({ type: 'Sample', id: s.id, title: s.sampleNumber, subtitle: join(s.productName, s.batchNo), path: `/lims/samples/${s.id}` })),
    ...capas.map((c): SearchHit => ({ type: 'CAPA', id: c.id, title: c.capaNumber, subtitle: c.title, path: `/audit/capa/${c.id}` })),
    ...documents.map((d): SearchHit => ({ type: 'Document', id: d.id, title: d.docNumber, subtitle: d.title, path: `/dms/${d.id}` })),
    ...tickets.map((t): SearchHit => ({ type: 'Ticket', id: t.id, title: t.uniqueId, subtitle: t.title, path: `/tickets/${t.id}` })),
    ...oos.map((o): SearchHit => ({ type: 'OOS', id: o.id, title: o.code, subtitle: o.title, path: `/lims/oos/${o.id}` })),
    ...coas.map((c): SearchHit => ({ type: 'CoA', id: c.id, title: c.coaNumber, subtitle: join(c.productName, c.batchNo), path: `/lims/coa/${c.id}` })),
  ];
}
