import { readdir, readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL in backend/.env before account setup');
const sql = neon(process.env.DATABASE_URL);
const directory = new URL('../../neon/migrations/', import.meta.url);

try {
  for (const name of (await readdir(directory)).filter(name => name.endsWith('.sql')).sort()) {
    const migration = await readFile(new URL(name, directory), 'utf8');
    const statements = migration.split(';').map(statement => statement.trim()).filter(Boolean);
    await sql.transaction(statements.map(statement => sql.query(statement)));
  }
  console.log('Neon account tables are ready. No users were created.');
} catch (error) {
  console.error(`Account database setup failed (${error.code || error.name}).`);
  process.exitCode = 1;
}
