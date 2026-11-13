import assert from 'node:assert/strict';
import { test } from 'node:test';
import worker from '../../src/worker.js';
import { NeonProductDatabase } from '../../src/product/storage/neon-product-database.js';
import { Product } from '../../src/product/product.js';
import { productData } from '../../test-support/product/product-fixtures.js';
import { AuthDatabase } from '../../src/auth/storage.js';

test('batch editing validates the whole request and preserves fields not edited', async t => {
  const before = new Product({ ...productData(), id: 'test-product' });
  let batches = 0;
  t.mock.method(NeonProductDatabase.prototype, 'updateBatch', async edits => { batches++; return edits.map(edit => edit.after); });
  t.mock.method(AuthDatabase.prototype, 'getSession', async () => ({ id: 'admin-user', role: 'admin' }));
  const env = { LOCAL_PRODUCT_WRITES: 'true', DATABASE_URL: 'postgresql://user:pass@example.com/db' };
  const request = changes => {
    const body = new FormData();
    body.set('edits', JSON.stringify([{ before, changes }]));
    return new Request('http://localhost:5173/api/products', { method: 'PATCH', headers: { Origin: 'http://localhost:5173', 'X-Product-Request': 'edit', Cookie: `priya_session=${'a'.repeat(43)}` }, body });
  };
  assert.equal((await worker.fetch(request({ price: '7.00' }), { ...env, LOCAL_PRODUCT_WRITES: 'false' })).status, 403);
  assert.equal((await worker.fetch(request({ q_available: '-1' }), env)).status, 400);
  assert.equal((await worker.fetch(request({ id: 'changed' }), env)).status, 400);
  assert.equal(batches, 0);
  const response = await worker.fetch(request({ price: '7.00', tags: ['Sides', 'Lunch'], published: true }), env);
  assert.equal(response.status, 200);
  const [updated] = await response.json();
  assert.equal(updated.price, '7.00');
  assert.deepEqual(updated.tags, ['Sides', 'Lunch']);
  assert.equal(updated.published, true);
  assert.equal(updated.name, before.name);
  assert.deepEqual(updated.photos, before.photos);
  assert.equal(batches, 1);
});
