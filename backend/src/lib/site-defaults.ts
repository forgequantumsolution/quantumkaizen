/**
 * Idempotent default-Site provisioning + backfill, run once at API startup.
 *
 * Why: tickets and users are being made Site-scoped (a user only sees their
 * site's tickets, enforced server-side). Any user or ticket with a NULL siteId
 * would fall outside every scope and become invisible. This guarantees a single
 * "Headquarters" (HQ) site exists and that every pre-existing user + ticket is
 * attached to it, so nothing is orphaned when enforcement turns on.
 *
 * Safe + narrow:
 *   - find-or-create the HQ site (the seed already defines it; reuse if present);
 *   - set siteId = HQ ONLY on rows where it is currently NULL (never reassigns).
 */
import { prisma } from './prisma';

const DEFAULT_SITE_CODE = 'HQ';
const DEFAULT_SITE_NAME = 'Headquarters';

let cachedDefaultSiteId: string | null = null;

/** Find-or-create the default HQ site; returns its id. Cached after first call. */
export async function ensureDefaultSite(): Promise<string> {
  if (cachedDefaultSiteId) return cachedDefaultSiteId;

  const existing = await prisma.site.findUnique({
    where: { code: DEFAULT_SITE_CODE },
    select: { id: true },
  });
  if (existing) {
    cachedDefaultSiteId = existing.id;
    return existing.id;
  }

  const created = await prisma.site.create({
    data: { code: DEFAULT_SITE_CODE, name: DEFAULT_SITE_NAME },
    select: { id: true },
  });
  cachedDefaultSiteId = created.id;
  return created.id;
}

/** The default site id if known (post-`ensureDefaultSite`); null otherwise. */
export const getDefaultSiteId = (): string | null => cachedDefaultSiteId;

/** Ensure HQ exists, then attach every NULL-site user + ticket to it. */
export async function ensureDefaultSiteAndBackfill(): Promise<void> {
  const siteId = await ensureDefaultSite();

  const [users, tickets] = await Promise.all([
    prisma.user.updateMany({ where: { siteId: null }, data: { siteId } }),
    prisma.ticket.updateMany({ where: { siteId: null }, data: { siteId } }),
  ]);

  if (users.count > 0 || tickets.count > 0) {
    console.log(
      `[site-defaults] backfilled ${users.count} user(s) and ${tickets.count} ticket(s) to ${DEFAULT_SITE_CODE}`,
    );
  }
}
