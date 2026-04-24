import { Router } from 'express';
import * as ctrl from './user.controller';
import { IdParamSchema, ListQuerySchema, UpdateUserSchema } from './user.schema';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { asyncHandler } from '../../lib/asyncHandler';

const router = Router();

router.use(requireAuth);

router.get('/', validate(ListQuerySchema, 'query'), asyncHandler(ctrl.list));
router.get('/:id', validate(IdParamSchema, 'params'), asyncHandler(ctrl.get));
router.patch(
  '/:id',
  validate(IdParamSchema, 'params'),
  validate(UpdateUserSchema),
  asyncHandler(ctrl.patch)
);
router.delete('/:id', validate(IdParamSchema, 'params'), asyncHandler(ctrl.remove));

export default router;
