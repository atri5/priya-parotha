import assert from 'node:assert/strict';
import { test } from 'node:test';
import worker from '../src/worker.js';

test('product write boundary denies deployed, cross-origin, and unmarked requests before storage access', async () => {
  for (const [method, action] of [['POST', 'create'], ['PATCH', 'edit']]) {
    const request = (origin, headers = {}) => new Request(`${origin}/api/products`, {
      method, headers: { Origin: origin, 'X-Product-Request': action, ...headers },
    });
    assert.equal((await worker.fetch(request('http://localhost:5173'), {})).status, 403);
    assert.equal((await worker.fetch(request('https://example.com'), { LOCAL_PRODUCT_WRITES: 'true' })).status, 403);
    assert.equal((await worker.fetch(request('http://localhost:5173', { Origin: 'https://example.com' }), { LOCAL_PRODUCT_WRITES: 'true' })).status, 403);
    assert.equal((await worker.fetch(request('http://localhost:5173', { 'X-Product-Request': '' }), { LOCAL_PRODUCT_WRITES: 'true' })).status, 403);
  }
  assert.equal((await worker.fetch(new Request('https://example.com/api/products/id', { method: 'DELETE' }), {})).status, 405);
});
