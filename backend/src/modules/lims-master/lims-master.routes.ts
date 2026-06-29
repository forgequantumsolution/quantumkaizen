/**
 * LIMS 2.0 — L0 master-data routes, mounted at /api/lims-master.
 * Products, Analytes, Units of Measure, Sampling Points, Customers, Suppliers.
 */
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permissions';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../lib/asyncHandler';

import * as product from './product.controller';
import * as analyte from './analyte.controller';
import * as unit from './unit.controller';
import * as samplingPoint from './sampling-point.controller';
import * as customer from './customer.controller';
import * as supplier from './supplier.controller';

import { ListProductQuerySchema, ProductUpsertSchema } from './product.schema';
import { ListAnalyteQuerySchema, AnalyteUpsertSchema } from './analyte.schema';
import { ListUnitQuerySchema, UnitUpsertSchema } from './unit.schema';
import { ListSamplingPointQuerySchema, SamplingPointUpsertSchema } from './sampling-point.schema';
import { ListCustomerQuerySchema, CustomerUpsertSchema } from './customer.schema';
import { ListSupplierQuerySchema, SupplierUpsertSchema } from './supplier.schema';

const router = Router();
router.use(requireAuth);

type Ctrl = { list: any; get: any; create: any; update: any; remove: any };
const crud = (base: string, key: string, ctrl: Ctrl, listSchema: any, upsertSchema: any) => {
  router.get(`/${base}`, requirePermission(`${key}.read`), validate(listSchema, 'query'), asyncHandler(ctrl.list));
  router.get(`/${base}/:id`, requirePermission(`${key}.read`), asyncHandler(ctrl.get));
  router.post(`/${base}`, requirePermission(`${key}.create`), validate(upsertSchema), asyncHandler(ctrl.create));
  router.put(`/${base}/:id`, requirePermission(`${key}.update`), validate(upsertSchema), asyncHandler(ctrl.update));
  router.delete(`/${base}/:id`, requirePermission(`${key}.delete`), asyncHandler(ctrl.remove));
};

crud('products', 'product', product, ListProductQuerySchema, ProductUpsertSchema);
crud('analytes', 'analyte', analyte, ListAnalyteQuerySchema, AnalyteUpsertSchema);
crud('units', 'unit', unit, ListUnitQuerySchema, UnitUpsertSchema);
crud('sampling-points', 'sampling_point', samplingPoint, ListSamplingPointQuerySchema, SamplingPointUpsertSchema);
crud('customers', 'customer', customer, ListCustomerQuerySchema, CustomerUpsertSchema);
crud('suppliers', 'supplier', supplier, ListSupplierQuerySchema, SupplierUpsertSchema);

export default router;
