-- Microservices: one Postgres, one schema per service. Each service's client is pinned to its
-- own schema and reaches other services' data over HTTP, never by SQL.
--   catalog   (Places)    places, tags, raw_places + search/browse/normalize functions
--   accounts  (Accounts)  preferences, saved_places + survey tag check
--   community (Community) collections, collection_places, place_reviews
-- AI search owns no tables.
--
-- One-off exception to "additive only": tables are moved, not copied. `set schema` keeps the
-- data, indexes, constraints, RLS policies, grants and triggers. Hosted projects must also list
-- the three schemas under Settings → Data API → Exposed schemas (local: supabase/config.toml).

create schema if not exists catalog;
create schema if not exists accounts;
create schema if not exists community;

grant usage on schema catalog, accounts, community to anon, authenticated, service_role;
-- Future tables: the API (service_role) can use them; browser roles get explicit grants per table.
alter default privileges in schema catalog, accounts, community
  grant all on tables to service_role;
alter default privileges in schema catalog, accounts, community
  grant all on functions to service_role;

alter table public.places            set schema catalog;
alter table public.tags              set schema catalog;
alter table public.raw_places        set schema catalog;
alter table public.preferences       set schema accounts;
alter table public.saved_places      set schema accounts;
alter table public.collections       set schema community;
alter table public.collection_places set schema community;
alter table public.place_reviews     set schema community;

-- No foreign keys across services. Accounts and Community check that a place exists by asking
-- Places. Places are never deleted (imports only insert or update), so nothing is orphaned.
alter table accounts.saved_places       drop constraint if exists saved_places_place_id_fkey;
alter table community.collection_places drop constraint if exists collection_places_place_id_fkey;
alter table community.place_reviews     drop constraint if exists place_reviews_place_id_fkey;

-- The survey check read the Places tag list across services. Accounts now checks against its
-- own survey answers (the same list as surveyTags in apps/accounts/src/services/preferences.js),
-- still on direct authenticated writes. Changing the survey options needs a migration.
drop trigger if exists preferences_validate_tags on accounts.preferences;
drop function if exists public.validate_preference_tags();

create function accounts.validate_preference_tags()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not new.tags <@ array[
    'Hawker', 'Cafe', 'Restaurant', 'Bar', 'Dessert', 'Bakery',
    'Budget', 'Mid-Range', 'Splurge',
    'Halal', 'No pork', 'Vegetarian Friendly', 'Vegetarian Only',
    'Solo Friendly', 'Date Night', 'Group Friendly', 'Family Friendly'
  ]::text[] then
    raise exception 'Unknown preference tag' using errcode = '23514';
  end if;
  if cardinality(new.tags) <> (select count(distinct tag) from unnest(new.tags) as answer(tag)) then
    raise exception 'Duplicate preference tag' using errcode = '23514';
  end if;
  return new;
end $$;

create trigger preferences_validate_tags before insert or update on accounts.preferences
  for each row execute function accounts.validate_preference_tags();

-- set_updated_at() stays in public: a generic helper with no table references, shared by
-- triggers in every schema.

-- ---- catalog functions (bodies named public.* tables, so they are recreated here) ----

drop trigger if exists raw_places_normalize on catalog.raw_places;
drop function if exists public.normalize_raw_place();
drop function if exists public.search_places(text[], text[], integer);
drop function if exists public.browse_places(text, text[]);

-- raw_places → places. Refresh imported fields while preserving AI tags, summaries, and an
-- existing photo when a later search omits its thumbnail.
create function catalog.normalize_raw_place()
returns trigger language plpgsql
set search_path = ''
as $$
declare
  p jsonb := new.payload;
begin
  insert into catalog.places (
    google_place_id, name, address, lat, lng, rating, user_ratings_total,
    price_level, opening_hours, google_maps_uri, photo_url
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
    p->>'googleMapsUri',
    case when p->>'photoUrl' like 'https://%' then p->>'photoUrl' end
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
    google_maps_uri    = excluded.google_maps_uri,
    photo_url          = coalesce(excluded.photo_url, places.photo_url);
  return null;
end $$;

create trigger raw_places_normalize
  after insert or update of payload on catalog.raw_places
  for each row execute function catalog.normalize_raw_place();

-- Candidate search for AI search. must_tags are all required (@>); want_tags are optional
-- and score one point each. Only tagged places are searchable.
create function catalog.search_places(
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
language sql stable security invoker
set search_path = ''
as $$
  select p.id, p.name, p.address, p.rating, p.user_ratings_total, p.price_level,
         p.tags, p.summary, p.opening_hours,
         cardinality(array(select unnest(p.tags) intersect select unnest(want_tags)))::integer
  from catalog.places p
  where p.enriched_at is not null
    and p.tags @> must_tags
  order by 10 desc, p.rating desc nulls last, p.user_ratings_total desc nulls last
  limit least(greatest(max_results, 1), 50)
$$;

-- Browse imported places immediately; Gemini enrichment is optional.
-- Selected tags still match only places assigned at least one matching tag.
create function catalog.browse_places(search_text text default '', selected_tags text[] default '{}')
returns setof catalog.places
language sql stable security invoker
set search_path = ''
as $$
  select p.* from catalog.places p
  where (coalesce(cardinality(selected_tags), 0) = 0 or p.tags && selected_tags)
    and (
      coalesce(btrim(search_text), '') = ''
      or strpos(lower(p.name), lower(btrim(search_text))) > 0
      or strpos(lower(coalesce(p.address, '')), lower(btrim(search_text))) > 0
      or exists (
        select 1 from catalog.tags t
        where t.facet = 'area' and t.name = any(p.tags)
          and strpos(lower(t.name), lower(btrim(search_text))) > 0
      )
    )
  order by p.rating desc nulls last, p.name, p.id;
$$;

revoke all on function catalog.browse_places(text, text[]) from public;
revoke all on function catalog.search_places(text[], text[], integer) from public;
grant execute on function catalog.browse_places(text, text[]) to anon, authenticated, service_role;
grant execute on function catalog.search_places(text[], text[], integer) to anon, authenticated, service_role;
