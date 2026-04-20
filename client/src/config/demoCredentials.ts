// Must match the backend seed in server/prisma/seed.ts. Tenant code is
// consumed separately in LoginPage via TENANT_CODE.
export const DEMO_ACCOUNTS = [
  { role: 'Admin',          email: 'admin@aurorabiopharma.com',          password: 'QuantumK@izen2026' },
  { role: 'QA Head',        email: 'qa.head@aurorabiopharma.com',        password: 'QuantumK@izen2026' },
  { role: 'QC Analyst',     email: 'qc.analyst@aurorabiopharma.com',     password: 'QuantumK@izen2026' },
  { role: 'Doc Controller', email: 'doc.controller@aurorabiopharma.com', password: 'QuantumK@izen2026' },
] as const;

export type DemoAccount = typeof DEMO_ACCOUNTS[number];
