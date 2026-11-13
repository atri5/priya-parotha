import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createProductApi } from '../../src/product/product-api.js';
import { CsvProductDatabase } from '../../src/product/storage/csv-product-database.js';
import { ProductDatabase } from '../../src/product/storage/product-database.js';
import { productData } from '../../test-support/product/product-fixtures.js';

test('Product API queries CSV, creates unique IDs, partially edits, deletes, and validates input', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'priya-products-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const filePath = join(directory, 'products.csv');
  copyFileSync(new URL('../../data/products.csv', import.meta.url), filePath);
  const database = new CsvProductDatabase(filePath);
  assert.ok(database instanceof ProductDatabase);
  const api = createProductApi(database);
  assert.equal((await api.getProducts()).length, 5);

  assert.deepEqual(await api.getTags(), []);

  const data = { ...productData(), tags: ['Lunch, specials', 'Parotha'], desc: 'Potato, herbs and "spices".\nFresh daily.' };
  const first = await api.createProduct(data);
  const second = await api.createProduct(productData());
  const id = first.id;
  assert.deepEqual(await createProductApi(new CsvProductDatabase(filePath)).getTags(), ['Lunch, specials', 'Parotha']);
  await api.editProduct(second.id, { tags: data.tags });
  assert.deepEqual(await api.getTags(), ['Lunch, specials', 'Parotha']);

  assert.equal(typeof id, 'string');
  assert.ok(id.trim());
  assert.equal(typeof second.id, 'string');
  assert.ok(second.id.trim());
  assert.notEqual(id, second.id);
  assert.deepEqual(await createProductApi(new CsvProductDatabase(filePath)).getProduct(id), first);

  const updated = await api.editProduct(id, { price: '6.00' });
  assert.deepEqual({ ...updated }, { ...data, id, price: '6.00' });
  assert.deepEqual(await api.getProduct(id), updated);

  const { name, ...missingName } = data;
  await assert.rejects(async () => api.createProduct(missingName), /name/i);
  await assert.rejects(async () => api.editProduct(id, { name: '' }), /name/i);
  assert.deepEqual(await api.getProduct(id), updated);

  await assert.rejects(() => api.editProduct(id, { tags: 123 }), /tag/i);
  assert.deepEqual(await api.getProduct(id), updated);
  const cleared = await api.editProduct(id, { tags: [] });
  assert.deepEqual(cleared.tags, []);
  assert.deepEqual(await api.getTags(), ['Lunch, specials', 'Parotha']);
  await api.deleteProduct(second.id);
  assert.deepEqual(await api.getTags(), []);
  assert.deepEqual((await createProductApi(new CsvProductDatabase(filePath)).getProduct(id)).tags, []);
  const { tags, ...untagged } = productData();
  assert.deepEqual((await api.createProduct(untagged)).tags, []);

  mkdirSync(`${filePath}.lock`);
  await assert.rejects(() => api.editProduct(id, { name: 'Must not save' }), /busy/i);
  await assert.rejects(() => api.createProduct(productData()), /busy/i);
  await assert.rejects(() => api.deleteProduct(id), /busy/i);
  assert.equal((await api.getProduct(id)).name, data.name);
  rmSync(`${filePath}.lock`, { recursive: true });
  await assert.rejects(() => api.editProduct(id, { photos: [''] }), /photos/i);
  await api.deleteProduct(id);
  await assert.rejects(
    async () => api.editProduct(id, { price: '7.00' }),
    /not found/i,
  );
});
