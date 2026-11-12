import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { Product } from '../src/product.js';
import { createProductApi } from '../src/product-api.js';
import {
  inputFields,
  isFieldError,
  productData,
  requiredFields,
  withoutField,
} from '../test-support/product-fixtures.js';

const replacements = {
  name: 'Paneer Parotha',
  price: '6.00',
  q_available: '15',
  desc: 'Paneer-stuffed flatbread.',
  photos: ['https://example.com/paneer-parotha.jpg'],
};

function invalidValues(field) {
  return field === 'photos'
    ? [undefined, null, [], '', 'photo.jpg', 12, false, {}]
    : [undefined, null, '', '   ', 12, false, [], {}];
}

function assertProductData(product, data) {
  assert.ok(product instanceof Product);
  for (const field of inputFields) {
    assert.deepEqual(product[field], data[field]);
  }
}

describe('Product API', () => {
  let api;

  beforeEach(() => {
    api = createProductApi();
  });

  describe('createProduct(data)', () => {
    it('returns a Product with the supplied fields and a generated string ID', async () => {
      const data = productData();
      const product = await api.createProduct(data);

      assertProductData(product, data);
      assert.equal(typeof product.id, 'string');
      assert.ok(product.id.trim().length > 0);
      assert.equal(Object.hasOwn(data, 'id'), false);
    });

    it('assigns distinct IDs even when the product data is identical', async () => {
      const products = await Promise.all(
        Array.from({ length: 100 }, () => api.createProduct(productData())),
      );

      for (const product of products) {
        assert.equal(typeof product.id, 'string');
        assert.ok(product.id.trim().length > 0);
      }
      assert.equal(new Set(products.map((product) => product.id)).size, products.length);
    });

    it('generates its own ID even if callers include an ID', async () => {
      const first = await api.createProduct({ ...productData(), id: 'caller-id' });
      const second = await api.createProduct({ ...productData(), id: 'caller-id' });

      assert.notEqual(first.id, 'caller-id');
      assert.notEqual(second.id, 'caller-id');
      assert.notEqual(first.id, second.id);
    });

    for (const field of inputFields) {
      it(`rejects an omitted ${field}`, async () => {
        await assert.rejects(
          async () => api.createProduct(withoutField(productData(), field)),
          isFieldError(field),
        );
      });

      it(`rejects empty or incorrectly typed ${field}`, async () => {
        for (const value of invalidValues(field)) {
          await assert.rejects(
            async () => api.createProduct({ ...productData(), [field]: value }),
            isFieldError(field),
          );
        }
      });
    }

    it('rejects missing or non-object product data', async () => {
      for (const value of [undefined, null, 'product', 12, []]) {
        await assert.rejects(async () => api.createProduct(value), /data|object|required/i);
      }
    });
  });

  describe('editProduct(id, changes)', () => {
    for (const field of inputFields) {
      it(`updates only ${field} while preserving every other field and the ID`, async () => {
        const data = productData();
        const original = await api.createProduct(data);
        const originalId = original.id;
        const updated = await api.editProduct(originalId, { [field]: replacements[field] });

        assertProductData(updated, { ...data, [field]: replacements[field] });
        assert.equal(updated.id, originalId);
      });

      it(`rejects empty or incorrectly typed ${field} without applying the update`, async () => {
        const data = productData();
        const original = await api.createProduct(data);

        for (const value of invalidValues(field)) {
          const otherField = field === 'name' ? 'desc' : 'name';
          await assert.rejects(
            async () => api.editProduct(original.id, {
              [otherField]: replacements[otherField],
              [field]: value,
            }),
            isFieldError(field),
          );
          // Inspect stored values without overwriting either field from the failed edit.
          const readField = inputFields.find((key) => key !== field && key !== otherField);
          const unchanged = await api.editProduct(original.id, { [readField]: data[readField] });
          assertProductData(unchanged, data);
          assert.equal(unchanged.id, original.id);
        }
      });
    }

    it('can update all five editable fields together', async () => {
      const product = await api.createProduct(productData());
      const updated = await api.editProduct(product.id, replacements);

      assertProductData(updated, replacements);
      assert.equal(updated.id, product.id);
    });

    it('retains a successful edit when another field is edited later', async () => {
      const product = await api.createProduct(productData());
      await api.editProduct(product.id, { price: '8.00' });
      const updated = await api.editProduct(product.id, { q_available: '10' });

      assertProductData(updated, { ...productData(), price: '8.00', q_available: '10' });
      assert.equal(updated.id, product.id);
    });

    it('rejects attempts to change the generated ID', async () => {
      const product = await api.createProduct(productData());
      const originalId = product.id;

      await assert.rejects(
        async () => api.editProduct(originalId, { id: 'replacement-id' }),
        isFieldError('id'),
      );
      const unchanged = await api.editProduct(originalId, { name: productData().name });
      assert.equal(unchanged.id, originalId);
    });

    it('rejects missing or non-object changes', async () => {
      const product = await api.createProduct(productData());
      for (const value of [undefined, null, 'changes', 12, []]) {
        await assert.rejects(async () => api.editProduct(product.id, value), /changes|object|required/i);
      }
    });

    it('rejects an unknown product ID', async () => {
      await assert.rejects(
        async () => api.editProduct('unknown-id', { name: 'Updated name' }),
        /not found/i,
      );
    });
  });

  describe('deleteProduct(id)', () => {
    it('deletes the selected product and leaves other products editable', async () => {
      const deleted = await api.createProduct(productData());
      const retained = await api.createProduct(productData());

      await api.deleteProduct(deleted.id);

      await assert.rejects(
        async () => api.editProduct(deleted.id, { name: 'Deleted product' }),
        /not found/i,
      );
      const updated = await api.editProduct(retained.id, { name: 'Retained product' });
      assert.equal(updated.id, retained.id);
      assert.equal(updated.name, 'Retained product');
    });

    it('rejects an unknown product ID', async () => {
      await assert.rejects(async () => api.deleteProduct('unknown-id'), /not found/i);
    });

    it('rejects deleting the same product twice', async () => {
      const product = await api.createProduct(productData());
      await api.deleteProduct(product.id);
      await assert.rejects(async () => api.deleteProduct(product.id), /not found/i);
    });
  });

  for (const operation of ['editProduct', 'deleteProduct']) {
    it(`${operation} requires a nonempty string ID`, async () => {
      for (const id of [undefined, null, '', '   ', 12, false, [], {}]) {
        await assert.rejects(
          async () => api[operation](id, { name: 'Updated name' }),
          isFieldError('id'),
        );
      }
    });
  }

  it('retains all required product fields after a create and partial edit', async () => {
    const product = await api.createProduct(productData());
    const updated = await api.editProduct(product.id, { price: '7.00' });

    for (const field of requiredFields) {
      assert.ok(Object.hasOwn(updated, field), `Missing ${field}`);
    }
  });
});
