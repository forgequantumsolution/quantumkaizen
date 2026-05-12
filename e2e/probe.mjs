// Direct API timing probe — bypasses Playwright to isolate backend perf.
// Run from quantumkaizen/: node e2e/probe.mjs

const API = 'http://localhost:4000';

const post = (path, body, token) =>
  fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
const put = (path, body, token) =>
  fetch(`${API}${path}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
const get = (path, token) =>
  fetch(`${API}${path}`, { headers: { authorization: `Bearer ${token}` } });
const del = (path, token) =>
  fetch(`${API}${path}`, { method: 'DELETE', headers: { authorization: `Bearer ${token}` } });

const time = async (label, fn) => {
  const t = Date.now();
  const r = await fn();
  const ms = Date.now() - t;
  console.log(`  ${label}: ${ms}ms (HTTP ${r.status})`);
  return { ms, r };
};

(async () => {
  console.log('login:');
  const { r: lr } = await time('  POST /api/auth/login', () =>
    post('/api/auth/login', { email: 'info@forgequantumsolution.com', password: 'Admin@123' }),
  );
  const { token } = await lr.json();

  console.log('warmup (load permissions cache + tcp keepalive):');
  await time('  GET /api/workflows', () => get('/api/workflows', token));
  await time('  GET /api/workflow-lookups/stage-statuses', () =>
    get('/api/workflow-lookups/stage-statuses', token),
  );

  const statuses = await (await get('/api/workflow-lookups/stage-statuses', token)).json();
  const fwdId = statuses.find((s) => s.behavior === 'FORWARD').id;

  console.log('\ncreate workflow:');
  const cr = await post(
    '/api/workflows',
    { name: `probe-${Date.now()}` },
    token,
  );
  const { workflow } = await cr.json();
  const id = workflow.id;
  console.log(`  id=${id}`);

  const buildLinear = (n) => ({
    nodes: Array.from({ length: n }, (_, i) => ({
      id: `n-${i + 1}`,
      type: 'stage',
      position: { x: 250, y: 100 + i * 140 },
      data: {
        label: `Stage ${i + 1}`,
        nodeType: 'stage',
        basic_details: { is_initial_stage: i === 0, email_notification: false },
        primary_actions: [{ stage_status_id: fwdId, type: 'primary' }],
        secondary_actions: [],
      },
    })),
    edges: Array.from({ length: n - 1 }, (_, i) => ({ source: `n-${i + 1}`, target: `n-${i + 2}` })),
  });

  console.log('\nsave (10 stages, 1 action each, 9 transitions):');
  await time('  PUT /api/workflows/:id', () =>
    put(`/api/workflows/${id}`, { flow_json: buildLinear(10) }, token),
  );

  console.log('\nsave-layout (10 positions) — repeated 3x to see cold/warm:');
  const positions = (offset) =>
    Array.from({ length: 10 }, (_, i) => ({
      canonicalId: `n-${i + 1}`,
      position: { x: 250 + offset, y: 100 + i * 140 + offset },
    }));
  for (let i = 1; i <= 3; i++) {
    const { r } = await time(`  POST /save-layout #${i}`, () =>
      post(`/api/workflows/${id}/save-layout`, { positions: positions(i * 7) }, token),
    );
    if (i === 1) console.log(`    body: ${await r.clone().text()}`);
  }

  console.log('\nbaseline:');
  await time('  GET /health', () => get('/health', token));

  console.log('\ncleanup:');
  await del(`/api/workflows/${id}`, token);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
