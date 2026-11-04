-- Community reviews are separate from Google's rating and review count.
create table public.place_reviews (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null check (char_length(author_name) between 1 and 60),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (place_id, user_id)
);

create index place_reviews_place_created_idx on public.place_reviews (place_id, created_at desc, id);
create trigger place_reviews_set_updated_at before update on public.place_reviews
  for each row execute function public.set_updated_at();

alter table public.place_reviews enable row level security;
revoke all on public.place_reviews from anon, authenticated;
grant select on public.place_reviews to anon, authenticated;
grant all on public.place_reviews to service_role;
create policy "public reviews are readable" on public.place_reviews
  for select to anon, authenticated using (true);
-- All writes go through the API; user_id comes from its verified Auth session.
