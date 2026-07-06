import { Router, type Request, type Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import { buildOpenApiSpec } from './spec';

export const mountOpenApi = (): Router => {
  const router = Router();
  // Build once at boot — schemas are static.
  const spec = buildOpenApiSpec();

  router.get('/openapi.json', (_req: Request, res: Response) => {
    res.json(spec);
  });

  router.use(
    '/docs',
    swaggerUi.serve,
    swaggerUi.setup(spec, {
      customSiteTitle: 'Quantum Kairoz API',
      swaggerOptions: {
        persistAuthorization: true,
        docExpansion: 'list',
        defaultModelsExpandDepth: 1,
      },
    }),
  );

  return router;
};
