create table public.products (
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
grant select, insert, update, delete on public.products to service_role;
