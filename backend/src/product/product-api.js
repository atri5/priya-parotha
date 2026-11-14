import { randomUUID } from 'node:crypto';
import { CsvProductDatabase } from './storage/csv-product-database.js';
import { Product, productFields } from './product.js';

function requireId(id) {
  if (typeof id !== 'string' || !id.trim()) throw new TypeError('id must be a nonempty string');
}

export function createProductApi(database = new CsvProductDatabase()) {
  return {
    async getProducts() {
      return database.list();
    },
    async getTags() {
      const products = await database.list();
      return [...new Set(products.flatMap(product => product.tags).filter(tag => tag.trim()))].sort();
    },
    async getProduct(id) {
      requireId(id);
      return database.get(id);
    },
    async createProduct(data) {
      return database.create(new Product({ ...data, id: randomUUID() }));
    },
    async editProduct(id, changes) {
      requireId(id);
      if (!changes || typeof changes !== 'object' || Array.isArray(changes)) {
        throw new TypeError('changes must be an object');
      }
      for (const field of Object.keys(changes)) {
        if (field === 'id' || !productFields.includes(field)) throw new TypeError(`${field} cannot be edited`);
      }
      return database.update(id, changes);
    },
    async deleteProduct(id) {
      requireId(id);
      return database.delete(id);
    },
  };
}
