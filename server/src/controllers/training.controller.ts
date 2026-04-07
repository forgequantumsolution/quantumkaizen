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

export const listPrograms = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const pagination = parsePagination(req.query as Record<string, unknown>);
    const where: Record<string, unknown> = { tenantId: req.user.tenantId };

    if (req.query.type) where.type = req.query.type as string;
    if (req.query.isActive !== undefined) where.isActive = req.query.isActive === 'true';

    if (req.query.search) {
      where.OR = [
        { title: { contains: req.query.search as string, mode: 'insensitive' } },
        { description: { contains: req.query.search as string, mode: 'insensitive' } },
      ];
    }

    const [programs, total] = await Promise.all([
      prisma.trainingProgram.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        include: {
          _count: { select: { assignments: true } },
        },
        orderBy: { [pagination.sortBy]: pagination.sortOrder },
      }),
      prisma.trainingProgram.count({ where }),
    ]);

    res.status(200).json(buildPaginationResponse(programs, total, pagination.page, pagination.limit));
  } catch (error) {
    next(error);
  }
};

export const getProgramById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const { id } = req.params;

    const program = await prisma.trainingProgram.findFirst({
      where: { id, tenantId: req.user.tenantId },
      include: {
        assignments: {
          orderBy: { assignedAt: 'desc' },
        },
        _count: { select: { assignments: true } },
      },
    });

    if (!program) {
      throw new AppError('Training program not found', 404, 'PROGRAM_NOT_FOUND');
    }

    res.status(200).json({ data: program });
  } catch (error) {
    next(error);
  }
};

export const createProgram = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const {
      title, description, type, content, assessmentQuestions,
      passingScore, validityDays,
    } = req.body;

    if (!title || !type) {
      throw new AppError('Title and type are required', 400, 'VALIDATION_ERROR');
    }

    const program = await prisma.trainingProgram.create({
      data: {
        tenantId: req.user.tenantId,
        title,
        description: description || null,
        type: type as any,
        content: content || null,
        assessmentQuestions: assessmentQuestions || null,
        passingScore: passingScore || 80,
        validityDays: validityDays || null,
        isActive: true,
      },
    });

    await createAuditEntry({
      ...auditParams(req),
      action: 'CREATE' as any,
      entityType: 'TRAINING_PROGRAM',
      entityId: program.id,
      afterState: { title, type, passingScore: passingScore || 80 },
      changedFields: ['title', 'type', 'passingScore', 'isActive'],
    });

    res.status(201).json({ data: program });
  } catch (error) {
    next(error);
  }
};

export const updateProgram = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const { id } = req.params;

    const existing = await prisma.trainingProgram.findFirst({
      where: { id, tenantId: req.user.tenantId },
    });

    if (!existing) {
      throw new AppError('Training program not found', 404, 'PROGRAM_NOT_FOUND');
    }

    const allowedFields = [
      'title', 'description', 'type', 'content', 'assessmentQuestions',
      'passingScore', 'validityDays', 'isActive',
    ];

    const updateData: Record<string, unknown> = {};
    const changedFields: string[] = [];
    const beforeState: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
        changedFields.push(field);
        beforeState[field] = (existing as any)[field];
      }
    }

    const program = await prisma.trainingProgram.update({
      where: { id },
      data: updateData,
    });

    await createAuditEntry({
      ...auditParams(req),
      action: 'UPDATE' as any,
      entityType: 'TRAINING_PROGRAM',
      entityId: id,
      beforeState,
      afterState: updateData,
      changedFields,
    });

    res.status(200).json({ data: program });
  } catch (error) {
    next(error);
  }
};

export const assignUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const { id } = req.params;
    const { userIds, dueDate } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      throw new AppError('userIds array is required', 400, 'VALIDATION_ERROR');
    }

    const program = await prisma.trainingProgram.findFirst({
      where: { id, tenantId: req.user.tenantId },
    });

    if (!program) {
      throw new AppError('Training program not found', 404, 'PROGRAM_NOT_FOUND');
    }

    // Calculate expiry based on validity days
    const expiresAt = program.validityDays
      ? new Date(Date.now() + program.validityDays * 24 * 60 * 60 * 1000)
      : null;

    const assignments = await Promise.all(
      userIds.map(async (userId: string) => {
        // Check if assignment already exists
        const existingAssignment = await prisma.trainingAssignment.findFirst({
          where: { programId: id, userId },
        });

        if (existingAssignment) {
          return existingAssignment;
        }

        return prisma.trainingAssignment.create({
          data: {
            programId: id,
            userId,
            status: 'NOT_STARTED' as any,
            dueDate: dueDate ? new Date(dueDate) : null,
            expiresAt,
          },
        });
      }),
    );

    await createAuditEntry({
      ...auditParams(req),
      action: 'CREATE' as any,
      entityType: 'TRAINING_ASSIGNMENT',
      entityId: id,
      afterState: { programId: id, assignedUserCount: userIds.length, userIds },
      changedFields: ['programId', 'userIds', 'dueDate'],
    });

    res.status(201).json({ data: assignments });
  } catch (error) {
    next(error);
  }
};

export const completeAssignment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const { id } = req.params;
    const { score } = req.body;

    const assignment = await prisma.trainingAssignment.findFirst({
      where: { id },
      include: { program: true },
    });

    if (!assignment) {
      throw new AppError('Training assignment not found', 404, 'ASSIGNMENT_NOT_FOUND');
    }

    // Verify the assignment belongs to a program in this tenant
    if (assignment.program.tenantId !== req.user.tenantId) {
      throw new AppError('Training assignment not found', 404, 'ASSIGNMENT_NOT_FOUND');
    }

    if (assignment.status === 'COMPLETED') {
      throw new AppError('Assignment is already completed', 400, 'ALREADY_COMPLETED');
    }

    const passed = score !== undefined ? score >= assignment.program.passingScore : true;
    const newStatus = passed ? 'COMPLETED' : 'IN_PROGRESS';

    const updatedAssignment = await prisma.trainingAssignment.update({
      where: { id },
      data: {
        status: newStatus as any,
        completedAt: passed ? new Date() : null,
        score: score !== undefined ? score : null,
      },
    });

    await createAuditEntry({
      ...auditParams(req),
      action: 'UPDATE' as any,
      entityType: 'TRAINING_ASSIGNMENT',
      entityId: id,
      beforeState: { status: assignment.status, score: assignment.score },
      afterState: { status: newStatus, score, passed },
      changedFields: ['status', 'completedAt', 'score'],
    });

    res.status(200).json({
      data: {
        ...updatedAssignment,
        passed,
        passingScore: assignment.program.passingScore,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getCompetencyMatrix = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const where: Record<string, unknown> = { tenantId: req.user.tenantId };

    if (req.query.roleOrUserId) where.roleOrUserId = req.query.roleOrUserId as string;
    if (req.query.programId) where.programId = req.query.programId as string;

    const matrix = await prisma.competencyMatrix.findMany({
      where,
      include: {
        program: {
          select: { id: true, title: true, type: true },
        },
      },
      orderBy: { roleOrUserId: 'asc' },
    });

    // Enrich with assignment status data
    const enrichedMatrix = await Promise.all(
      matrix.map(async (entry) => {
        const assignment = await prisma.trainingAssignment.findFirst({
          where: {
            programId: entry.programId,
            userId: entry.roleOrUserId,
          },
          orderBy: { assignedAt: 'desc' },
        });

        return {
          ...entry,
          assignmentStatus: assignment?.status || 'NOT_ASSIGNED',
          completedAt: assignment?.completedAt || null,
          score: assignment?.score || null,
          expiresAt: assignment?.expiresAt || null,
        };
      }),
    );

    res.status(200).json({ data: enrichedMatrix });
  } catch (error) {
    next(error);
  }
};

export const getComplianceReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    // Get all training programs for this tenant
    const programs = await prisma.trainingProgram.findMany({
      where: { tenantId: req.user.tenantId, isActive: true },
      select: { id: true, title: true, type: true },
    });

    // Get all assignments
    const assignments = await prisma.trainingAssignment.findMany({
      where: {
        program: { tenantId: req.user.tenantId },
      },
      select: {
        programId: true,
        userId: true,
        status: true,
        completedAt: true,
        dueDate: true,
        expiresAt: true,
      },
    });

    // Get required competencies
    const competencies = await prisma.competencyMatrix.findMany({
      where: { tenantId: req.user.tenantId, isRequired: true },
      select: { roleOrUserId: true, programId: true },
    });

    const now = new Date();

    // Calculate stats per program
    const programStats = programs.map((program) => {
      const programAssignments = assignments.filter((a) => a.programId === program.id);
      const total = programAssignments.length;
      const completed = programAssignments.filter((a) => a.status === 'COMPLETED').length;
      const overdue = programAssignments.filter(
        (a) => a.status !== 'COMPLETED' && a.dueDate && new Date(a.dueDate) < now,
      ).length;
      const expired = programAssignments.filter(
        (a) => a.expiresAt && new Date(a.expiresAt) < now,
      ).length;
      const inProgress = programAssignments.filter((a) => a.status === 'IN_PROGRESS').length;
      const notStarted = programAssignments.filter((a) => a.status === 'NOT_STARTED').length;

      return {
        programId: program.id,
        programTitle: program.title,
        programType: program.type,
        total,
        completed,
        inProgress,
        notStarted,
        overdue,
        expired,
        completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    });

    const totalAssignments = assignments.length;
    const totalCompleted = assignments.filter((a) => a.status === 'COMPLETED').length;
    const totalOverdue = assignments.filter(
      (a) => a.status !== 'COMPLETED' && a.dueDate && new Date(a.dueDate) < now,
    ).length;

    res.status(200).json({
      data: {
        overall: {
          totalPrograms: programs.length,
          totalAssignments,
          totalCompleted,
          totalOverdue,
          totalRequired: competencies.length,
          overallCompletionRate: totalAssignments > 0
            ? Math.round((totalCompleted / totalAssignments) * 100)
            : 0,
        },
        byProgram: programStats,
      },
    });
  } catch (error) {
    next(error);
  }
};
