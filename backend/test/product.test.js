import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Product } from '../src/product.js';
import {
  completeProductData,
  isFieldError,
  requiredFields,
  stringFields,
  withoutField,
} from '../test-support/product-fixtures.js';

describe('Product', () => {
  it('stores all six fields with their supplied values', () => {
    const data = completeProductData();
    const product = new Product(data);

    for (const field of requiredFields) {
      assert.deepEqual(product[field], data[field]);
    }
  });

  for (const field of requiredFields) {
    it(`rejects an omitted ${field}`, () => {
      assert.throws(
        () => new Product(withoutField(completeProductData(), field)),
        isFieldError(field),
      );
    });

    for (const value of [undefined, null]) {
      it(`rejects ${field} set to ${value}`, () => {
        assert.throws(
          () => new Product({ ...completeProductData(), [field]: value }),
          isFieldError(field),
        );
      });
    }
  }

  for (const field of stringFields) {
    for (const value of ['', '   ']) {
      it(`rejects ${field} set to ${JSON.stringify(value)}`, () => {
        assert.throws(
          () => new Product({ ...completeProductData(), [field]: value }),
          isFieldError(field),
        );
      });
    }

    it(`requires ${field} to be a string`, () => {
      for (const value of [12, false, [], {}]) {
        assert.throws(
          () => new Product({ ...completeProductData(), [field]: value }),
          isFieldError(field),
        );
      }
    });
  }

  it('rejects an empty photos array', () => {
    assert.throws(
      () => new Product({ ...completeProductData(), photos: [] }),
      isFieldError('photos'),
    );
  });

  it('requires photos to be an array', () => {
    for (const value of ['photo.jpg', 1, false, {}]) {
      assert.throws(
        () => new Product({ ...completeProductData(), photos: value }),
        isFieldError('photos'),
      );
    }
  });

  it('accepts zero price and quantity as nonempty strings', () => {
    const product = new Product({ ...completeProductData(), price: '0', q_available: '0' });
    assert.equal(product.price, '0');
    assert.equal(product.q_available, '0');
  });

  it('rejects missing or non-object product data', () => {
    for (const value of [undefined, null, 'product', 12, []]) {
      assert.throws(() => new Product(value), /data|object|required/i);
    }
  });
});
