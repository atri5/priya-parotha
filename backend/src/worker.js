import { createProductApi } from './product/product-api.js';
import { NeonProductDatabase } from './product/storage/neon-product-database.js';

const errorResponse = (error, status, headers) => Response.json({ error }, { status, headers });

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (!pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    const route = /^\/api\/products(?:\/([^/]+))?\/?$/.exec(pathname);
    if (!route) return errorResponse('Not found', 404);
    if (request.method !== 'GET') return errorResponse('Method not allowed', 405, { Allow: 'GET' });

    let id;
    try {
      id = route[1] === undefined ? undefined : decodeURIComponent(route[1]);
      if (id !== undefined && !id.trim()) throw new Error();
    } catch {
      return errorResponse('Invalid product ID', 400);
    }
    if (!env.DATABASE_URL) return errorResponse('Product database is not configured', 503);

    try {
      const products = createProductApi(new NeonProductDatabase(env.DATABASE_URL));
      return Response.json(id === undefined ? await products.getProducts() : await products.getProduct(id));
    } catch (error) {
      if (error.message === 'Product not found') return errorResponse('Product not found', 404);
      console.error(JSON.stringify({ message: 'Product database request failed', code: error.code || 'unknown' }));
      return errorResponse('Could not load products', 500);
    }
  },
};
