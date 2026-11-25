-- Macclesfield Tamil Sangam — step 4: YouTube videos for events. Safe to re-run.
alter table public.events add column if not exists videos text[] not null default '{}';
notify pgrst, 'reload schema';
