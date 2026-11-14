create table if not exists public.products (
  id text primary key default gen_random_uuid()::text check (id ~ '[^[:space:]]'),
  name text not null check (name ~ '[^[:space:]]'),
  price text not null check (price ~ '[^[:space:]]'),
  q_available text not null check (q_available ~ '[^[:space:]]'),
  "desc" text not null check ("desc" ~ '[^[:space:]]'),
  published boolean not null default false,
  tags jsonb not null default '[]'::jsonb check (jsonb_typeof(tags) = 'array'),
  photos jsonb not null check (
    case when jsonb_typeof(photos) = 'array'
      then jsonb_array_length(photos) > 0 else false end
  )
);

-- Upgrade existing tables without changing existing product data.
alter table public.products add column if not exists tags jsonb not null default '[]'::jsonb check (jsonb_typeof(tags) = 'array');

alter table public.products enable row level security;
revoke all on table public.products from public;
grant select on table public.products to public;
drop policy if exists "Products are readable" on public.products;
create policy "Products are readable" on public.products for select using (true);

alter table public.products add column if not exists published boolean not null default false;
