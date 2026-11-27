import { createHash } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { Order, orderStatuses } from './order.js';

const failure = (error, status) => Response.json({ error }, { status });

async function readBody(request) {
  let text = '', bytes = 0;
  const decoder = new TextDecoder();
  for await (const chunk of request.body ?? []) {
    bytes += chunk.length;
    if (bytes > 65536) throw new TypeError('Order is too large');
    text += decoder.decode(chunk, { stream: true });
  }
  const data = JSON.parse(text + decoder.decode());
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new TypeError('Expected an order object');
  return data;
}

async function listOrders(sql, params) {
  const status = params.get('status');
  const from = params.get('from');
  const to = params.get('to');
  if (status && !orderStatuses.includes(status)) return failure('Invalid order status', 400);
  const limit = Number(params.get('limit') ?? 25);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) return failure('Page size must be between 1 and 50', 400);
  const cursor = params.get('after');
  const boundary = cursor?.match(/^(\d{4}-\d{2}-\d{2}),([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})$/i);
  if (cursor !== null && !boundary) return failure('Invalid order cursor', 400);
  const afterDate = boundary?.[1] ?? null, afterId = boundary?.[2] ?? null;
  for (const value of [from, to, afterDate]) {
    if (!value) continue;
    const date = new Date(value + 'T00:00:00Z');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000') ||
        !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
      return failure('Expected a valid date in YYYY-MM-DD format', 400);
    }
  }
  if (from && to && from > to) return failure('The end date must be on or after the start date', 400);
  const rows = await sql`select id, name, due::text as due, price, status, revision from public.orders
    where (${status || null}::text is null or status = ${status || null})
      and (${from || null}::date is null or due >= ${from || null}::date)
      and (${to || null}::date is null or due <= ${to || null}::date)
      and (${afterDate}::date is null or (due, id) > (${afterDate}::date, ${afterId}::uuid))
    order by orders.due, id limit ${limit + 1}`;
  const last = rows[limit - 1];
  return Response.json(rows.slice(0, limit), { headers: rows.length > limit ? { 'X-Next-Cursor': `${last.due},${last.id}` } : {} });
}

function orderResponse(row, status = 200) {
  const { creation_hash, ...order } = row;
  return Response.json(order, { status });
}

export async function handleOrders(request, env, id) {
  const { method } = request;
  const methods = id ? ['GET', 'PUT', 'PATCH', 'DELETE'] : ['GET', 'POST'];
  if (!methods.includes(method)) return new Response(null, { status: 405, headers: { Allow: methods.join(', ') } });
  if (method !== 'GET' && request.headers.get('Origin') !== new URL(request.url).origin) {
    return failure('Make this change from the dashboard', 403);
  }
  if (!env.DATABASE_URL) return failure('Order database is unavailable', 503);
  try {
    const sql = neon(env.DATABASE_URL);
    if (method === 'GET') {
      if (!id) return await listOrders(sql, new URL(request.url).searchParams);
      const [order] = await sql`select *, due::text as due from public.orders where id = ${id}`;
      return order ? orderResponse(order) : failure('Order not found', 404);
    }
    const revision = request.headers.get('If-Match')?.match(/^"([1-9]\d*)"$/)?.[1];
    if (id && !revision) return failure('An order revision is required', 428);
    let rows;
    if (method === 'DELETE') {
      rows = await sql`delete from public.orders where id = ${id} and revision = ${revision} returning id`;
    } else {
      if (request.headers.get('Content-Type')?.split(';')[0] !== 'application/json') return failure('Expected JSON', 415);
      const data = await readBody(request);
      if (method === 'PATCH') {
        if (Object.keys(data).length !== 1 || !orderStatuses.includes(data.status)) return failure('Expected a valid order status', 400);
        rows = await sql`update public.orders set status = ${data.status}, revision = revision + 1
          where id = ${id} and revision = ${revision} returning *, due::text as due`;
      } else {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(data.due)) return failure('Expected a calendar date', 400);
        const order = new Order({ ...data, due: new Date(data.due + 'T00:00:00Z') });
        if (order.due.toISOString().slice(0, 10) !== data.due) return failure('Invalid due date', 400);
        if (![order.name, order.address, order.phone].every(value => value.trim())) return failure('Enter a name, address and phone', 400);
        const ids = Object.keys(order.products);
        if (!ids.length) return failure('Select at least one product', 400);
        let key, signature;
        const replay = async () => {
          const [saved] = await sql`select *, due::text as due from public.orders where id=${key}`;
          if (!saved) return null;
          return saved.creation_hash === signature ? orderResponse(saved) : failure('This key belongs to another order submission', 409);
        };
        if (method === 'POST') {
          key = request.headers.get('Idempotency-Key') ?? crypto.randomUUID();
          if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(key)) return failure('Invalid order key', 400);
          signature = createHash('sha256').update(JSON.stringify([
            order.name, order.phone, order.address, data.due, order.status, order.priceIsCustom,
            order.priceIsCustom ? order.price : null, ids.sort().map(id => [id, order.products[id]]),
          ])).digest('hex');
          const existing = await replay();
          if (existing) return existing;
        }
        const catalog = await sql`select id, price from public.products where id = any(${ids}::text[])`;
        if (catalog.length !== ids.length) return failure('A selected product is no longer available', 400);
        let price = order.price;
        if (!order.priceIsCustom) {
          let total = 0n;
          for (const product of catalog) {
            if (!/^\d+(\.\d{1,2})?$/.test(product.price)) return failure('A selected product has no valid price', 400);
            const [whole, fraction = ''] = product.price.split('.');
            total += BigInt(whole + fraction.padEnd(2, '0')) * BigInt(order.products[product.id]);
          }
          price = `${total / 100n}.${String(total % 100n).padStart(2, '0')}`;
        }
        if (!/^\d+(\.\d{1,2})?$/.test(price)) return failure('Enter a nonnegative total with up to two decimal places', 400);
        const values = [order.name, order.address, order.phone, data.due, JSON.stringify(order.products),
          price, order.priceIsCustom, order.status];
        rows = method === 'POST'
          ? await sql.query(`insert into public.orders (name, address, phone, due, products, price, "priceIsCustom", status, id, creation_hash)
              values ($1, $2, $3, $4, $5, round($6::numeric, 2), $7, $8, $9, $10)
              on conflict (id) do nothing returning *, due::text as due`, [...values, key, signature])
          : await sql.query(`update public.orders set name=$1, address=$2, phone=$3, due=$4, products=$5,
              price=round($6::numeric, 2), "priceIsCustom"=$7, status=$8, revision=revision+1
              where id=$9 and revision=$10 returning *, due::text as due`, [...values, id, revision]);
        if (method === 'POST' && !rows.length) {
          return await replay() ?? failure('Order was deleted during submission', 409);
        }
      }
    }
    if (!rows.length) return failure('Order changed or was deleted. Refresh the page to see the latest version.', 409);
    return method === 'DELETE' ? new Response(null, { status: 204 }) : orderResponse(rows[0], method === 'POST' ? 201 : 200);
  } catch (error) {
    if (error instanceof SyntaxError) return failure('Invalid JSON', 400);
    if (error instanceof TypeError) return failure(error.message, 400);
    console.error(JSON.stringify({ message: 'Order database request failed', code: error.code }));
    return failure('Could not access orders. Please try again.', 503);
  }
}
