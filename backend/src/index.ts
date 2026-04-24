import { env } from './config/env';
import { buildApp } from './app';
import { prisma } from './lib/prisma';

const app = buildApp();

const server = app.listen(env.PORT, () => {
  console.log(`Backend listening on http://localhost:${env.PORT} [${env.NODE_ENV}]`);
});

const shutdown = async (signal: string) => {
  console.log(`\n${signal} received — shutting down`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
