-- Controlled tag vocabulary. The enrich job may only assign these tags, and /ask may only
-- filter on them, so both LLM prompts speak the same language. `name` is the label stored
-- as-is in places.tags. To change the vocabulary, add a migration that upserts/deletes rows.
create table if not exists public.tags (
  name        text primary key,
  facet       text not null
              check (facet in ('type', 'area', 'cuisine', 'dietary', 'budget', 'time',
                               'vibe', 'occasion', 'drinks', 'feature')),
  description text not null,          -- shown to the LLM so tags are applied consistently
  created_at  timestamptz not null default now()
);

alter table public.tags enable row level security;

drop policy if exists "tags are publicly readable" on public.tags;
create policy "tags are publicly readable"
  on public.tags for select
  to anon, authenticated
  using (true);

insert into public.tags (name, facet, description) values
  -- what kind of place
  ('Cafe',       'type', 'Coffee-and-brunch spot: cafes, coffee bars, bakery-cafes.'),
  ('Restaurant', 'type', 'Sit-down restaurant with table service.'),
  ('Hawker',     'type', 'Hawker centre stall, kopitiam or food court. Cheap, fast, local.'),
  ('Bar',        'type', 'Drinks-first venue: cocktail bar, wine bar, brewery, beach club.'),
  ('Dessert',    'type', 'Dessert-focused: ice cream, gelato, shaved ice, cakes, tong sui.'),
  ('Bakery',     'type', 'Bakery or patisserie: bread, pastries, takeaway bakes.'),

  -- where (assign exactly one, from the address)
  ('Bugis & Kampong Glam', 'area', 'Bugis, Arab Street, Haji Lane, Bussorah Street, Beach Road, Parkview Square.'),
  ('Chinatown',            'area', 'Chinatown, Maxwell, Smith Street, Temple Street, Chinatown Complex.'),
  ('Tanjong Pagar',        'area', 'Tanjong Pagar, Keong Saik, Duxton, Amoy Street, Tras Street, Everton Park.'),
  ('CBD',                  'area', 'Raffles Place, Telok Ayer, Shenton Way, Lau Pa Sat, Far East Square.'),
  ('Tiong Bahru',          'area', 'Tiong Bahru estate, Yong Siak Street, Tiong Bahru Market, Bukit Ho Swee.'),
  ('Orchard',              'area', 'Orchard Road, Somerset, Scotts Road, Paragon, Far East Plaza.'),
  ('City Hall',            'area', 'City Hall, Bras Basah, Dhoby Ghaut, National Gallery, Esplanade.'),
  ('Riverside',            'area', 'Clarke Quay, Robertson Quay, Boat Quay, Martin Road, Riverside Point.'),
  ('Marina Bay',           'area', 'Marina Bay Sands, Gardens by the Bay, Marina Bay Financial Centre.'),
  ('Little India',         'area', 'Little India, Serangoon Road, Race Course Road, Tekka Centre.'),
  ('Jalan Besar',          'area', 'Jalan Besar, Lavender, Tyrwhitt Road, Bendemeer.'),
  ('Katong & Joo Chiat',   'area', 'East Coast Road, Katong, Joo Chiat, Marine Parade.'),
  ('Holland Village',      'area', 'Holland Village, Lorong Mambong, Chip Bee Gardens.'),
  ('Dempsey',              'area', 'Dempsey Hill, Harding Road, Tanglin, Botanic Gardens edge.'),
  ('Bukit Timah',          'area', 'Bukit Timah, Adam Road, Watten, Sixth Avenue, Beauty World.'),
  ('Novena',               'area', 'Novena, Balestier, Whampoa.'),
  ('Upper Thomson',        'area', 'Upper Thomson Road, Thomson, Sin Ming.'),
  ('East Coast',           'area', 'East Coast Park, Siglap, Bedok, East Coast Lagoon.'),
  ('Sentosa',              'area', 'Sentosa island: Siloso, Palawan and Tanjong beaches.'),
  ('Changi',               'area', 'Changi Village, Changi Point, Pasir Ris edge.'),

  -- cuisine
  ('Local',           'cuisine', 'Singaporean hawker classics: chicken rice, laksa, char kway teow, kaya toast, bak chor mee.'),
  ('Chinese',         'cuisine', 'Chinese cuisines: Cantonese, Teochew, Hainanese, Sichuan, dim sum, zi char, bak kut teh.'),
  ('Malay',           'cuisine', 'Malay and Indonesian: nasi lemak, nasi padang, rendang, mee rebus, satay.'),
  ('Indian',          'cuisine', 'North, South and Indian-Muslim: biryani, prata, murtabak, thosai, fish head curry.'),
  ('Peranakan',       'cuisine', 'Nyonya/Peranakan: ayam buah keluak, Katong laksa, kueh.'),
  ('Japanese',        'cuisine', 'Sushi, ramen, izakaya, donburi, omakase.'),
  ('Korean',          'cuisine', 'Korean BBQ, Korean fried chicken, stews, banchan.'),
  ('Thai',            'cuisine', 'Thai food: tom yum, green curry, pad thai, mookata.'),
  ('Vietnamese',      'cuisine', 'Pho, banh mi, spring rolls.'),
  ('Western',         'cuisine', 'Burgers, steak, grills, brunch plates, Australian or European bistro food.'),
  ('Italian',         'cuisine', 'Pizza, pasta, Italian small plates.'),
  ('Middle Eastern',  'cuisine', 'Lebanese, Turkish, Mediterranean mezze, kebabs, grills.'),
  ('Modern & Fusion', 'cuisine', 'Chef-driven contemporary or fusion cooking, tasting menus.'),
  ('Seafood',         'cuisine', 'Seafood-led: chilli crab, fish head, BBQ stingray, oysters.'),

  -- dietary (only with explicit evidence)
  ('Halal',               'dietary', 'Halal-certified or Muslim-owned. Only when the data explicitly says so; never infer from cuisine.'),
  ('Vegetarian Friendly', 'dietary', 'Several proper vegetarian dishes, not just a side salad.'),
  ('Vegetarian Only',     'dietary', 'Entire menu is vegetarian or vegan.'),

  -- budget (per person)
  ('Budget',    'budget', 'About S$15 or less per person. Most hawker stalls. Google price level 1.'),
  ('Mid-Range', 'budget', 'About S$15-40 per person. Google price level 2.'),
  ('Splurge',   'budget', 'S$40+ per person. Google price level 3-4. Treat-yourself or special occasions.'),

  -- when
  ('Brunch',     'time', 'Serves breakfast or brunch; a good morning spot.'),
  ('Late Night', 'time', 'Open past 11pm on most days; good for supper.'),

  -- vibe
  ('Chill',      'vibe', 'Relaxed and unhurried; easy to hang out for a while.'),
  ('Lively',     'vibe', 'Buzzy, loud, energetic crowd.'),
  ('Cosy',       'vibe', 'Small, intimate and warm.'),
  ('Aesthetic',  'vibe', 'Design-led, photogenic interiors; Instagram-worthy.'),
  ('Iconic',     'vibe', 'Singapore institution or famous must-try; around for years.'),
  ('Hidden Gem', 'vibe', 'Lesser known, tucked away, under the radar.'),

  -- occasion
  ('Date Night',     'occasion', 'Romantic or impressive enough for a date.'),
  ('Group Friendly', 'occasion', 'Works for groups of 5+: big tables, sharing plates.'),
  ('Solo Friendly',  'occasion', 'Easy to go alone: counter seats, single portions, quick service.'),
  ('Quick Bite',     'occasion', 'Fast and casual; in and out in about 30 minutes.'),

  -- drinks
  ('Specialty Coffee', 'drinks', 'Serious coffee worth travelling for; roasters and espresso bars.'),
  ('Cocktails',        'drinks', 'A real cocktail programme.'),
  ('Beer & Wine',      'drinks', 'Good beer or wine selection.'),

  -- features
  ('Outdoor Seating', 'feature', 'Alfresco tables.'),
  ('Work Friendly',   'feature', 'OK to linger with a laptop or to study: seats, power points, wifi.'),
  ('Pet Friendly',    'feature', 'Dogs allowed, at least in the outdoor area.'),
  ('Great View',      'feature', 'Rooftop, waterfront, beach or skyline view.')
on conflict (name) do update
  set facet = excluded.facet, description = excluded.description;
