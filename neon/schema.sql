create table if not exists public.products (
  id text primary key default gen_random_uuid()::text check (id ~ '[^[:space:]]'),
  name text not null check (name ~ '[^[:space:]]'),
  price text not null check (price ~ '[^[:space:]]'),
  q_available text not null check (q_available ~ '[^[:space:]]'),
  "desc" text not null check ("desc" ~ '[^[:space:]]'),
  photos jsonb not null check (
    case when jsonb_typeof(photos) = 'array'
      then jsonb_array_length(photos) > 0 else false end
  )
);

alter table public.products enable row level security;
revoke all on table public.products from public;
grant select on table public.products to public;
drop policy if exists "Products are readable" on public.products;
create policy "Products are readable" on public.products for select using (true);
