-- Raw Google Places (New) payloads, stored as returned. Inserting a row normalizes it into
-- public.places (trigger below) and queues it for LLM tagging: enrich_status starts 'pending'
-- and `node src/scripts/enrich.js` (apps/api) drains the queue.
create table if not exists public.raw_places (
  google_place_id text primary key,
  payload         jsonb not null,       -- Place object from Places API (New), camelCase fields
  source          text,                 -- where it came from: 'seed', an ingest query, ...
  fetched_at      timestamptz not null default now(),
  enrich_status   text not null default 'pending'
                  check (enrich_status in ('pending', 'done', 'failed')),
  enrich_attempts integer not null default 0,
  enrich_error    text,
  enriched_at     timestamptz
);

create index if not exists raw_places_enrich_queue_idx
  on public.raw_places (fetched_at)
  where enrich_status <> 'done';

-- Service role only: RLS on with no policies, so the anon key can't read raw payloads.
alter table public.raw_places enable row level security;

alter table public.places add column if not exists google_maps_uri text;
alter table public.places add column if not exists enriched_at timestamptz; -- null = not tagged yet

-- raw_places.payload → places columns. Never touches tags/summary (the enrich job owns those),
-- so re-ingesting a place refreshes rating and hours without re-spending LLM quota.
create or replace function public.normalize_raw_place()
returns trigger language plpgsql as $$
declare
  p jsonb := new.payload;
begin
  insert into public.places (
    google_place_id, name, address, lat, lng, rating, user_ratings_total,
    price_level, opening_hours, google_maps_uri
  ) values (
    new.google_place_id,
    p->'displayName'->>'text',
    p->>'formattedAddress',
    (p->'location'->>'latitude')::double precision,
    (p->'location'->>'longitude')::double precision,
    (p->>'rating')::numeric(2,1),
    (p->>'userRatingCount')::integer,
    case p->>'priceLevel'
      when 'PRICE_LEVEL_FREE' then 0
      when 'PRICE_LEVEL_INEXPENSIVE' then 1
      when 'PRICE_LEVEL_MODERATE' then 2
      when 'PRICE_LEVEL_EXPENSIVE' then 3
      when 'PRICE_LEVEL_VERY_EXPENSIVE' then 4
    end,
    p->'regularOpeningHours',
    p->>'googleMapsUri'
  )
  on conflict (google_place_id) do update set
    name               = excluded.name,
    address            = excluded.address,
    lat                = excluded.lat,
    lng                = excluded.lng,
    rating             = excluded.rating,
    user_ratings_total = excluded.user_ratings_total,
    price_level        = excluded.price_level,
    opening_hours      = excluded.opening_hours,
    google_maps_uri    = excluded.google_maps_uri;
  return null;
end $$;

drop trigger if exists raw_places_normalize on public.raw_places;
create trigger raw_places_normalize
  after insert or update of payload on public.raw_places
  for each row execute function public.normalize_raw_place();

-- Candidate search for POST /ask. must_tags are all required (@>); want_tags are optional
-- and score one point each. Only tagged places are searchable.
create or replace function public.search_places(
  must_tags   text[]  default '{}',
  want_tags   text[]  default '{}',
  max_results integer default 20
)
returns table (
  id                 uuid,
  name               text,
  address            text,
  rating             numeric,
  user_ratings_total integer,
  price_level        smallint,
  tags               text[],
  summary            text,
  opening_hours      jsonb,
  match_score        integer
)
language sql stable as $$
  select p.id, p.name, p.address, p.rating, p.user_ratings_total, p.price_level,
         p.tags, p.summary, p.opening_hours,
         cardinality(array(select unnest(p.tags) intersect select unnest(want_tags)))::integer
  from public.places p
  where p.enriched_at is not null
    and p.tags @> must_tags
  order by 10 desc, p.rating desc nulls last, p.user_ratings_total desc nulls last
  limit least(greatest(max_results, 1), 50)
$$;
