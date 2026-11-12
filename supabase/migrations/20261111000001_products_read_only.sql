revoke all on table public.products from public, anon, authenticated;
grant select on table public.products to anon, authenticated;

create policy "Anyone can read products"
  on public.products for select
  to anon, authenticated
  using (true);
