import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Product } from '../src/product.js';
import { productData } from '../test-support/product-fixtures.js';

test('Product stores its fields and rejects missing or empty required values', () => {
  const data = { id: 'product-1', ...productData() };
  const product = new Product(data);

  for (const [field, value] of Object.entries(data)) {
    assert.deepEqual(product[field], value);
  }

  const { name, ...missingName } = data;
  assert.throws(() => new Product(missingName), /name/i);
  assert.throws(() => new Product({ ...data, id: '' }), /id/i);
  assert.throws(() => new Product({ ...data, photos: [] }), /photos/i);
});
