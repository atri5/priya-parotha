import { editProductsFromForm } from './product/edit-products-request.js';
import { createProductFromForm } from './product/create-product-request.js';
import { createProductApi } from './product/product-api.js';
import { NeonProductDatabase } from './product/storage/neon-product-database.js';

const errorResponse = (error, status, headers) => Response.json({ error }, { status, headers });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;
    const batchEdit = request.method === 'PATCH' && pathname === '/api/products';
    if (batchEdit || request.method === 'POST' && /^\/api\/products\/?$/.test(pathname)) {
      const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
      if (env.LOCAL_PRODUCT_WRITES !== 'true' || !local) return errorResponse('Product creation is not enabled on this server', 403);
      if (request.headers.get('Origin') !== url.origin || request.headers.get('X-Product-Request') !== (batchEdit ? 'edit' : 'create')) return errorResponse('Request must come from this dashboard', 403);
      return batchEdit ? editProductsFromForm(request, env) : createProductFromForm(request, env);
    }
    if (request.method === 'GET' && /^\/api\/images\/[a-f0-9-]+$/.test(pathname)) {
      const image = await env.PRODUCT_IMAGES?.get(pathname.slice('/api/images/'.length));
      if (!image) return errorResponse('Image not found', 404);
      const headers = new Headers({ 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'public, max-age=86400' });
      image.writeHttpMetadata(headers);
      return new Response(image.body, { headers });
    }
    if (!pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
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
