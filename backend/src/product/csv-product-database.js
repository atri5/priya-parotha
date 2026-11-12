import { randomUUID } from 'node:crypto';
import { readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { Product, productFields } from './product.js';
import { ProductDatabase } from './product-database.js';

export class CsvProductDatabase extends ProductDatabase {
  constructor(filePath = process.env.PRODUCT_CSV_PATH || fileURLToPath(new URL('../../data/products.csv', import.meta.url))) {
    super();
    this.filePath = filePath;
  }

  list() {
    return parse(readFileSync(this.filePath, 'utf8'), { columns: true, skip_empty_lines: true, bom: true })
      .map(row => new Product({ ...row, photos: JSON.parse(row.photos) }));
  }

  get(id) {
    const products = this.list();
    return products[this.#index(products, id)];
  }

  create(product) {
    const products = this.list();
    if (products.some(row => row.id === product.id)) throw new Error('id already exists');
    const created = new Product(product);
    this.#write([...products, created]);
    return created;
  }

  update(id, changes) {
    const products = this.list();
    const index = this.#index(products, id);
    const updated = new Product({ ...products[index], ...changes, id });
    products[index] = updated;
    this.#write(products);
    return updated;
  }

  delete(id) {
    const products = this.list();
    products.splice(this.#index(products, id), 1);
    this.#write(products);
  }

  #index(products, id) {
    const index = products.findIndex(product => product.id === id);
    if (index < 0) throw new Error('Product not found');
    return index;
  }

  #write(products) {
    const rows = products.map(product => ({ ...product, photos: JSON.stringify(product.photos) }));
    const temporary = `${this.filePath}.${randomUUID()}.tmp`;
    try {
      writeFileSync(temporary, stringify(rows, { header: true, columns: productFields }), 'utf8');
      renameSync(temporary, this.filePath);
    } finally {
      rmSync(temporary, { force: true });
    }
  }
}
