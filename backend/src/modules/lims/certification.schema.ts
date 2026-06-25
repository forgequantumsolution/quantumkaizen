import { z } from 'zod';

export const ListCertQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(200).default(100),
  search: z.string().optional(),
  lab_id: z.string().optional(),
  // Certifications expiring within 30 days or already expired.
  expiring: z.coerce.boolean().optional(),
});

export const CertUpsertSchema = z.object({
  type: z.string().min(1).max(60),
  number: z.string().max(120).optional().nullable(),
  lab_id: z.string().optional().nullable(),
  issued_by: z.string().max(200).optional().nullable(),
  issue_date: z.string().optional().nullable(),
  expiry_date: z.string(),
  is_active: z.boolean().optional(),
});

export type ListCertQuery = z.infer<typeof ListCertQuerySchema>;
export type CertUpsertInput = z.infer<typeof CertUpsertSchema>;
