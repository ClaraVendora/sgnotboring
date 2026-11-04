create table public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  is_shared boolean not null default false,
  share_token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index collections_user_created_idx on public.collections (user_id, created_at desc, id);
create trigger collections_set_updated_at before update on public.collections
  for each row execute function public.set_updated_at();

create table public.collection_places (
  collection_id uuid not null references public.collections(id) on delete cascade,
  place_id uuid not null references public.places(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (collection_id, place_id)
);
create index collection_places_place_idx on public.collection_places (place_id);

alter table public.collections enable row level security;
alter table public.collection_places enable row level security;
revoke all on public.collections, public.collection_places from anon, authenticated;
grant select on public.collections, public.collection_places to authenticated;
grant all on public.collections, public.collection_places to service_role;
create policy "read own collections" on public.collections for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "read own collection places" on public.collection_places for select to authenticated
  using (exists (
    select 1 from public.collections c
    where c.id = collection_id and c.user_id = (select auth.uid())
  ));
-- All writes go through owner-checked API routes. Public shared reads go through
-- the API using an unguessable token, and only after is_shared is enabled.
