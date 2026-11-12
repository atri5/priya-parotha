# Neon online database

The `priya-parotha` project was created in the **free** organization recorded in `project.json`, in AWS US West (Oregon). No paid plan was enabled.

`schema.sql` defines the six product fields and ID primary key. It has no Supabase-specific roles. General database roles can read products; writes use trusted backend credentials. The Cloudflare API exposes reads only.

The five CSV products are sample data, including illustrative prices and photo URLs. Replace or remove them before showing a real menu.

From `backend/`, using a private `DATABASE_URL` in `.env`:

```sh
npm run db:setup
npm run db:setup -- --seed
```

The second command optionally imports the sample CSV without overwriting existing IDs. The setup script applies the initial schema; future schema changes should use explicit migrations.

Production uses `NeonProductDatabase`; `CsvProductDatabase` remains available for local tests. Database credentials are stored only in ignored backend files and Cloudflare secrets.
