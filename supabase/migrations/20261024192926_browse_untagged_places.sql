-- Browse imported places immediately; Gemini enrichment is optional.
-- Selected tags still match only places assigned at least one matching tag.
create or replace function public.browse_places(search_text text default '', selected_tags text[] default '{}')
returns setof public.places
language sql stable security invoker
set search_path = ''
as $$
  select p.* from public.places p
  where (coalesce(cardinality(selected_tags), 0) = 0 or p.tags && selected_tags)
    and (
      coalesce(btrim(search_text), '') = ''
      or strpos(lower(p.name), lower(btrim(search_text))) > 0
      or strpos(lower(coalesce(p.address, '')), lower(btrim(search_text))) > 0
      or exists (
        select 1 from public.tags t
        where t.facet = 'area' and t.name = any(p.tags)
          and strpos(lower(t.name), lower(btrim(search_text))) > 0
      )
    )
  order by p.rating desc nulls last, p.name, p.id;
$$;
revoke all on function public.browse_places(text, text[]) from public;
grant execute on function public.browse_places(text, text[]) to anon, authenticated, service_role;
