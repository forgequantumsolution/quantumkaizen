import { defineConfig } from 'vitest/config';

/**
 * Unit-test config for the backend engine.
 *
 * Tests live at the repo root in `tests/unit` (see `npm run test:unit`, which
 * passes `--dir ../tests/unit`). They are pure unit tests: no database, no
 * Redis. Collaborator modules that would touch the DB are `vi.mock`ed per-file.
 */
export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['../tests/unit/setup.ts'],
    include: ['**/*.test.ts'],
  },
});
