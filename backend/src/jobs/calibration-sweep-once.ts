/**
 * Ad-hoc calibration sweep — `npm run calibration:sweep`.
 *
 * Same entry point the worker uses, so a tenant with no Redis can still keep
 * calibration statuses honest from cron.
 */
import { runAsSystem } from '../lib/audit-context';
import { prisma } from '../lib/prisma';
import { runAllCalibrationSweeps } from '../modules/calibration/sweep.service';

(async () => {
  const result = await runAsSystem('job:calibration-sweep', () => runAllCalibrationSweeps());
  console.log(JSON.stringify(result, null, 2));
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error('calibration sweep failed', e);
  await prisma.$disconnect();
  process.exit(1);
});
