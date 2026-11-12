import assert from 'node:assert/strict';
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createProductApi } from '../src/product-api.js';
import { CsvProductDatabase } from '../src/csv-product-database.js';
import { ProductDatabase } from '../src/product-database.js';
import { productData } from '../test-support/product-fixtures.js';

test('Product API queries CSV, creates unique IDs, partially edits, deletes, and validates input', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'priya-products-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const filePath = join(directory, 'products.csv');
  copyFileSync(new URL('../data/products.csv', import.meta.url), filePath);
  const database = new CsvProductDatabase(filePath);
  assert.ok(database instanceof ProductDatabase);
  const api = createProductApi(database);
  assert.equal((await api.getProducts()).length, 5);

  const data = { ...productData(), desc: 'Potato, herbs and "spices".\nFresh daily.' };
  const first = await api.createProduct(data);
  const second = await api.createProduct(productData());
  const id = first.id;

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

  await api.deleteProduct(id);
  await assert.rejects(
    async () => api.editProduct(id, { price: '7.00' }),
    /not found/i,
  );
});
