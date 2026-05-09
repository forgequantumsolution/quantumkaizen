import { Router } from 'express';
import * as ctrl from './ticket.controller';
import {
  AddCommentSchema,
  AttachDocSchema,
  CommentIdParamSchema,
  DocIdParamSchema,
  HoldBodySchema,
  IdParamSchema,
  ListCommentsQuerySchema,
  ListTicketsQuerySchema,
  RaiseTicketSchema,
  SpawnChildSchema,
  TransitionBodySchema,
  UpdateTicketSchema,
} from './ticket.schema';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permissions';
import { asyncHandler } from '../../lib/asyncHandler';

const router = Router();

router.use(requireAuth);

// CRUD
router.get('/', requirePermission('ticket.read'),
  validate(ListTicketsQuerySchema, 'query'), asyncHandler(ctrl.list));

router.post('/', requirePermission('ticket.create'),
  validate(RaiseTicketSchema), asyncHandler(ctrl.create));

router.get('/:id', requirePermission('ticket.read'),
  validate(IdParamSchema, 'params'), asyncHandler(ctrl.get));

router.patch('/:id', requirePermission('ticket.update'),
  validate(IdParamSchema, 'params'), validate(UpdateTicketSchema), asyncHandler(ctrl.patch));

router.delete('/:id', requirePermission('ticket.delete'),
  validate(IdParamSchema, 'params'), asyncHandler(ctrl.remove));

// Engine
router.get('/:id/allowed-actions', requirePermission('ticket.read'),
  validate(IdParamSchema, 'params'), asyncHandler(ctrl.allowedActions));

router.post('/:id/transition', requirePermission('ticket.transition'),
  validate(IdParamSchema, 'params'), validate(TransitionBodySchema), asyncHandler(ctrl.transition));

router.post('/:id/hold', requirePermission('ticket.transition'),
  validate(IdParamSchema, 'params'), validate(HoldBodySchema), asyncHandler(ctrl.hold));

router.post('/:id/resume', requirePermission('ticket.transition'),
  validate(IdParamSchema, 'params'), asyncHandler(ctrl.resume));

// Tracking / timeline
router.get('/:id/track', requirePermission('ticket.read'),
  validate(IdParamSchema, 'params'), asyncHandler(ctrl.track));

router.get('/:id/timeline', requirePermission('ticket.read'),
  validate(IdParamSchema, 'params'), asyncHandler(ctrl.timeline));

router.get('/:id/participants', requirePermission('ticket.read'),
  validate(IdParamSchema, 'params'), asyncHandler(ctrl.participants));

// Comments
router.post('/:id/comments', requirePermission('ticket.update'),
  validate(IdParamSchema, 'params'), validate(AddCommentSchema), asyncHandler(ctrl.addComment));

router.get('/:id/comments', requirePermission('ticket.read'),
  validate(IdParamSchema, 'params'), validate(ListCommentsQuerySchema, 'query'),
  asyncHandler(ctrl.listComments));

router.delete('/:id/comments/:commentId', requirePermission('ticket.update'),
  validate(CommentIdParamSchema, 'params'), asyncHandler(ctrl.deleteComment));

// Docs
router.post('/:id/docs', requirePermission('ticket.update'),
  validate(IdParamSchema, 'params'), validate(AttachDocSchema), asyncHandler(ctrl.attachDoc));

router.get('/:id/docs', requirePermission('ticket.read'),
  validate(IdParamSchema, 'params'), asyncHandler(ctrl.listDocs));

router.delete('/:id/docs/:docId', requirePermission('ticket.update'),
  validate(DocIdParamSchema, 'params'), asyncHandler(ctrl.deleteDoc));

// Spawn child
router.post('/:id/spawn-child', requirePermission('ticket.create'),
  validate(IdParamSchema, 'params'), validate(SpawnChildSchema), asyncHandler(ctrl.spawnChild));

export default router;
