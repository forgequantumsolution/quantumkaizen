/**
 * BusinessCalendar module routes — mounted at `/api/business-calendars`.
 */
import { Router } from 'express';
import * as ctrl from './business-calendar.controller';
import {
  CreateBusinessCalendarSchema,
  IdParamSchema,
  ListCalendarsQuerySchema,
  UpdateBusinessCalendarSchema,
} from './business-calendar.schema';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permissions';
import { asyncHandler } from '../../lib/asyncHandler';

const router = Router();

router.use(requireAuth);

router.get(
  '/',
  requirePermission('business-calendar.read'),
  validate(ListCalendarsQuerySchema, 'query'),
  asyncHandler(ctrl.list),
);

router.post(
  '/',
  requirePermission('business-calendar.create'),
  validate(CreateBusinessCalendarSchema),
  asyncHandler(ctrl.create),
);

router.get(
  '/:id',
  requirePermission('business-calendar.read'),
  validate(IdParamSchema, 'params'),
  asyncHandler(ctrl.getById),
);

router.patch(
  '/:id',
  requirePermission('business-calendar.update'),
  validate(IdParamSchema, 'params'),
  validate(UpdateBusinessCalendarSchema),
  asyncHandler(ctrl.update),
);

router.delete(
  '/:id',
  requirePermission('business-calendar.delete'),
  validate(IdParamSchema, 'params'),
  asyncHandler(ctrl.softDelete),
);

export default router;
