# Database

Run `migrations/20261111000000_create_products.sql` in your Supabase project's SQL Editor once to create `public.products`.

- `id`: text primary key, with a generated UUID string when omitted.
- `name`, `price`, `q_available`, `desc`: required, nonempty text.
- `photos`: required, nonempty JSON array.

The future backend can supply a generated ID explicitly. The primary key enforces uniqueness.

Row level security is enabled with no browser access policies. Manage products through the SQL Editor or a trusted backend using the service role; keep service credentials out of the frontend. Public reading and admin permissions can be added when those flows are implemented.
