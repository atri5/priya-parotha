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

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  address text not null check (btrim(address) <> ''),
  phone text not null check (btrim(phone) <> ''),
  due date not null,
  products jsonb not null check (jsonb_typeof(products) = 'object' and products <> '{}'::jsonb),
  price numeric not null check (price >= 0 and scale(price) = 2),
  "priceIsCustom" boolean not null default false,
  status text not null default 'ordered' check (status in ('ordered', 'in progress', 'complete')),
  revision integer not null default 1
);

alter table public.orders enable row level security;
revoke all on table public.orders from public;
