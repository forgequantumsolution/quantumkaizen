/** Sweep: flag scheduled stability pulls whose date has arrived as DUE. */
import { flagDuePulls } from '../../modules/stability/stability.service';

export const flagDueStabilityPulls = () => flagDuePulls();
