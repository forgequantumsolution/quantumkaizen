import { Router } from 'express';
import * as ctrl from './role.controller';
import {
  CreateRoleSchema,
  IdParamSchema,
  ListQuerySchema,
  UpdateRoleSchema,
} from './role.schema';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { asyncHandler } from '../../lib/asyncHandler';

const router = Router();

router.use(requireAuth);

router.get('/', validate(ListQuerySchema, 'query'), asyncHandler(ctrl.list));
router.get('/:id', validate(IdParamSchema, 'params'), asyncHandler(ctrl.get));
router.post('/', validate(CreateRoleSchema), asyncHandler(ctrl.create));
router.patch(
  '/:id',
  validate(IdParamSchema, 'params'),
  validate(UpdateRoleSchema),
  asyncHandler(ctrl.patch)
);
router.delete('/:id', validate(IdParamSchema, 'params'), asyncHandler(ctrl.remove));

export default router;
