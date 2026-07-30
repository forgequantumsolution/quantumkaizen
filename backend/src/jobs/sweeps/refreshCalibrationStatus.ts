/** Sweep: recompute calibration status, spawn due calibrations, flag lapses. */
import { runAllCalibrationSweeps } from '../../modules/calibration/sweep.service';

export const refreshCalibrationStatus = () => runAllCalibrationSweeps();
