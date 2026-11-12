import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';
import { CsvProductDatabase } from '../src/product/storage/csv-product-database.js';

if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL in backend/.env before database setup');
const sql = neon(process.env.DATABASE_URL);
const schema = await readFile(new URL('../../neon/schema.sql', import.meta.url), 'utf8');
const statements = schema.split(';').map(statement => statement.trim()).filter(Boolean);
await sql.transaction(statements.map(statement => sql.query(statement)));
if (process.argv.includes('--seed')) {
  const products = new CsvProductDatabase().list();
  await sql.transaction(products.map(product => sql`
    insert into public.products (id, name, price, q_available, "desc", photos)
    values (${product.id}, ${product.name}, ${product.price}, ${product.q_available},
      ${product.desc}, ${JSON.stringify(product.photos)}::jsonb)
    on conflict (id) do nothing
  `));
  console.log('Sample CSV products imported; existing IDs were preserved.');
}
console.log('Neon products table is ready.');
