import { Router } from 'express';
import * as ctrl from './finding.controller';
import {
  FindingIdParamSchema,
  TicketIdParamSchema,
  FindingUpsertSchema,
  FindingUpdateSchema,
  ListFindingQuerySchema,
  RaiseChildSchema,
} from './finding.schema';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { requireFindingAction } from '../../middleware/permissions';
import { asyncHandler } from '../../lib/asyncHandler';

const router = Router();

router.use(requireAuth);

// Per-module register (typeId from ?workflow_type_id) + per-ticket list.
router.get(
  '/findings',
  validate(ListFindingQuerySchema, 'query'),
  requireFindingAction('read', 'query'),
  asyncHandler(ctrl.listFindings),
);
router.get(
  '/tickets/:ticketId/findings',
  validate(TicketIdParamSchema, 'params'),
  requireFindingAction('read', 'ticketParam'),
  asyncHandler(ctrl.listFindingsForTicket),
);

// Manual CRUD (fallback).
router.post(
  '/findings',
  validate(FindingUpsertSchema),
  requireFindingAction('create', 'body'),
  asyncHandler(ctrl.createFinding),
);
router.put(
  '/findings/:id',
  validate(FindingIdParamSchema, 'params'),
  validate(FindingUpdateSchema),
  requireFindingAction('update', 'finding'),
  asyncHandler(ctrl.updateFinding),
);
router.delete(
  '/findings/:id',
  validate(FindingIdParamSchema, 'params'),
  requireFindingAction('delete', 'finding'),
  asyncHandler(ctrl.deleteFinding),
);

// Raise a child ticket (CAPA / Deviation) + list a finding's children.
router.post(
  '/findings/:id/raise-child',
  validate(FindingIdParamSchema, 'params'),
  validate(RaiseChildSchema),
  requireFindingAction('create', 'finding'),
  asyncHandler(ctrl.raiseChild),
);
router.get(
  '/findings/:id/children',
  validate(FindingIdParamSchema, 'params'),
  requireFindingAction('read', 'finding'),
  asyncHandler(ctrl.listFindingChildren),
);

export default router;
