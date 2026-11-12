import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createProductApi } from '../src/product-api.js';
import { productData } from '../test-support/product-fixtures.js';

test('Product API creates unique IDs, partially edits, deletes, and validates input', async () => {
  const api = createProductApi();
  const data = productData();
  const first = await api.createProduct(data);
  const second = await api.createProduct(productData());
  const id = first.id;

  assert.equal(typeof id, 'string');
  assert.ok(id.trim());
  assert.equal(typeof second.id, 'string');
  assert.ok(second.id.trim());
  assert.notEqual(id, second.id);

  const updated = await api.editProduct(id, { price: '6.00' });
  assert.deepEqual({ ...updated }, { ...data, id, price: '6.00' });

  const { name, ...missingName } = data;
  await assert.rejects(async () => api.createProduct(missingName), /name/i);
  await assert.rejects(async () => api.editProduct(id, { name: '' }), /name/i);

  await api.deleteProduct(id);
  await assert.rejects(
    async () => api.editProduct(id, { price: '7.00' }),
    /not found/i,
  );
});
