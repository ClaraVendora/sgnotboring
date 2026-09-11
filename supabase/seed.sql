-- Local-only sample data so the UI has something to render.
insert into public.places (google_place_id, name, address, rating, user_ratings_total, price_level, tags, summary)
values
  ('seed-1', 'Tian Tian Hainanese Chicken Rice', '1 Kadayanallur St, Maxwell Food Centre', 4.4, 8200, 1,
   array['Hawker', 'Lunch', 'Iconic', 'Cheap Eats'], 'The chicken rice that started every argument about chicken rice.'),
  ('seed-2', 'Swee Choon Tim Sum', '183-191 Jalan Besar', 4.1, 6100, 1,
   array['Late Night', 'Dim Sum', 'Supper', 'Group Friendly'], 'Open till 6am. The unofficial post-clubbing canteen.'),
  ('seed-3', 'Zam Zam Restaurant', '697-699 North Bridge Rd', 4.2, 5400, 1,
   array['Murtabak', 'Halal', 'Late Night', 'Spicy'], 'Century-old murtabak specialist opposite Sultan Mosque.'),
  ('seed-4', 'Atlas Bar', '600 North Bridge Rd, Parkview Square', 4.6, 3900, 4,
   array['Date Night', 'Cocktails', 'Art Deco', 'Dress Up'], 'Gin palace in a Gotham-style lobby. Book ahead.')
on conflict (google_place_id) do nothing;
