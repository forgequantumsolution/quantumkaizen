import { Role } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        tenantId: string;
        role: string;
        email: string;
        name: string;
      };
    }
  }
}

export {};
