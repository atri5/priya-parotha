import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';
import { CsvProductDatabase } from '../src/product/storage/csv-product-database.js';

if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL in backend/.env before database setup');
const sql = neon(process.env.DATABASE_URL);
const schema = await readFile(new URL('../../neon/schema.sql', import.meta.url), 'utf8');
const statements = schema.split(';').map(statement => statement.trim()).filter(Boolean);
const tagsMigration = await readFile(new URL('../../neon/migrate-product-tags.sql', import.meta.url), 'utf8');
const batchFunction = await readFile(new URL('../../neon/apply-product-edits.sql', import.meta.url), 'utf8');
await sql.transaction([...statements.map(statement => sql.query(statement)), sql.query(tagsMigration), sql.query(batchFunction), sql.query('revoke all on function public.apply_product_edits(jsonb) from public')]);
if (process.argv.includes('--seed')) {
  const products = new CsvProductDatabase().list();
  await sql.transaction(products.map(product => sql`
    insert into public.products (id, name, price, q_available, "desc", photos, tags, published)
    values (${product.id}, ${product.name}, ${product.price}, ${product.q_available},
      ${product.desc}, ${JSON.stringify(product.photos)}::jsonb, ${JSON.stringify(product.tags)}::jsonb, ${product.published})
    on conflict (id) do nothing
  `));
  console.log('Sample CSV products imported; existing IDs were preserved.');
}
console.log('Neon products table is ready.');
