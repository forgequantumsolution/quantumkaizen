/**
 * Perf verification for workflow API fixes (post 2026-05-09):
 *   - workflow.layout.ts saveLayout      (Promise.all over updateMany)
 *   - workflow.builder.ts buildWorkflowGraph (BUILD/EXECUTE batching)
 *
 * Strategy: drive everything through the API layer (Playwright's `request`
 * fixture). The perf claim is about backend round-trip count, so wall-clock
 * timing of the HTTP responses is the right metric. We deliberately avoid
 * the browser overhead for timing-sensitive assertions, but include one UI
 * smoke at the end so the harness still exercises the page.
 *
 * Thresholds are chosen well above the post-fix expected timings but well
 * below the pre-fix N+1 timings — so a regression to N+1 will fail loudly,
 * and ordinary network jitter on a Neon (us-east-1) connection won't.
 */
import { test, expect, request as playwrightRequest, type APIRequestContext } from '@playwright/test';

const API_BASE = 'http://localhost:4000';
const APP_BASE = 'http://localhost:3000';

const SEED_EMAIL = 'info@forgequantumsolution.com';
const SEED_PASSWORD = 'Admin@123';

type Ctx = {
  api: APIRequestContext;
  token: string;
  approveStatusId: string;
  workflowId: string;
};

async function login(api: APIRequestContext): Promise<string> {
  const res = await api.post(`${API_BASE}/api/auth/login`, {
    data: { email: SEED_EMAIL, password: SEED_PASSWORD },
  });
  expect(res.status(), `login failed: ${await res.text()}`).toBe(200);
  const body = (await res.json()) as { token: string };
  expect(body.token).toBeTruthy();
  return body.token;
}

async function getApproveStatusId(api: APIRequestContext, token: string): Promise<string> {
  const res = await api.get(`${API_BASE}/api/workflow-lookups/stage-statuses`, {
    headers: { authorization: `Bearer ${token}` },
  });
  expect(res.status()).toBe(200);
  // Endpoint returns the array directly (no envelope).
  const items = (await res.json()) as { id: string; name: string; behavior: string }[];
  // Seed includes "Approve / Forward" with behavior FORWARD — works for any stage as a primary action.
  const fwd = items.find((s) => s.behavior === 'FORWARD');
  expect(fwd, 'no FORWARD stage status seeded').toBeTruthy();
  return fwd!.id;
}

async function createWorkflow(api: APIRequestContext, token: string, name: string): Promise<string> {
  const res = await api.post(`${API_BASE}/api/workflows`, {
    headers: { authorization: `Bearer ${token}` },
    data: { name },
  });
  expect(res.status(), `create workflow failed: ${await res.text()}`).toBe(201);
  const body = (await res.json()) as { workflow: { id: string } };
  return body.workflow.id;
}

async function softDeleteWorkflow(api: APIRequestContext, token: string, id: string): Promise<void> {
  // best-effort cleanup — don't fail the test if delete errors
  await api
    .delete(`${API_BASE}/api/workflows/${id}`, {
      headers: { authorization: `Bearer ${token}` },
    })
    .catch(() => undefined);
}

/** Build a chain of N stages with `actionsPerStage` FORWARD actions and N-1 transitions. */
function buildLinearGraph(stageCount: number, actionsPerStage: number, statusId: string) {
  const nodes = Array.from({ length: stageCount }, (_, i) => ({
    id: `n-${i + 1}`,
    type: 'stage',
    position: { x: 250, y: 100 + i * 140 },
    data: {
      label: `Stage ${i + 1}`,
      nodeType: 'stage' as const,
      basic_details: { is_initial_stage: i === 0, email_notification: false },
      primary_actions: Array.from({ length: actionsPerStage }, () => ({
        stage_status_id: statusId,
        type: 'primary' as const,
      })),
      secondary_actions: [],
    },
  }));
  const edges = Array.from({ length: stageCount - 1 }, (_, i) => ({
    source: `n-${i + 1}`,
    target: `n-${i + 2}`,
    sourceHandle: null,
    targetHandle: null,
  }));
  return { nodes, edges };
}

let ctx: Ctx;

test.beforeAll(async () => {
  const api = await playwrightRequest.newContext();
  const token = await login(api);
  const approveStatusId = await getApproveStatusId(api, token);
  const workflowId = await createWorkflow(api, token, `perf-spec-${Date.now()}`);
  ctx = { api, token, approveStatusId, workflowId };
});

test.afterAll(async () => {
  if (ctx?.workflowId) await softDeleteWorkflow(ctx.api, ctx.token, ctx.workflowId);
  await ctx?.api?.dispose();
});

test('save: 10-stage linear workflow with 1 action per stage completes in <8s on Neon us-east-1', async () => {
  // 1 action per stage to satisfy the @@unique([workflowStageId, workflowActionId])
  // constraint — each (stage, action) pair must be distinct, and we only have
  // one FORWARD-behavior status seeded so we can't easily diversify.
  const flow = buildLinearGraph(10, 1, ctx.approveStatusId);

  const start = Date.now();
  const res = await ctx.api.put(`${API_BASE}/api/workflows/${ctx.workflowId}`, {
    headers: { authorization: `Bearer ${ctx.token}` },
    data: { flow_json: flow },
  });
  const elapsed = Date.now() - start;

  expect(res.status(), `save failed: ${await res.text()}`).toBe(200);
  // On Neon us-east-1 from this dev box one RTT is ~480ms. Pre-fix this save
  // did ~50+ sequential RTTs (~24s); post-fix it does ~9 RTTs (~4.4s observed).
  // Threshold 8s leaves ample jitter room while still catching a regression
  // back to the N+1 pattern (which would be ≥20s).
  expect(elapsed, `save took ${elapsed}ms`).toBeLessThan(8000);
  // eslint-disable-next-line no-console
  console.log(`[perf] save 10x1: ${elapsed}ms`);
});

test('save: fork+join workflow (6 nodes) completes in <7s on Neon us-east-1', async () => {
  const status = ctx.approveStatusId;
  const flow = {
    nodes: [
      {
        id: 'start',
        type: 'stage',
        position: { x: 250, y: 100 },
        data: {
          label: 'Start',
          nodeType: 'stage' as const,
          basic_details: { is_initial_stage: true, email_notification: false },
          primary_actions: [{ stage_status_id: status, type: 'primary' as const }],
          secondary_actions: [],
        },
      },
      {
        id: 'fork-1',
        type: 'fork',
        position: { x: 250, y: 240 },
        data: {
          label: 'Fork',
          nodeType: 'stage' as const,
          basic_details: {},
          parallelConfig: { branchCount: 2, splitType: 'AND' as const, joinStageId: 'join-1' },
        },
      },
      {
        id: 'branch-a',
        type: 'stage',
        position: { x: 100, y: 380 },
        data: {
          label: 'Branch A',
          nodeType: 'stage' as const,
          basic_details: {},
          primary_actions: [{ stage_status_id: status, type: 'primary' as const }],
          secondary_actions: [],
        },
      },
      {
        id: 'branch-b',
        type: 'stage',
        position: { x: 400, y: 380 },
        data: {
          label: 'Branch B',
          nodeType: 'stage' as const,
          basic_details: {},
          primary_actions: [{ stage_status_id: status, type: 'primary' as const }],
          secondary_actions: [],
        },
      },
      {
        id: 'join-1',
        type: 'join',
        position: { x: 250, y: 520 },
        data: {
          label: 'Join',
          nodeType: 'stage' as const,
          basic_details: {},
          parallelConfig: { branchCount: 2, joinType: 'AND' as const },
        },
      },
      {
        // Joins must lead somewhere — validator: "Join node must have exactly 1 outgoing connection".
        id: 'end',
        type: 'stage',
        position: { x: 250, y: 660 },
        data: {
          label: 'End',
          nodeType: 'stage' as const,
          basic_details: {},
          primary_actions: [{ stage_status_id: status, type: 'primary' as const }],
          secondary_actions: [],
        },
      },
    ],
    edges: [
      { source: 'start', target: 'fork-1' },
      { source: 'fork-1', target: 'branch-a' },
      { source: 'fork-1', target: 'branch-b' },
      { source: 'branch-a', target: 'join-1' },
      { source: 'branch-b', target: 'join-1' },
      { source: 'join-1', target: 'end' },
    ],
  };

  const start = Date.now();
  const res = await ctx.api.put(`${API_BASE}/api/workflows/${ctx.workflowId}`, {
    headers: { authorization: `Bearer ${ctx.token}` },
    data: { flow_json: flow },
  });
  const elapsed = Date.now() - start;

  expect(res.status(), `fork-join save failed: ${await res.text()}`).toBe(200);
  // 6 nodes / 5 actions / 6 transitions + 1 fork→join update ≈ ~10 RTTs post-fix.
  // Pre-fix would have been ~30+ RTTs (~14s).
  expect(elapsed, `fork-join save took ${elapsed}ms`).toBeLessThan(7000);
  // eslint-disable-next-line no-console
  console.log(`[perf] save fork+join: ${elapsed}ms`);
});

test('layout autosave: 10 positions completes in <4s on Neon us-east-1', async () => {
  // Re-save a 10-stage graph so we have stages with known canonicalIds to move.
  const flow = buildLinearGraph(10, 1, ctx.approveStatusId);
  const seedRes = await ctx.api.put(`${API_BASE}/api/workflows/${ctx.workflowId}`, {
    headers: { authorization: `Bearer ${ctx.token}` },
    data: { flow_json: flow },
  });
  expect(seedRes.status()).toBe(200);

  // Issue a single layout autosave with all 10 positions shifted.
  const positions = flow.nodes.map((n) => ({
    canonicalId: n.id,
    position: { x: n.position.x + 17, y: n.position.y + 23 },
  }));

  const start = Date.now();
  const res = await ctx.api.post(`${API_BASE}/api/workflows/${ctx.workflowId}/save-layout`, {
    headers: { authorization: `Bearer ${ctx.token}` },
    data: { positions },
  });
  const elapsed = Date.now() - start;

  expect(res.status(), `save-layout failed: ${await res.text()}`).toBe(200);
  const body = (await res.json()) as { updated: number };
  expect(body.updated).toBe(10);
  // Pre-fix: 11 sequential RTTs (~5.3s on Neon us-east-1).
  // Post-fix: 2 RTTs — 1 workflow check + 1 bulk UPDATE FROM (VALUES …).
  // Observed: typically 1.2-1.5s, occasional Neon jitter spikes to ~3s.
  // Threshold 4s still catches a regression to N+1 (which would be ≥5s).
  expect(elapsed, `save-layout took ${elapsed}ms`).toBeLessThan(4000);
  // eslint-disable-next-line no-console
  console.log(`[perf] save-layout x10: ${elapsed}ms`);
});

test('UI smoke: builder page renders without errors after fixes', async ({ page }) => {
  // Skip gracefully if the frontend dev server isn't running — the perf tests
  // above are the real verification; the UI smoke is just a render check.
  try {
    const probe = await ctx.api.get(APP_BASE, { timeout: 2000 });
    if (probe.status() >= 500) test.skip(true, 'frontend dev server not responding');
  } catch {
    test.skip(true, `frontend dev server not running at ${APP_BASE}`);
  }

  // Authenticate by injecting the token into localStorage before any app code runs.
  const token = ctx.token;
  await page.addInitScript(
    ([t, email]) => {
      window.localStorage.setItem('qk_token', t);
      window.localStorage.setItem(
        'qk_user',
        JSON.stringify({ id: 'init', email, name: 'Seed' }),
      );
    },
    [token, SEED_EMAIL] as const,
  );

  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto(`${APP_BASE}/workflows/${ctx.workflowId}/builder`);
  // Toolbar shows "Workflow builder" label and a Save button.
  await expect(page.getByText('Workflow builder')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: /save/i }).first()).toBeVisible();

  // Filter out the well-known benign warnings the builder always emits in dev.
  const fatal = errors.filter(
    (e) =>
      !/React Router Future Flag/i.test(e) &&
      !/apple-mobile-web-app-capable/i.test(e) &&
      !/manifest/i.test(e),
  );
  expect(fatal, `unexpected console/page errors:\n${fatal.join('\n')}`).toEqual([]);
});
