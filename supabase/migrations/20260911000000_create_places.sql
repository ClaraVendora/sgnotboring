-- Places discovered from Google Places, enriched with LLM-generated tags.
create extension if not exists "pgcrypto";

create table if not exists public.places (
  id               uuid primary key default gen_random_uuid(),
  google_place_id  text unique not null,
  name             text not null,
  address          text,
  lat              double precision,
  lng              double precision,
  rating           numeric(2,1),
  user_ratings_total integer,
  price_level      smallint,
  opening_hours    jsonb,            -- raw Google weekday_text / periods
  tags             text[] not null default '{}',
  summary          text,             -- LLM one-liner
  raw              jsonb,            -- full Google Places payload for re-processing
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists places_tags_gin_idx on public.places using gin (tags);
create index if not exists places_rating_idx on public.places (rating desc);

-- keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists places_set_updated_at on public.places;
create trigger places_set_updated_at
  before update on public.places
  for each row execute function public.set_updated_at();

-- Public read, writes only via service role (the ingest script / API).
alter table public.places enable row level security;

drop policy if exists "places are publicly readable" on public.places;
create policy "places are publicly readable"
  on public.places for select
  to anon, authenticated
  using (true);
