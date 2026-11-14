import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import worker from '../src/worker.js';
import { AuthDatabase } from '../src/auth/storage.js';

test('admin boundary protects dashboard aliases/assets and writes, rechecks roles, and fails closed', async t => {
  const adminToken = 'a'.repeat(43), customerToken = 'c'.repeat(43);
  const digest = value => createHash('sha256').update(value).digest('hex');
  let role = 'admin', unavailable = false, privateAssets = 0;
  t.mock.method(console, 'error', () => {});
  t.mock.method(AuthDatabase.prototype, 'getSession', async hash => {
    if (unavailable) throw new Error('Database unavailable');
    if (hash === digest(adminToken)) return { id: 'admin-user', role };
    if (hash === digest(customerToken)) return { id: 'customer-user', role: 'customer' };
    return null;
  });
  const env = {
    DATABASE_URL: 'postgresql://user:pass@example.com/db', LOCAL_PRODUCT_WRITES: 'true',
    ASSETS: { fetch: async request => {
      const page = new URL(request.url).pathname;
      if (page === '/') return new Response('Public homepage');
      privateAssets++;
      return new Response('Protected dashboard asset');
    } },
  };
  const request = (path, token, method = 'GET', headers = {}, origin = 'http://localhost:5173') => new Request(origin + path, {
    method, headers: { ...(token ? { Cookie: `${origin.startsWith('https:') ? '__Host-priya_session' : 'priya_session'}=${token}` } : {}), ...headers },
  });
  assert.equal((await worker.fetch(request('/'), env)).status, 200);
  for (const path of ['/dashboard.html', '/dashboard', '/dashboard/', '/dashboard/index.html', '/%64ashboard.html', '//dashboard.html', '/%252Fdashboard.html', '/assets/js/dashboard.js', '/assets/css/dashboard.css']) {
    for (const token of [undefined, 'invalid', 'e'.repeat(43), customerToken]) {
      const response = await worker.fetch(request(path, token, 'GET', { 'X-Role': 'admin' }), env);
      assert.ok([303, 401, 403].includes(response.status), path);
      assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
      assert.ok(!(await response.text()).includes('Protected dashboard asset'));
    }
  }
  assert.equal(privateAssets, 0);
  assert.equal((await worker.fetch(request('/dashboard.html', adminToken), env)).status, 200);
  const asset = await worker.fetch(request('/assets/js/dashboard.js', adminToken), env);
  assert.equal(asset.status, 200);
  assert.equal(asset.headers.get('Cache-Control'), 'private, no-store');
  assert.match(asset.headers.get('Vary'), /Cookie/);
  assert.equal(asset.headers.get('X-Frame-Options'), 'DENY');
  assert.equal(asset.headers.get('Content-Security-Policy'), "frame-ancestors 'none'");
  assert.equal((await worker.fetch(request('/dashboard.html', undefined, 'GET', { Cookie: `priya_session=${adminToken}` }, 'https://example.com'), env)).status, 303);
  for (const method of ['POST', 'PATCH', 'DELETE']) {
    assert.equal((await worker.fetch(request('/api/products', undefined, method), env)).status, 401);
    assert.equal((await worker.fetch(request('/api/products', customerToken, method, { 'X-Role': 'admin' }), env)).status, 403);
  }
  assert.equal((await worker.fetch(request('/api/admin/users'), env)).status, 401);
  assert.equal((await worker.fetch(request('/api/admin/users', adminToken), env)).status, 404);
  for (const [method, action] of [['POST', 'create'], ['PATCH', 'edit']]) {
    const headers = { Origin: 'http://localhost:5173', 'X-Product-Request': action };
    assert.equal((await worker.fetch(request('/api/products', adminToken, method, headers), { ...env, LOCAL_PRODUCT_WRITES: 'false' })).status, 403);
    assert.equal((await worker.fetch(request('/api/products', adminToken, method, { ...headers, Origin: 'https://other.example' }), env)).status, 403);
    assert.equal((await worker.fetch(request('/api/products', adminToken, method, { ...headers, 'X-Product-Request': '' }), env)).status, 403);
  }
  assert.equal((await worker.fetch(request('/api/products/id', adminToken, 'DELETE'), env)).status, 405);
  role = 'customer';
  assert.equal((await worker.fetch(request('/dashboard.html', adminToken), env)).status, 303);
  assert.equal((await worker.fetch(request('/api/products', adminToken, 'POST'), env)).status, 403);
  unavailable = true;
  const before = privateAssets;
  assert.equal((await worker.fetch(request('/dashboard.html', adminToken), env)).status, 503);
  assert.equal((await worker.fetch(request('/api/products', adminToken, 'POST'), env)).status, 503);
  assert.equal(privateAssets, before);
});
