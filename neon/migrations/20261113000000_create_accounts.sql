create table if not exists public.users (
  id text primary key default gen_random_uuid()::text,
  email text not null check (email <> '' and email !~ '[[:space:]]'),
  email_verified boolean not null default false,
  username text check (username <> '' and username !~ '[[:space:]]'),
  role text not null default 'customer' check (role in ('admin', 'customer')),
  created_at timestamptz not null default now()
);

create unique index if not exists users_email_unique on public.users (lower(email));
create unique index if not exists users_username_unique on public.users (lower(username));

create table if not exists public.password_credentials (
  user_id text primary key references public.users(id) on delete cascade,
  password_hash text not null check (password_hash ~ '[^[:space:]]'),
  updated_at timestamptz not null default now()
);

create table if not exists public.oauth_accounts (
  provider text not null check (provider = 'google'),
  provider_user_id text not null check (provider_user_id <> '' and provider_user_id !~ '[[:space:]]'),
  user_id text not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (provider, provider_user_id),
  unique (user_id, provider)
);

alter table public.users enable row level security;
alter table public.password_credentials enable row level security;
alter table public.oauth_accounts enable row level security;

revoke all on table public.users, public.password_credentials, public.oauth_accounts from public;
