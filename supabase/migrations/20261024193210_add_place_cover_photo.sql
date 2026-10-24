-- Public cover image from SerpApi; no photo API key is exposed to the browser.
alter table public.places add column if not exists photo_url text;

-- Refresh imported fields while preserving AI tags, summaries, and an existing photo
-- when a later search omits its thumbnail.
create or replace function public.normalize_raw_place()
returns trigger language plpgsql as $$
declare
  p jsonb := new.payload;
begin
  insert into public.places (
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

-- Backfill any raw payloads that already contain a cover URL.
update public.raw_places set payload = payload where payload->>'photoUrl' like 'https://%';
