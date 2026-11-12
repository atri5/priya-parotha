import { neon } from '@neondatabase/serverless';
import { Product, productFields } from './product.js';
import { ProductDatabase } from './product-database.js';

export class NeonProductDatabase extends ProductDatabase {
  constructor(connectionString) {
    super();
    this.sql = neon(connectionString);
  }

  async list() {
    const rows = await this.sql`select * from public.products order by name, id`;
    return rows.map(row => new Product(row));
  }

  async get(id) {
    return this.#product(await this.sql`select * from public.products where id = ${id}`);
  }

  async create(data) {
    const product = new Product(data);
    return this.#product(await this.sql`
      insert into public.products (id, name, price, q_available, "desc", photos)
      values (${product.id}, ${product.name}, ${product.price}, ${product.q_available},
        ${product.desc}, ${JSON.stringify(product.photos)}::jsonb)
      returning *
    `);
  }

  async update(id, changes) {
    const fields = Object.keys(changes);
    for (const field of fields) {
      if (field === 'id' || !productFields.includes(field)) throw new TypeError(`${field} cannot be edited`);
    }
    const current = await this.get(id);
    if (!fields.length) return current;
    const updated = new Product({ ...current, ...changes, id });
    const assignments = fields.map((field, index) => `"${field}" = $${index + 1}`).join(', ');
    const values = fields.map(field => field === 'photos' ? JSON.stringify(updated[field]) : updated[field]);
    // Only changed columns are written, preserving unrelated concurrent edits.
    return this.#product(await this.sql.query(
      `update public.products set ${assignments} where id = $${fields.length + 1} returning *`,
      [...values, id],
    ));
  }

  async delete(id) {
    this.#product(await this.sql`delete from public.products where id = ${id} returning *`);
  }

  #product(rows) {
    if (!rows.length) throw new Error('Product not found');
    return new Product(rows[0]);
  }
}
