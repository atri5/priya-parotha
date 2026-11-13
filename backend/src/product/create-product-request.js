import { Product } from './product.js';
import { createProductApi } from './product-api.js';
import { NeonProductDatabase } from './storage/neon-product-database.js';

export const fail = (message, status = 400) => Object.assign(new Error(message), { status });

export async function createProductFromForm(request, env) {
  const uploaded = [];
  try {
    if (!env.DATABASE_URL) throw fail('Product storage is not configured', 503);
    const form = await readProductForm(request);
    const files = form.getAll('photos');
    await validateImages(files, env);
    const keys = files.map(() => crypto.randomUUID());
    const data = Object.fromEntries(['name', 'desc', 'price', 'q_available'].map(field => [field, form.get(field) ?? undefined]));
    try { data.tags = JSON.parse(form.get('tags') ?? '[]'); } catch { throw fail('tags must be a JSON array'); }
    data.photos = keys.length ? keys.map(key => `/api/images/${key}`) : ['/assets/images/flower.svg'];
    try { new Product({ ...data, id: 'validation' }); }
    catch (error) { throw fail(error.message); }
    if (!/^\d+(\.\d{1,2})?$/.test(data.price)) throw fail('Enter a nonnegative price with up to two decimal places');
    if (!/^\d+$/.test(data.q_available)) throw fail('Quantity must be a nonnegative whole number');
    for (const [index, file] of files.entries()) {
      uploaded.push(keys[index]);
      await env.PRODUCT_IMAGES.put(keys[index], file.stream(), { httpMetadata: { contentType: file.type } });
    }
    const product = await createProductApi(new NeonProductDatabase(env.DATABASE_URL)).createProduct(data);
    return Response.json(product, { status: 201 });
  } catch (error) {
    if (uploaded.length) await env.PRODUCT_IMAGES.delete(uploaded).catch(() => console.error('Failed to clean up product images'));
    if (!error.status) console.error('Product creation failed');
    return Response.json({ error: error.status ? error.message : 'Could not create product. Your form has been kept so you can try again.' }, { status: error.status || 500 });
  }
}

export async function readProductForm(request) {
    if (!request.headers.get('Content-Type')?.startsWith('multipart/form-data')) throw fail('Send product fields and images as form data', 415);
    let bytes = 0;
    const body = request.body?.pipeThrough(new TransformStream({
      transform(chunk, controller) {
        bytes += chunk.byteLength;
        if (bytes > 21 * 1024 * 1024) throw fail('Images must total no more than 20 MB', 413);
        controller.enqueue(chunk);
      },
    }));
    let form;
    try { form = await new Response(body, { headers: request.headers }).formData(); }
    catch (error) { throw error.status ? error : fail('Could not read the product form'); }
    return form;
}

export async function validateImages(files, env) {
    if (files.length > 10) throw fail('Choose up to 10 images');
    if (files.length && !env.PRODUCT_IMAGES) throw fail('Image storage is not configured', 503);
    if (files.reduce((sum, file) => sum + (file.size || 0), 0) > 20 * 1024 * 1024) throw fail('Images must total no more than 20 MB', 413);
    for (const file of files) {
      if (typeof file === 'string' || !file.size || file.size > 10 * 1024 * 1024) throw fail('Each image must be nonempty and no larger than 10 MB');
      const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
      const matches = file.type === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
        : file.type === 'image/png' ? [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte)
        : file.type === 'image/webp' && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
      if (!matches) throw fail('Choose valid JPG, PNG, or WebP images');
    }
}
