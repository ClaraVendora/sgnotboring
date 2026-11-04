-- Keep historical text-only reviews unrated rather than inventing a score.
-- New API submissions require a rating; authors can rate older reviews by editing.
alter table public.place_reviews add column rating smallint
  check (rating between 1 and 5);
create index place_reviews_user_created_idx on public.place_reviews (user_id, created_at desc, id);
