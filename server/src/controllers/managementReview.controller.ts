import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { createAuditEntry } from '../services/auditLog.service.js';
import { parsePagination, buildPaginationResponse } from '../utils/pagination.js';

function auditParams(req: Request) {
  return {
    tenantId: req.user!.tenantId,
    userId: req.user!.id,
    userName: req.user!.name,
    userRole: req.user!.role,
    ipAddress: req.ip || '',
    sessionId: req.cookies?.sessionId || 'system',
    userAgent: req.headers['user-agent'] || '',
  };
}

export const getReviewSummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const tenantId = req.user.tenantId;
    const db = prisma as any;

    // Aggregate data from all modules concurrently
    const [
      ncStats,
      capaStats,
      riskStats,
      trainingStats,
      documentStats,
    ] = await Promise.all([
      // Non-Conformance stats
      prisma.nonConformance.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: { id: true },
      }),
      // CAPA stats
      prisma.cAPA.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: { id: true },
      }),
      // Risk stats
      prisma.riskRegister.groupBy({
        by: ['riskLevel'],
        where: { tenantId, status: 'ACTIVE' },
        _count: { id: true },
      }),
      // Training stats
      prisma.trainingAssignment.groupBy({
        by: ['status'],
        where: {
          program: { tenantId },
        },
        _count: { id: true },
      }),
      // Document stats
      prisma.document.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: { id: true },
      }),
    ]);

    // Build NC summary
    const ncSummary: Record<string, number> = {};
    let ncTotal = 0;
    for (const row of ncStats) {
      ncSummary[row.status] = row._count.id;
      ncTotal += row._count.id;
    }

    // Build CAPA summary
    const capaSummary: Record<string, number> = {};
    let capaTotal = 0;
    for (const row of capaStats) {
      capaSummary[row.status] = row._count.id;
      capaTotal += row._count.id;
    }

    // Build Risk summary
    const riskSummary: Record<string, number> = {};
    let riskTotal = 0;
    for (const row of riskStats) {
      riskSummary[row.riskLevel] = row._count.id;
      riskTotal += row._count.id;
    }

    // Build Training summary
    const trainingSummary: Record<string, number> = {};
    let trainingTotal = 0;
    for (const row of trainingStats) {
      trainingSummary[row.status] = row._count.id;
      trainingTotal += row._count.id;
    }

    // Build Document summary
    const documentSummary: Record<string, number> = {};
    let documentTotal = 0;
    for (const row of documentStats) {
      documentSummary[row.status] = row._count.id;
      documentTotal += row._count.id;
    }

    // Attempt to get optional module stats (may not have models yet)
    let complaintTotal = 0;
    let auditTotal = 0;
    let changeRequestTotal = 0;
    try {
      complaintTotal = await db.complaint.count({ where: { tenantId } });
    } catch { /* model may not exist yet */ }
    try {
      auditTotal = await db.auditPlan.count({ where: { tenantId } });
    } catch { /* model may not exist yet */ }
    try {
      changeRequestTotal = await db.changeRequest.count({ where: { tenantId } });
    } catch { /* model may not exist yet */ }

    res.status(200).json({
      data: {
        nonConformances: { total: ncTotal, byStatus: ncSummary },
        capas: { total: capaTotal, byStatus: capaSummary },
        risks: { total: riskTotal, byLevel: riskSummary },
        training: { total: trainingTotal, byStatus: trainingSummary },
        documents: { total: documentTotal, byStatus: documentSummary },
        complaints: { total: complaintTotal },
        audits: { total: auditTotal },
        changeRequests: { total: changeRequestTotal },
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const listMeetings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const pagination = parsePagination(req.query as Record<string, unknown>);
    const where: Record<string, unknown> = { tenantId: req.user.tenantId };

    if (req.query.status) where.status = req.query.status as string;
    if (req.query.year) {
      const year = parseInt(req.query.year as string, 10);
      where.meetingDate = {
        gte: new Date(`${year}-01-01`),
        lte: new Date(`${year}-12-31`),
      };
    }

    const db = prisma as any;
    const [meetings, total] = await Promise.all([
      db.managementReviewMeeting.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { [pagination.sortBy]: pagination.sortOrder },
      }),
      db.managementReviewMeeting.count({ where }),
    ]);

    res.status(200).json(buildPaginationResponse(meetings, total, pagination.page, pagination.limit));
  } catch (error) {
    next(error);
  }
};

export const createMeeting = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const {
      title, meetingDate, attendees, agenda, location, duration,
      reviewPeriodFrom, reviewPeriodTo,
    } = req.body;

    if (!title || !meetingDate) {
      throw new AppError('Title and meeting date are required', 400, 'VALIDATION_ERROR');
    }

    const db = prisma as any;

    const meeting = await db.managementReviewMeeting.create({
      data: {
        tenantId: req.user.tenantId,
        title,
        meetingDate: new Date(meetingDate),
        attendees: attendees || [],
        agenda: agenda || null,
        location: location || null,
        duration: duration || null,
        reviewPeriodFrom: reviewPeriodFrom ? new Date(reviewPeriodFrom) : null,
        reviewPeriodTo: reviewPeriodTo ? new Date(reviewPeriodTo) : null,
        status: 'PLANNED',
        createdById: req.user.id,
        actionItems: [],
        decisions: [],
      },
    });

    await createAuditEntry({
      ...auditParams(req),
      action: 'CREATE' as any,
      entityType: 'MANAGEMENT_REVIEW_MEETING',
      entityId: meeting.id,
      afterState: { title, meetingDate, status: 'PLANNED' },
      changedFields: ['title', 'meetingDate', 'status', 'attendees'],
    });

    res.status(201).json({ data: meeting });
  } catch (error) {
    next(error);
  }
};

export const addActionItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const { id } = req.params;
    const { description, assigneeId, dueDate, priority } = req.body;

    if (!description) {
      throw new AppError('Action item description is required', 400, 'VALIDATION_ERROR');
    }

    const db = prisma as any;

    const existing = await db.managementReviewMeeting.findFirst({
      where: { id, tenantId: req.user.tenantId },
    });

    if (!existing) {
      throw new AppError('Meeting not found', 404, 'MEETING_NOT_FOUND');
    }

    const existingActions = (existing.actionItems as any[]) || [];
    const newAction = {
      id: `action-${Date.now()}`,
      description,
      assigneeId: assigneeId || null,
      dueDate: dueDate || null,
      priority: priority || 'MEDIUM',
      status: 'OPEN',
      createdAt: new Date().toISOString(),
      createdById: req.user.id,
    };

    const updatedActions = [...existingActions, newAction];

    const meeting = await db.managementReviewMeeting.update({
      where: { id },
      data: { actionItems: updatedActions },
    });

    await createAuditEntry({
      ...auditParams(req),
      action: 'UPDATE' as any,
      entityType: 'MANAGEMENT_REVIEW_MEETING',
      entityId: id,
      beforeState: { actionItemsCount: existingActions.length },
      afterState: { actionItemsCount: updatedActions.length, addedAction: newAction },
      changedFields: ['actionItems'],
    });

    res.status(201).json({ data: meeting });
  } catch (error) {
    next(error);
  }
};

export const getReviewPack = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const { id } = req.params;
    const db = prisma as any;

    const meeting = await db.managementReviewMeeting.findFirst({
      where: { id, tenantId: req.user.tenantId },
    });

    if (!meeting) {
      throw new AppError('Meeting not found', 404, 'MEETING_NOT_FOUND');
    }

    const tenantId = req.user.tenantId;

    // Build date filter from review period
    const dateFilter: Record<string, unknown> = {};
    if (meeting.reviewPeriodFrom) {
      dateFilter.gte = new Date(meeting.reviewPeriodFrom);
    }
    if (meeting.reviewPeriodTo) {
      dateFilter.lte = new Date(meeting.reviewPeriodTo);
    }

    const createdAtFilter = Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {};

    // Gather data for the review pack
    const [
      ncSummary,
      capaSummary,
      riskSummary,
      trainingOverview,
      recentNCs,
      recentCAPAs,
    ] = await Promise.all([
      prisma.nonConformance.groupBy({
        by: ['status'],
        where: { tenantId, ...createdAtFilter },
        _count: { id: true },
      }),
      prisma.cAPA.groupBy({
        by: ['status'],
        where: { tenantId, ...createdAtFilter },
        _count: { id: true },
      }),
      prisma.riskRegister.groupBy({
        by: ['riskLevel'],
        where: { tenantId, status: 'ACTIVE' },
        _count: { id: true },
      }),
      prisma.trainingAssignment.groupBy({
        by: ['status'],
        where: { program: { tenantId } },
        _count: { id: true },
      }),
      prisma.nonConformance.findMany({
        where: { tenantId, ...createdAtFilter },
        select: { id: true, ncNumber: true, title: true, status: true, severity: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.cAPA.findMany({
        where: { tenantId, ...createdAtFilter },
        select: { id: true, capaNumber: true, title: true, status: true, severity: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    const ncByStatus: Record<string, number> = {};
    for (const row of ncSummary) {
      ncByStatus[row.status] = row._count.id;
    }

    const capaByStatus: Record<string, number> = {};
    for (const row of capaSummary) {
      capaByStatus[row.status] = row._count.id;
    }

    const riskByLevel: Record<string, number> = {};
    for (const row of riskSummary) {
      riskByLevel[row.riskLevel] = row._count.id;
    }

    const trainingByStatus: Record<string, number> = {};
    for (const row of trainingOverview) {
      trainingByStatus[row.status] = row._count.id;
    }

    res.status(200).json({
      data: {
        meeting: {
          id: meeting.id,
          title: meeting.title,
          meetingDate: meeting.meetingDate,
          reviewPeriodFrom: meeting.reviewPeriodFrom,
          reviewPeriodTo: meeting.reviewPeriodTo,
          agenda: meeting.agenda,
          attendees: meeting.attendees,
        },
        reviewData: {
          nonConformances: { byStatus: ncByStatus, recent: recentNCs },
          capas: { byStatus: capaByStatus, recent: recentCAPAs },
          risks: { byLevel: riskByLevel },
          training: { byStatus: trainingByStatus },
        },
        actionItems: meeting.actionItems || [],
        decisions: meeting.decisions || [],
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
};
