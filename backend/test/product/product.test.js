import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Product } from '../../src/product/product.js';
import { productData } from '../../test-support/product/product-fixtures.js';

test('Product stores its fields and rejects missing or empty required values', () => {
  const data = { id: 'product-1', ...productData() };
  const product = new Product(data);

  for (const [field, value] of Object.entries(data)) {
    assert.deepEqual(product[field], value);
  }

  const { tags, ...legacy } = data;
  assert.deepEqual(new Product(legacy).tags, []);
  assert.deepEqual(new Product({ ...data, tags: ['Parotha', 'Lunch', 'Parotha'] }).tags, ['Parotha', 'Lunch']);
  assert.throws(() => new Product({ ...data, tags: 'Parotha' }), /tags/i);
  assert.throws(() => new Product({ ...data, tags: [null] }), /tags/i);
  assert.throws(() => new Product({ ...data, tags: [' '] }), /tags/i);

  const { name, ...missingName } = data;
  assert.throws(() => new Product(missingName), /name/i);
  assert.throws(() => new Product({ ...data, id: '' }), /id/i);
  for (const photos of [[], [''], [null], [{}], ['javascript:alert(1)'], ['//example.com/image.jpg'], ['https://user:pass@example.com/image.jpg'], ['https://example.com/' + 'a'.repeat(2048)], Array(11).fill(data.photos[0])]) {
    assert.throws(() => new Product({ ...data, photos }), /photos/i);
  }
  assert.deepEqual(new Product({ ...data, photos: ['/assets/images/flower.svg', '/api/images/abc-123'] }).photos, ['/assets/images/flower.svg', '/api/images/abc-123']);
});
