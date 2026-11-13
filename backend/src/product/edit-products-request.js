import { Product, productFields } from './product.js';
import { NeonProductDatabase } from './storage/neon-product-database.js';
import { fail, readProductForm, validateImages } from './create-product-request.js';

export async function editProductsFromForm(request, env) {
  const uploaded = [];
  try {
    if (!env.DATABASE_URL) throw fail('Product storage is not configured', 503);
    const form = await readProductForm(request);
    let edits;
    try { edits = JSON.parse(form.get('edits')); } catch { throw fail('Invalid product changes'); }
    if (!Array.isArray(edits) || !edits.length || edits.length > 50) throw fail('Save between 1 and 50 products at a time');
    const ids = new Set();
    const uploads = [];
    for (const edit of edits) {
      if (!edit?.before || !edit?.changes || typeof edit.changes !== 'object' || Array.isArray(edit.changes)) throw fail('Invalid product changes');
      if (ids.has(edit.before.id)) throw fail('Duplicate product');
      ids.add(edit.before.id);
      for (const field of Object.keys(edit.changes)) {
        if (field === 'id' || !productFields.includes(field)) throw fail(`${field} cannot be edited`);
      }
      try { edit.before = new Product(edit.before); } catch (error) { throw fail(error.message); }
      const files = form.getAll(`photos:${edit.before.id}`);
      await validateImages(files, env);
      let photos = edit.changes.photos ?? edit.before.photos;
      if (!Array.isArray(photos) || photos.some(photo => !edit.before.photos.includes(photo))) throw fail('Keep existing photos or upload replacements');
      photos = photos.filter(photo => photo !== '/assets/images/flower.svg');
      for (const file of files) {
        const key = crypto.randomUUID();
        uploads.push({ key, file });
        photos.push(`/api/images/${key}`);
      }
      if (photos.length > 10) throw fail('Choose up to 10 images per product');
      if (!photos.length) photos = ['/assets/images/flower.svg'];
      try { edit.after = new Product({ ...edit.before, ...edit.changes, photos }); } catch (error) { throw fail(error.message); }
      if (!/^\d+(\.\d{1,2})?$/.test(edit.after.price)) throw fail('Price must be nonnegative with up to two decimal places');
      if (!/^\d+$/.test(edit.after.q_available)) throw fail('Quantity must be a nonnegative whole number');
    }
    if (uploads.reduce((sum, upload) => sum + upload.file.size, 0) > 20 * 1024 * 1024) throw fail('Uploaded images must total no more than 20 MB per save', 413);
    for (const { key, file } of uploads) {
      uploaded.push(key);
      await env.PRODUCT_IMAGES.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
    }
    const result = await new NeonProductDatabase(env.DATABASE_URL).updateBatch(edits.map(({ before, after }) => ({ before, after })));
    return Response.json(result);
  } catch (error) {
    if (uploaded.length) await env.PRODUCT_IMAGES.delete(uploaded).catch(() => console.error('Image cleanup failed'));
    if (error.code === '40001') return Response.json({ error: 'A product changed since you loaded it. Nothing was saved. Reload to get the latest values.' }, { status: 409 });
    return Response.json({ error: error.status ? error.message : 'Could not save products. Your changes are still pending.' }, { status: error.status || 500 });
  }
}
