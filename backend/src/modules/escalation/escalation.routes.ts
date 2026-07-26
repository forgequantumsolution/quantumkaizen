/**
 * Escalation-matrix admin routes — mounted at `/api/escalation-rules`.
 * One rule per department (plus a global default); each rule holds an ordered
 * ladder of levels. The SLA sweep reads these to auto-reassign tickets on
 * threshold/breach (see jobs/sweeps/applyEscalations.ts).
 */
import { Router } from 'express';
import * as ctrl from './escalation.controller';
import { IdParamSchema, UpsertEscalationRuleSchema } from './escalation.schema';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permissions';
import { asyncHandler } from '../../lib/asyncHandler';

const router = Router();

router.use(requireAuth);

router.get('/', requirePermission('escalation.read'), asyncHandler(ctrl.list));

// Distinct SLA threshold names, to populate the matrix editor's trigger dropdown.
router.get(
  '/threshold-names',
  requirePermission('escalation.read'),
  asyncHandler(ctrl.thresholdNames),
);

// Upsert (create-or-replace) the rule for a department / the global default.
router.put(
  '/',
  requirePermission('escalation.update'),
  validate(UpsertEscalationRuleSchema),
  asyncHandler(ctrl.upsert),
);

router.delete(
  '/:id',
  requirePermission('escalation.delete'),
  validate(IdParamSchema, 'params'),
  asyncHandler(ctrl.remove),
);

export default router;
