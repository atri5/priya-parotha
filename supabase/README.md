# Database

Run the SQL files in `migrations/` in filename order in your Supabase project's SQL Editor, once each. The first creates `public.products`; the second configures public read-only access.

- `id`: text primary key, with a generated UUID string when omitted.
- `name`, `price`, `q_available`, `desc`: required, nonempty text.
- `photos`: required, nonempty JSON array.

The future backend can supply a generated ID explicitly. The primary key enforces uniqueness.

`public` is the schema name. Access is controlled by grants and row level security:

- Visitors and signed-in users (`anon`, `authenticated`) can read products only.
- The trusted backend (`service_role`) can create, edit, and delete products.

Keep service credentials out of the frontend. Database administrators can also manage the table through the SQL Editor.
