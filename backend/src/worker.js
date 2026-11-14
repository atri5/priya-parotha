import { editProductsFromForm } from './product/edit-products-request.js';
import { createProductFromForm } from './product/create-product-request.js';
import { createProductApi } from './product/product-api.js';
import { NeonProductDatabase } from './product/storage/neon-product-database.js';
import { posix } from 'node:path';
import { getSessionUser, handleAuth } from './auth/auth.js';

const errorResponse = (error, status, headers) => Response.json({ error }, { status, headers });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;
    let normalized;
    try {
      let decoded = pathname;
      for (let index = 0; index < 4 && decoded.includes('%'); index++) decoded = decodeURIComponent(decoded);
      if (decoded.includes('%')) throw new Error('Invalid path encoding');
      normalized = posix.normalize(decoded.replaceAll('\\', '/')).toLowerCase();
    } catch { return errorResponse('Invalid request path', 400); }
    const dashboardPage = normalized.startsWith('/dashboard');
    const dashboardAsset = ['/assets/js/dashboard', '/assets/css/dashboard'].some(prefix => normalized.startsWith(prefix));
    const productWrite = /^\/api\/products(?:\/|$)/.test(normalized) && !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
    const adminApi = /^\/api\/admin(?:\/|$)/.test(normalized);
    if (dashboardPage || dashboardAsset || productWrite || adminApi) {
      const denied = await authorizeAdmin(request, env);
      if (denied) {
        if (dashboardPage && ['GET', 'HEAD'].includes(request.method) && [401, 403].includes(denied.status)) {
          return privateResponse(new Response(null, { status: 303, headers: { Location: '/?auth_error=admin_required' } }));
        }
        return denied;
      }
      if (dashboardPage || dashboardAsset) return privateResponse(await env.ASSETS.fetch(request));
      if (adminApi) return privateResponse(errorResponse('Not found', 404));
    }
    const batchEdit = request.method === 'PATCH' && pathname === '/api/products';
    if (batchEdit || request.method === 'POST' && /^\/api\/products\/?$/.test(pathname)) {
      const denied = authorizeProductWrite(request, env, batchEdit ? 'edit' : 'create');
      if (denied) return privateResponse(denied);
      return privateResponse(await (batchEdit ? editProductsFromForm(request, env) : createProductFromForm(request, env)));
    }
    if (request.method === 'GET' && /^\/api\/images\/[a-f0-9-]+$/.test(pathname)) {
      const image = await env.PRODUCT_IMAGES?.get(pathname.slice('/api/images/'.length));
      if (!image) return errorResponse('Image not found', 404);
      const headers = new Headers({ 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'public, max-age=86400' });
      image.writeHttpMetadata(headers);
      return new Response(image.body, { headers });
    }
    if (!pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (pathname.startsWith('/api/auth/')) return handleAuth(request, env);
    const tagsRoute = /^\/api\/tags\/?$/.test(pathname);
    const route = /^\/api\/products(?:\/([^/]+))?\/?$/.exec(pathname);
    if (!route && !tagsRoute) return errorResponse('Not found', 404);
    if (request.method !== 'GET') return errorResponse('Method not allowed', 405, { Allow: 'GET' });

    let id;
    try {
      id = route?.[1] === undefined ? undefined : decodeURIComponent(route[1]);
      if (id !== undefined && !id.trim()) throw new Error();
    } catch {
      return errorResponse('Invalid product ID', 400);
    }
    if (!env.DATABASE_URL) return errorResponse('Product database is not configured', 503);

    try {
      const products = createProductApi(new NeonProductDatabase(env.DATABASE_URL));
      if (tagsRoute) return Response.json(await products.getTags());
      return Response.json(id === undefined ? await products.getProducts() : await products.getProduct(id));
    } catch (error) {
      if (error.message === 'Product not found') return errorResponse('Product not found', 404);
      console.error(JSON.stringify({ message: 'Product database request failed', code: error.code || 'unknown' }));
      return errorResponse('Could not load products', 500);
    }
  },
};

function privateResponse(response) {
  const result = new Response(response.body, response);
  result.headers.set('Cache-Control', 'private, no-store');
  result.headers.append('Vary', 'Cookie');
  result.headers.set('X-Content-Type-Options', 'nosniff');
  result.headers.set('X-Frame-Options', 'DENY');
  result.headers.set('Content-Security-Policy', "frame-ancestors 'none'");
  return result;
}

async function authorizeAdmin(request, env) {
  try {
    const user = await getSessionUser(request, env);
    if (!user) return privateResponse(errorResponse('Sign in with an admin account to continue', 401));
    if (user.role !== 'admin') return privateResponse(errorResponse('Admin access is required', 403));
    return null;
  } catch (error) {
    console.error(JSON.stringify({ message: 'Admin authorization failed', code: error.code || 'unknown' }));
    return privateResponse(errorResponse('Could not verify access. Please try again.', 503));
  }
}

// Admin sessions are required above, including on localhost. These additional guards
// keep product writes confined to the existing development workflow.
function authorizeProductWrite(request, env, action) {
  const url = new URL(request.url);
  if (env.LOCAL_PRODUCT_WRITES !== 'true' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    return errorResponse('Product writes are not enabled on this server', 403);
  }
  if (request.headers.get('Origin') !== url.origin || request.headers.get('X-Product-Request') !== action) {
    return errorResponse('Request must come from this dashboard', 403);
  }
  return null;
}
