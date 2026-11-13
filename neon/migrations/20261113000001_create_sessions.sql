create table if not exists public.sessions (
  token_hash text primary key check (token_hash ~ '^[a-f0-9]{64}$'),
  user_id text not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null check (expires_at > created_at)
);

create index if not exists sessions_user_id_idx on public.sessions (user_id);
create index if not exists sessions_expires_at_idx on public.sessions (expires_at);

create table if not exists public.oauth_states (
  state_hash text primary key check (state_hash ~ '^[a-f0-9]{64}$'),
  browser_hash text not null check (browser_hash ~ '^[a-f0-9]{64}$'),
  code_verifier text not null,
  nonce text not null,
  expires_at timestamptz not null
);

create index if not exists oauth_states_expires_at_idx on public.oauth_states (expires_at);

alter table public.sessions enable row level security;
alter table public.oauth_states enable row level security;
revoke all on table public.sessions, public.oauth_states from public;
