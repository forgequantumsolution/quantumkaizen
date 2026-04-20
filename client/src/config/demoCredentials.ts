export const DEMO_ACCOUNTS = [
  { role: 'Admin',       email: 'admin@forgequantum.com',   password: 'QuantumK@izen2026' },
  { role: 'QA Director', email: 'qa@forgequantum.com',      password: 'QuantumK@izen2026' },
  { role: 'Lab Head',    email: 'lab@forgequantum.com',     password: 'QuantumK@izen2026' },
  { role: 'QC Analyst',  email: 'qc@forgequantum.com',      password: 'QuantumK@izen2026' },
  { role: 'Partner',     email: 'partner@forgequantum.com', password: 'QuantumK@izen2026' },
] as const;

export type DemoAccount = typeof DEMO_ACCOUNTS[number];
