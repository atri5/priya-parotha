create or replace function public.apply_product_edits(edits jsonb)
returns setof public.products
language plpgsql
security invoker
set search_path = public
as $$
declare
  edit jsonb;
  current_product public.products;
  updated_product public.products;
begin
  for edit in select value from jsonb_array_elements(edits) order by value->'before'->>'id'
  loop
    select * into current_product from public.products where id = edit->'before'->>'id' for update;
    if not found or to_jsonb(current_product) <> edit->'before' then
      raise exception 'Product changed since it was loaded. Reload before saving.' using errcode = '40001';
    end if;
    update public.products set
      name = edit->'after'->>'name',
      "desc" = edit->'after'->>'desc',
      price = edit->'after'->>'price',
      q_available = edit->'after'->>'q_available',
      tags = edit->'after'->'tags',
      photos = edit->'after'->'photos',
      published = (edit->'after'->>'published')::boolean
    where id = current_product.id returning * into updated_product;
    return next updated_product;
  end loop;
end;
$$;
