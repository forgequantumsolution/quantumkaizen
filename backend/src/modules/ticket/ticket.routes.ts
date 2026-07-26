import { Router } from 'express';
import * as ctrl from './ticket.controller';
import {
  AddCommentSchema,
  AssignTicketSchema,
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
import { requireTicketAction, requireTicketListAccess } from '../../middleware/permissions';
import { asyncHandler } from '../../lib/asyncHandler';

const router = Router();

router.use(requireAuth);

// CRUD — gated strictly per workflow type (see middleware/permissions.ts).
router.get('/', requireTicketListAccess,
  validate(ListTicketsQuerySchema, 'query'), asyncHandler(ctrl.list));

router.post('/', requireTicketAction('create', 'workflow'),
  validate(RaiseTicketSchema), asyncHandler(ctrl.create));

router.get('/:id', requireTicketAction('read'),
  validate(IdParamSchema, 'params'), asyncHandler(ctrl.get));

router.patch('/:id', requireTicketAction('update'),
  validate(IdParamSchema, 'params'), validate(UpdateTicketSchema), asyncHandler(ctrl.patch));

router.delete('/:id', requireTicketAction('delete'),
  validate(IdParamSchema, 'params'), asyncHandler(ctrl.remove));

// Assignment — (re)assign the responsible individual.
router.patch('/:id/assign', requireTicketAction('update'),
  validate(IdParamSchema, 'params'), validate(AssignTicketSchema), asyncHandler(ctrl.assign));

// Engine
router.get('/:id/allowed-actions', requireTicketAction('read'),
  validate(IdParamSchema, 'params'), asyncHandler(ctrl.allowedActions));

router.post('/:id/transition', requireTicketAction('transition'),
  validate(IdParamSchema, 'params'), validate(TransitionBodySchema), asyncHandler(ctrl.transition));

router.post('/:id/hold', requireTicketAction('transition'),
  validate(IdParamSchema, 'params'), validate(HoldBodySchema), asyncHandler(ctrl.hold));

router.post('/:id/resume', requireTicketAction('transition'),
  validate(IdParamSchema, 'params'), asyncHandler(ctrl.resume));

// Tracking / timeline
router.get('/:id/track', requireTicketAction('read'),
  validate(IdParamSchema, 'params'), asyncHandler(ctrl.track));

router.get('/:id/timeline', requireTicketAction('read'),
  validate(IdParamSchema, 'params'), asyncHandler(ctrl.timeline));

router.get('/:id/participants', requireTicketAction('read'),
  validate(IdParamSchema, 'params'), asyncHandler(ctrl.participants));

// Comments
router.post('/:id/comments', requireTicketAction('update'),
  validate(IdParamSchema, 'params'), validate(AddCommentSchema), asyncHandler(ctrl.addComment));

router.get('/:id/comments', requireTicketAction('read'),
  validate(IdParamSchema, 'params'), validate(ListCommentsQuerySchema, 'query'),
  asyncHandler(ctrl.listComments));

router.delete('/:id/comments/:commentId', requireTicketAction('update'),
  validate(CommentIdParamSchema, 'params'), asyncHandler(ctrl.deleteComment));

// Docs
router.post('/:id/docs', requireTicketAction('update'),
  validate(IdParamSchema, 'params'), validate(AttachDocSchema), asyncHandler(ctrl.attachDoc));

router.get('/:id/docs', requireTicketAction('read'),
  validate(IdParamSchema, 'params'), asyncHandler(ctrl.listDocs));

router.delete('/:id/docs/:docId', requireTicketAction('update'),
  validate(DocIdParamSchema, 'params'), asyncHandler(ctrl.deleteDoc));

// Spawn child
router.post('/:id/spawn-child', requireTicketAction('create'),
  validate(IdParamSchema, 'params'), validate(SpawnChildSchema), asyncHandler(ctrl.spawnChild));

// Direct children (one level)
router.get('/:id/children', requireTicketAction('read'),
  validate(IdParamSchema, 'params'), asyncHandler(ctrl.listChildren));

// Configured child-workflow triggers for the current stage(s) → raise options
router.get('/:id/child-triggers', requireTicketAction('read'),
  validate(IdParamSchema, 'params'), asyncHandler(ctrl.listStageChildTriggers));

export default router;
