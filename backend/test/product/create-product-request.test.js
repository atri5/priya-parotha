import assert from 'node:assert/strict';
import { test } from 'node:test';
import worker from '../../src/worker.js';
import { NeonProductDatabase } from '../../src/product/storage/neon-product-database.js';

// Exercise the real request handler with isolated database and image storage.
test('local creation saves fields and images, validates input, and rejects deployed or cross-origin writes', async t => {
  const images = new Map();
  const env = {
    LOCAL_PRODUCT_WRITES: 'true', DATABASE_URL: 'postgresql://user:password@example.com/db',
    PRODUCT_IMAGES: { put: async (key, value) => images.set(key, value), delete: async keys => keys.forEach(key => images.delete(key)) },
  };
  t.mock.method(NeonProductDatabase.prototype, 'create', async product => product);
  const request = (quantity = '0', origin = 'http://localhost:5173', withImage = true) => {
    const form = new FormData();
    for (const [key, value] of Object.entries({ name: 'Test product', desc: 'Test description', price: '5.50', q_available: quantity, tags: JSON.stringify(['Lunch', 'Sides']) })) form.set(key, value);
    if (withImage) form.append('photos', new Blob([Uint8Array.from([137,80,78,71,13,10,26,10])], { type: 'image/png' }), 'test.png');
    return new Request('http://localhost:5173/api/products', { method: 'POST', headers: { Origin: origin, 'X-Product-Request': 'create' }, body: form });
  };
  assert.equal((await worker.fetch(request(), { ...env, LOCAL_PRODUCT_WRITES: 'false' })).status, 403);
  assert.equal((await worker.fetch(request('0', 'https://other.example'), env)).status, 403);
  assert.equal((await worker.fetch(request('-1'), env)).status, 400);
  assert.equal(images.size, 0);
  const response = await worker.fetch(request(), env);
  assert.equal(response.status, 201);
  const product = await response.json();
  assert.deepEqual(product.tags, ['Lunch', 'Sides']);
  assert.equal(product.q_available, '0');
  assert.ok(product.id);
  assert.ok(images.has(product.photos[0].split('/').at(-1)));
  images.clear();
  const withoutImage = await worker.fetch(request('0', 'http://localhost:5173', false), { ...env, PRODUCT_IMAGES: undefined });
  assert.equal(withoutImage.status, 201);
  assert.deepEqual((await withoutImage.json()).photos, ['/assets/images/flower.svg']);
  assert.equal(images.size, 0);
  t.mock.method(NeonProductDatabase.prototype, 'create', async () => { throw new Error('storage failed'); });
  assert.equal((await worker.fetch(request(), env)).status, 500);
  assert.equal(images.size, 0);
});
