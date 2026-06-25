/** Sweep: flag LIMS certifications expiring within 30 days / expired. */
import { flagExpiringCertifications as run } from '../../modules/lims/certification.service';

export const flagExpiringCertifications = () => run();
