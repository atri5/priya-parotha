import assert from 'node:assert/strict';
import { test } from 'node:test';
import { neon } from '@neondatabase/serverless';
import worker from '../../src/worker.js';
import { AuthDatabase } from '../../src/auth/storage.js';

test('admin order API persists orders, checks prices and revisions, and deletes orders', {
  skip: !process.env.DATABASE_URL && 'Requires Neon with the orders schema',
}, async t => {
  const env = { DATABASE_URL: process.env.DATABASE_URL };
  const sql = neon(env.DATABASE_URL);
  const id = crypto.randomUUID();
  const productId = crypto.randomUUID();
  const origin = 'http://localhost:5174';
  const headers = { Origin: origin, Cookie: `priya_session=${'a'.repeat(43)}`, 'Content-Type': 'application/json', 'Idempotency-Key': id };
  const send = (method, path, body, revision) => worker.fetch(new Request(origin + '/api/admin/orders' + path, {
    method, headers: { ...headers, ...(revision && { 'If-Match': `"${revision}"` }) }, body: JSON.stringify(body),
  }), env);
  t.mock.method(AuthDatabase.prototype, 'getSession', async () => ({ role: 'admin' }));
  t.after(async () => {
    await sql.transaction([sql`delete from public.orders where id=${id}`, sql`delete from public.products where id=${productId}`]);
  });
  await sql`insert into public.products (id,name,price,q_available,"desc",photos)
    values (${productId},'Order test fixture','1.15','10','Test','["/assets/images/flower.svg"]'::jsonb)`;
  const data = { name: 'Test order', address: 'Test street', phone: 'Test phone', due: '2030-01-15', products: { [productId]: 3 }, price: '0.01' };
  const path = '/' + id;
  assert.equal((await send('POST', '', { ...data, products: { missing: 1 } })).status, 400);
  const response = await send('POST', '', data);
  assert.equal(response.status, 201);
  const order = await response.json();
  assert.equal(order.id, id);
  assert.equal(order.status, 'ordered');
  assert.equal(order.price, '3.45');
  assert.equal(order.due, data.due);
  assert.deepEqual(order.products, data.products);
  assert.equal((await send('POST', '', data)).status, 409);
  const containsOrder = async query => (await (await send('GET', '?' + query)).json()).some(row => row.id === id);
  assert.ok(await containsOrder('status=ordered&from=2030-01-15&to=2030-01-15'));
  for (const query of ['status=complete', 'from=2030-01-16', 'to=2030-01-14']) assert.equal(await containsOrder(query), false);
  assert.equal((await send('GET', '?from=2030-02-30')).status, 400);
  assert.equal((await send('GET', '?from=2030-01-16&to=2030-01-15')).status, 400);
  assert.equal((await (await send('GET', '')).json()).some(row => row.id === id), true);
  assert.equal((await send('PATCH', path, { status: 'unknown' }, 1)).status, 400);
  assert.equal((await (await send('PATCH', path, { status: 'in progress' }, 1)).json()).status, 'in progress');
  assert.equal((await send('DELETE', path, undefined, 1)).status, 409);
  assert.equal((await send('PUT', path, { ...data, name: 'Updated', priceIsCustom: true, status: 'complete' }, 2)).status, 200);
  const saved = await (await send('GET', path)).json();
  assert.equal(saved.name, 'Updated');
  assert.equal(saved.price, '0.01');
  assert.equal(saved.priceIsCustom, true);
  assert.equal(saved.status, 'complete');
  assert.equal((await send('DELETE', path, undefined, saved.revision)).status, 204);
  assert.equal((await send('GET', path)).status, 404);
});
