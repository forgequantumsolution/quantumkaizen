import dotenv from 'dotenv';
dotenv.config();

// ── Environment validation — fail fast in production ────────────────
const REQUIRED_IN_PROD = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'DATABASE_URL'];
const WEAK_DEFAULTS = [
  'dev-jwt-secret-change-me',
  'dev-refresh-secret-change-me',
  'your-super-secret-jwt-key-change-in-production',
  'your-refresh-secret-key-change-in-production',
];

if (process.env.NODE_ENV === 'production') {
  const missing = REQUIRED_IN_PROD.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error(`[FATAL] Missing required env vars in production: ${missing.join(', ')}`);
    process.exit(1);
  }
  const jwtSecret = process.env.JWT_SECRET ?? '';
  const refreshSecret = process.env.JWT_REFRESH_SECRET ?? '';
  if (WEAK_DEFAULTS.includes(jwtSecret) || WEAK_DEFAULTS.includes(refreshSecret)) {
    console.error('[FATAL] JWT secrets must be changed from defaults in production');
    process.exit(1);
  }
  if (jwtSecret.length < 32 || refreshSecret.length < 32) {
    console.error('[FATAL] JWT secrets must be at least 32 characters');
    process.exit(1);
  }
}

export const config = {
  port: parseInt(process.env.PORT ?? '5000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',

  jwt: {
    secret: process.env.JWT_SECRET ?? 'dev-jwt-secret-change-me',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-me',
    accessExpiry: process.env.JWT_ACCESS_EXPIRY ?? '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY ?? '7d',
  },

  database: {
    url: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/quantum_kaizen',
  },

  redis: {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
    password: process.env.REDIS_PASSWORD ?? undefined,
  },

  s3: {
    endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:9000',
    accessKey: process.env.S3_ACCESS_KEY ?? 'minioadmin',
    secretKey: process.env.S3_SECRET_KEY ?? 'minioadmin',
    bucket: process.env.S3_BUCKET ?? 'quantum-kaizen-docs',
    region: process.env.S3_REGION ?? 'us-east-1',
  },

  smtp: {
    host: process.env.SMTP_HOST ?? '',
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    from: process.env.SMTP_FROM ?? 'Quantum Kaizen <noreply@quantumkaizen.io>',
  },

  features: {
    sso: process.env.ENABLE_SSO === 'true',
    email: process.env.ENABLE_EMAIL === 'true',
  },
};

export default config;
