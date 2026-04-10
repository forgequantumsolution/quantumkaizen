import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ── GET /api/analytics/nc-trends ─────────────────────────────────────────────
// Returns monthly NC counts for each of the last 3 fiscal years.
// Response: { data: { month: string; 2024: number; 2025: number; 2026: number }[] }
export const getNCTrends = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    const tenantId = req.user.tenantId;

    const threeYearsAgo = new Date();
    threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
    threeYearsAgo.setMonth(0, 1);
    threeYearsAgo.setHours(0, 0, 0, 0);

    const ncs = await prisma.nonConformance.findMany({
      where: { tenantId, createdAt: { gte: threeYearsAgo } },
      select: { createdAt: true },
    });

    const years = [2024, 2025, 2026];

    // Build month × year count grid
    const grid: Record<string, Record<number, number>> = {};
    for (let m = 0; m < 12; m++) {
      grid[MONTHS[m]] = { 2024: 0, 2025: 0, 2026: 0 };
    }

    for (const nc of ncs) {
      const d = new Date(nc.createdAt);
      const y = d.getFullYear();
      const m = MONTHS[d.getMonth()];
      if (years.includes(y) && grid[m]) {
        grid[m][y]++;
      }
    }

    const result = MONTHS.map(m => ({
      month: m,
      2024: grid[m][2024],
      2025: grid[m][2025],
      2026: grid[m][2026],
    }));

    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

// ── GET /api/analytics/heatmap ───────────────────────────────────────────────
// Returns daily NC counts for the last 49 days.
// Response: { data: { date: string; count: number }[] }
export const getHeatmap = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    const tenantId = req.user.tenantId;

    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const start = new Date();
    start.setDate(start.getDate() - 48);
    start.setHours(0, 0, 0, 0);

    const ncs = await prisma.nonConformance.findMany({
      where: { tenantId, createdAt: { gte: start, lte: today } },
      select: { createdAt: true },
    });

    const countMap: Record<string, number> = {};
    for (const nc of ncs) {
      const iso = new Date(nc.createdAt).toISOString().slice(0, 10);
      countMap[iso] = (countMap[iso] ?? 0) + 1;
    }

    const result: { date: string; count: number }[] = [];
    for (let i = 48; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      result.push({ date: iso, count: countMap[iso] ?? 0 });
    }

    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

// ── GET /api/analytics/kpi-comparison ────────────────────────────────────────
// Returns a year-by-year KPI comparison table.
// Response: { data: { metric: string; 2024: number; 2025: number; 2026: number }[] }
export const getKpiComparison = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    const tenantId = req.user.tenantId;

    const years = [2024, 2025, 2026];

    const rangesForYear = (y: number) => ({
      gte: new Date(`${y}-01-01T00:00:00.000Z`),
      lt: new Date(`${y + 1}-01-01T00:00:00.000Z`),
    });

    const results = await Promise.all(
      years.map(async (y) => {
        const range = rangesForYear(y);
        const [ncs, capas, audits, complaints] = await Promise.all([
          prisma.nonConformance.count({ where: { tenantId, createdAt: range } }),
          prisma.cAPA.count({ where: { tenantId, createdAt: range } }),
          prisma.audit.count({ where: { tenantId, createdAt: range } }),
          prisma.complaint.count({ where: { tenantId, createdAt: range } }),
        ]);
        return { year: y, ncs, capas, audits, complaints };
      }),
    );

    const metrics = [
      { key: 'ncs', label: 'Non-Conformances' },
      { key: 'capas', label: 'CAPAs Raised' },
      { key: 'audits', label: 'Audits Conducted' },
      { key: 'complaints', label: 'Customer Complaints' },
    ] as const;

    const data = metrics.map(({ key, label }) => ({
      metric: label,
      2024: results.find(r => r.year === 2024)?.[key] ?? 0,
      2025: results.find(r => r.year === 2025)?.[key] ?? 0,
      2026: results.find(r => r.year === 2026)?.[key] ?? 0,
    }));

    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
};

// ── GET /api/analytics/audit-volume ─────────────────────────────────────────
// Returns monthly audit counts for each of the last 3 fiscal years.
export const getAuditVolume = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    const tenantId = req.user.tenantId;

    const threeYearsAgo = new Date();
    threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
    threeYearsAgo.setMonth(0, 1);
    threeYearsAgo.setHours(0, 0, 0, 0);

    const audits = await prisma.audit.findMany({
      where: { tenantId, createdAt: { gte: threeYearsAgo } },
      select: { createdAt: true },
    });

    const years = [2024, 2025, 2026];
    const grid: Record<string, Record<number, number>> = {};
    for (let m = 0; m < 12; m++) {
      grid[MONTHS[m]] = { 2024: 0, 2025: 0, 2026: 0 };
    }

    for (const a of audits) {
      const d = new Date(a.createdAt);
      const y = d.getFullYear();
      const m = MONTHS[d.getMonth()];
      if (years.includes(y) && grid[m]) grid[m][y]++;
    }

    const result = MONTHS.map(m => ({
      month: m,
      2024: grid[m][2024],
      2025: grid[m][2025],
      2026: grid[m][2026],
    }));

    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};
