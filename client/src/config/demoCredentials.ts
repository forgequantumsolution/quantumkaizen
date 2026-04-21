// Accepted demo credentials.
//
// The `aurorabiopharma.com` set matches the backend seed (server/prisma/seed.ts)
// so the SAME email works against the real Render API once it's deployed.
//
// The `forgequantum.com` set is the brand-forward demo login kept for
// compatibility with existing links, screenshots and documentation. In the
// offline frontend-only deployment both sets log the user in locally; when
// the real API is up, only the pharma accounts succeed against the backend.
//
// Tenant code is consumed separately in LoginPage via TENANT_CODE.
export const DEMO_ACCOUNTS = [
  // Brand / quick-login
  { role: 'Admin',          email: 'admin@forgequantum.com',              password: 'QuantumK@izen2026' },
  { role: 'QA Director',    email: 'qa@forgequantum.com',                 password: 'QuantumK@izen2026' },
  { role: 'Lab Head',       email: 'lab@forgequantum.com',                password: 'QuantumK@izen2026' },
  { role: 'QC Analyst',     email: 'qc@forgequantum.com',                 password: 'QuantumK@izen2026' },
  { role: 'Partner',        email: 'partner@forgequantum.com',            password: 'QuantumK@izen2026' },
  // Pharma seed (also work against the real backend)
  { role: 'Admin',          email: 'admin@aurorabiopharma.com',           password: 'QuantumK@izen2026' },
  { role: 'QA Head',        email: 'qa.head@aurorabiopharma.com',         password: 'QuantumK@izen2026' },
  { role: 'QC Analyst',     email: 'qc.analyst@aurorabiopharma.com',      password: 'QuantumK@izen2026' },
  { role: 'Doc Controller', email: 'doc.controller@aurorabiopharma.com',  password: 'QuantumK@izen2026' },
] as const;

export type DemoAccount = typeof DEMO_ACCOUNTS[number];
