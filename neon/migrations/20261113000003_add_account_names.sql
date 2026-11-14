alter table public.users
  add column if not exists first_name text check (char_length(first_name) between 1 and 100 and first_name ~ '[^[:space:]]'),
  add column if not exists last_name text check (char_length(last_name) between 1 and 100 and last_name ~ '[^[:space:]]');
