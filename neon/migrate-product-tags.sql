do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'products' and column_name = 'tag') then
    update public.products set tags = case when btrim(tag) = '' then '[]'::jsonb else jsonb_build_array(tag) end;
    alter table public.products drop column tag;
  end if;
end;
$$;
