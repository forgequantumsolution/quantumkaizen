import prisma from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';

interface WorkflowStage {
  name: string;
  order: number;
  assigneeRole?: string;
  assigneeUserId?: string;
  slaDays: number;
  isParallel: boolean;
}

export async function initiateApproval(
  tenantId: string,
  workflowId: string,
  entityType: string,
  entityId: string,
  requestedById: string
) {
  const workflow = await prisma.approvalWorkflow.findUnique({ where: { id: workflowId } });
  if (!workflow || !workflow.isActive) {
    throw new AppError('Approval workflow not found or inactive', 404, 'WORKFLOW_NOT_FOUND');
  }

  const request = await prisma.approvalRequest.create({
    data: {
      tenantId,
      workflowId,
      entityType,
      entityId,
      currentStage: 1,
      status: 'PENDING',
      requestedById,
      requestedAt: new Date(),
    },
  });

  return request;
}

export async function processApprovalAction(
  approvalRequestId: string,
  userId: string,
  userName: string,
  action: 'APPROVED' | 'REJECTED' | 'RETURNED' | 'DELEGATED',
  comment?: string,
  signatureId?: string
) {
  const request = await prisma.approvalRequest.findUnique({
    where: { id: approvalRequestId },
    include: { workflow: true },
  });

  if (!request) {
    throw new AppError('Approval request not found', 404, 'APPROVAL_NOT_FOUND');
  }

  if (request.status !== 'PENDING') {
    throw new AppError('Approval request is not pending', 400, 'INVALID_STATUS');
  }

  const approvalAction = await prisma.approvalAction.create({
    data: {
      approvalRequestId,
      stage: request.currentStage,
      action,
      userId,
      userName,
      comment: comment || null,
      signatureId: signatureId || null,
      actionAt: new Date(),
    },
  });

  const stages = request.workflow.stages as unknown as WorkflowStage[];
  const totalStages = stages.length;

  if (action === 'APPROVED') {
    if (request.currentStage >= totalStages) {
      await prisma.approvalRequest.update({
        where: { id: approvalRequestId },
        data: { status: 'APPROVED', completedAt: new Date() },
      });
    } else {
      await prisma.approvalRequest.update({
        where: { id: approvalRequestId },
        data: { currentStage: request.currentStage + 1 },
      });
    }
  } else if (action === 'REJECTED') {
    await prisma.approvalRequest.update({
      where: { id: approvalRequestId },
      data: { status: 'REJECTED', completedAt: new Date() },
    });
  } else if (action === 'RETURNED') {
    await prisma.approvalRequest.update({
      where: { id: approvalRequestId },
      data: { currentStage: 1, status: 'PENDING' },
    });
  }

  return approvalAction;
}

export async function getApprovalStatus(entityType: string, entityId: string) {
  const request = await prisma.approvalRequest.findFirst({
    where: { entityType, entityId },
    include: {
      workflow: true,
      actions: { orderBy: { actionAt: 'asc' } },
    },
    orderBy: { requestedAt: 'desc' },
  });

  return request;
}
