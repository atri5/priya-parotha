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
  const secondId = crypto.randomUUID();
  const productId = crypto.randomUUID();
  const origin = 'http://localhost:5174';
  const headers = { Origin: origin, Cookie: `priya_session=${'a'.repeat(43)}`, 'Content-Type': 'application/json', 'Idempotency-Key': id };
  const send = (method, path, body, revision) => worker.fetch(new Request(origin + '/api/admin/orders' + path, {
    method, headers: { ...headers, ...(revision && { 'If-Match': `"${revision}"` }) }, body: JSON.stringify(body),
  }), env);
  t.mock.method(AuthDatabase.prototype, 'getSession', async () => ({ role: 'admin' }));
  t.after(async () => {
    await sql.transaction([sql`delete from public.orders where id in (${id}, ${secondId})`, sql`delete from public.products where id=${productId}`]);
  });
  await sql`insert into public.products (id,name,price,q_available,"desc",photos)
    values (${productId},'Order test fixture','1.15','10','Test','["/assets/images/flower.svg"]'::jsonb)`;
  const data = { name: 'Test order', address: 'Test street', phone: 'Test phone', due: '2030-01-15', products: { [productId]: 3 }, price: '0.01' };
  const path = '/' + id;
  assert.equal((await send('POST', '', { ...data, products: { missing: 1 } })).status, 400);
  const attempts = await Promise.all([send('POST', '', data), send('POST', '', data)]);
  assert.deepEqual(attempts.map(r => r.status).sort(), [200, 201]);
  const order = await attempts[0].json();
  assert.deepEqual(await attempts[1].json(), order);
  assert.equal(order.id, id);
  assert.equal(order.status, 'ordered');
  assert.equal(order.price, '3.45');
  assert.equal(order.due, data.due);
  assert.deepEqual(order.products, data.products);
  const retry = await send('POST', '', data);
  assert.equal(retry.status, 200);
  assert.deepEqual(await retry.json(), order);
  assert.equal((await send('POST', '', { ...data, phone: 'Different' })).status, 409);
  headers['Idempotency-Key'] = secondId;
  assert.equal((await send('POST', '', data)).status, 201);
  headers['Idempotency-Key'] = id;
  const query = '?limit=1&status=ordered&from=2030-01-15&to=2030-01-15';
  const firstPage = await send('GET', query);
  const [summary] = await firstPage.json();
  assert.deepEqual(Object.keys(summary).sort(), ['due', 'id', 'name', 'price', 'revision', 'status']);
  const cursor = firstPage.headers.get('X-Next-Cursor');
  assert.ok(cursor);
  const secondPage = await (await send('GET', query + '&after=' + encodeURIComponent(cursor))).json();
  assert.equal(secondPage.length, 1);
  assert.ok(secondPage[0].id > summary.id);
  assert.equal((await send('GET', '?limit=51')).status, 400);
  const containsOrder = async query => (await (await send('GET', '?' + query)).json()).some(row => row.id === id);
  assert.ok(await containsOrder('status=ordered&from=2030-01-15&to=2030-01-15'));
  for (const query of ['status=complete', 'from=2030-01-16', 'to=2030-01-14']) assert.equal(await containsOrder(query), false);
  assert.equal((await send('GET', '?from=2030-02-30')).status, 400);
  assert.equal((await send('GET', '?from=2030-01-16&to=2030-01-15')).status, 400);
  assert.equal((await send('PATCH', path, { status: 'unknown' }, 1)).status, 400);
  assert.equal((await (await send('PATCH', path, { status: 'in progress' }, 1)).json()).status, 'in progress');
  assert.equal((await send('DELETE', path, undefined, 1)).status, 409);
  assert.equal((await send('PUT', path, { ...data, name: 'Updated', priceIsCustom: true, status: 'complete' }, 2)).status, 200);
  const saved = await (await send('GET', path)).json();
  assert.equal(saved.name, 'Updated');
  assert.equal(saved.price, '0.01');
  assert.equal(saved.priceIsCustom, true);
  assert.equal(saved.status, 'complete');
  assert.deepEqual(await (await send('POST', '', data)).json(), saved);
  assert.equal((await send('DELETE', path, undefined, saved.revision)).status, 204);
  assert.equal((await send('GET', path)).status, 404);
});
