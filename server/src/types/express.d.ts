import 'express';

declare global {
  namespace Express {
    interface User {
      id: string;
      tenantId: string;
      role: string;
      email: string;
      name: string;
    }
  }
}

export {};
