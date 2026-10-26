-- Survey answers use the same controlled vocabulary as places and AI Search.
insert into public.tags (name, facet, description) values
  ('No pork', 'dietary', 'Explicitly pork-free menu. Do not infer from cuisine or equate this with halal certification.'),
  ('Family Friendly', 'occasion', 'Suitable for dining with children: family seating, child-friendly menu or facilities supported by the source.')
on conflict (name) do update
  set facet = excluded.facet, description = excluded.description;

create table public.preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint preferences_tags_shape check (
    cardinality(tags) <= 30 and coalesce(array_ndims(tags), 1) = 1
    and array_position(tags, null) is null
  )
);

-- A text[] cannot have a foreign key for each element. Validate vocabulary even
-- on direct authenticated PostgREST writes (not just writes through our API).
create function public.validate_preference_tags()
returns trigger language plpgsql set search_path = '' as $$
begin
  if exists (
    select 1 from unnest(new.tags) as answer(tag)
    where not exists (select 1 from public.tags where name = answer.tag)
  ) then
    raise exception 'Unknown preference tag' using errcode = '23514';
  end if;
  if cardinality(new.tags) <> (select count(distinct tag) from unnest(new.tags) as answer(tag)) then
    raise exception 'Duplicate preference tag' using errcode = '23514';
  end if;
  return new;
end $$;

create trigger preferences_validate_tags before insert or update on public.preferences
  for each row execute function public.validate_preference_tags();
create trigger preferences_set_updated_at before update on public.preferences
  for each row execute function public.set_updated_at();

alter table public.preferences enable row level security;
revoke all on public.preferences from anon, authenticated;
grant select, insert, update, delete on public.preferences to authenticated;
create policy "read own preferences" on public.preferences for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "insert own preferences" on public.preferences for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "update own preferences" on public.preferences for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "delete own preferences" on public.preferences for delete to authenticated
  using ((select auth.uid()) = user_id);

create table public.saved_places (
  user_id uuid not null references auth.users(id) on delete cascade,
  place_id uuid not null references public.places(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, place_id)
);
create index saved_places_user_created_idx on public.saved_places (user_id, created_at desc);
create index saved_places_place_idx on public.saved_places (place_id);
alter table public.saved_places enable row level security;
revoke all on public.saved_places from anon, authenticated;
grant select, insert, delete on public.saved_places to authenticated;
create policy "read own saved places" on public.saved_places for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "insert own saved places" on public.saved_places for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "delete own saved places" on public.saved_places for delete to authenticated
  using ((select auth.uid()) = user_id);
