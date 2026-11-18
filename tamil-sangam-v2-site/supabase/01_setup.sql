-- =====================================================================
-- Macclesfield Tamil Sangam — database setup (run once)
-- Supabase → SQL Editor → New query → paste all of this → Run
-- Safe to re-run: it skips things that already exist.
-- =====================================================================

-- ---------- 1. Profiles (one row per person who signs up) ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  phone       text,
  role        text not null default 'member'  check (role   in ('member','editor','admin')),
  status      text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at  timestamptz not null default now()
);

-- Helper checks used by the security rules below
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles
                 where id = auth.uid() and role in ('admin','editor'));
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles
                 where id = auth.uid() and role = 'admin');
$$;

-- Create a profile automatically when someone signs up
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (new.id,
          new.raw_user_meta_data->>'full_name',
          new.raw_user_meta_data->>'phone')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Members can edit their own name/phone, but only an admin can change role/status
create or replace function public.protect_profile_fields() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.role is distinct from old.role or new.status is distinct from old.status)
     and not public.is_admin()
     and auth.uid() is not null then
    raise exception 'Only an admin can change role or status';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_fields on public.profiles;
create trigger protect_profile_fields
  before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- ---------- 2. Events ----------
create table if not exists public.events (
  id                 uuid primary key default gen_random_uuid(),
  slug               text unique not null,             -- used in the web address, e.g. pongal-2026
  title_en           text not null,
  title_ta           text,
  description_en     text,
  description_ta     text,
  starts_at          timestamptz not null,
  ends_at            timestamptz,
  venue              text,
  cover_url          text,
  is_published       boolean not null default false,   -- hidden from the public until true
  registration_open  boolean not null default false,
  created_at         timestamptz not null default now()
);
create index if not exists events_starts_at_idx on public.events (starts_at desc);

-- ---------- 3. Ticket types (Adult / Child / Family / Free ...) ----------
create table if not exists public.ticket_types (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references public.events(id) on delete cascade,
  name_en      text not null,
  name_ta      text,
  price_pence  integer not null default 0 check (price_pence >= 0),   -- 0 = free; 500 = £5.00
  capacity     integer check (capacity is null or capacity > 0),     -- empty = unlimited
  sort         integer not null default 0
);

-- ---------- 4. Registrations / tickets ----------
create table if not exists public.registrations (
  id                 uuid primary key default gen_random_uuid(),
  event_id           uuid not null references public.events(id) on delete cascade,
  ticket_type_id     uuid references public.ticket_types(id) on delete set null,
  user_id            uuid references auth.users(id) on delete set null,
  name               text not null,
  email              text not null,
  phone              text,
  quantity           integer not null default 1 check (quantity > 0),
  amount_pence       integer not null default 0 check (amount_pence >= 0),
  status             text not null default 'pending'
                     check (status in ('pending','free','paid','cancelled','refunded')),
  stripe_session_id  text unique,
  checked_in         boolean not null default false,
  created_at         timestamptz not null default now()
);
create index if not exists registrations_event_idx on public.registrations (event_id);

-- ---------- 5. Photos ----------
create table if not exists public.photos (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid references public.events(id) on delete cascade,
  storage_path  text not null,          -- file path inside the 'photos' storage bucket
  caption_en    text,
  caption_ta    text,
  sort          integer not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists photos_event_idx on public.photos (event_id);

-- ---------- 6. Contact messages ----------
create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text not null,
  phone       text,
  subject     text,
  message     text not null,
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);

-- =====================================================================
-- Security rules (Row Level Security)
-- Public: sees published events, their ticket types and photos only.
-- Members: see their own profile and their own registrations.
-- Admin/editor: see and manage everything.
-- Registrations, payments and contact messages are written by the
-- server-side Netlify Functions, which use the secret service key.
-- =====================================================================
alter table public.profiles      enable row level security;
alter table public.events        enable row level security;
alter table public.ticket_types  enable row level security;
alter table public.registrations enable row level security;
alter table public.photos        enable row level security;
alter table public.messages      enable row level security;

-- profiles
drop policy if exists "profiles: read own or staff"   on public.profiles;
drop policy if exists "profiles: update own or admin" on public.profiles;
create policy "profiles: read own or staff" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_staff());
create policy "profiles: update own or admin" on public.profiles
  for update to authenticated using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- events
drop policy if exists "events: public read published" on public.events;
drop policy if exists "events: staff manage"          on public.events;
create policy "events: public read published" on public.events
  for select to anon, authenticated using (is_published or public.is_staff());
create policy "events: staff manage" on public.events
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ticket types
drop policy if exists "tickets: public read" on public.ticket_types;
drop policy if exists "tickets: staff manage" on public.ticket_types;
create policy "tickets: public read" on public.ticket_types
  for select to anon, authenticated using (
    public.is_staff() or exists (select 1 from public.events e
                                 where e.id = event_id and e.is_published));
create policy "tickets: staff manage" on public.ticket_types
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- photos
drop policy if exists "photos: public read" on public.photos;
drop policy if exists "photos: staff manage" on public.photos;
create policy "photos: public read" on public.photos
  for select to anon, authenticated using (
    public.is_staff() or event_id is null or exists (select 1 from public.events e
                                 where e.id = event_id and e.is_published));
create policy "photos: staff manage" on public.photos
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- registrations
drop policy if exists "registrations: own or staff read" on public.registrations;
drop policy if exists "registrations: staff update"      on public.registrations;
create policy "registrations: own or staff read" on public.registrations
  for select to authenticated using (user_id = auth.uid() or public.is_staff());
create policy "registrations: staff update" on public.registrations
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

-- messages
drop policy if exists "messages: staff read"   on public.messages;
drop policy if exists "messages: staff update" on public.messages;
create policy "messages: staff read" on public.messages
  for select to authenticated using (public.is_staff());
create policy "messages: staff update" on public.messages
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

-- Table permissions (the rules above still decide which rows)
grant select on public.events, public.ticket_types, public.photos to anon;
grant select, insert, update, delete on public.events, public.ticket_types, public.photos to authenticated;
grant select, update on public.profiles, public.registrations, public.messages to authenticated;

-- Spaces left for each ticket type (used by the event page)
create or replace view public.ticket_availability
with (security_invoker = false) as
  select t.id as ticket_type_id, t.event_id, t.capacity,
         coalesce(sum(r.quantity) filter (where r.status in ('free','paid','pending')), 0)::int as taken,
         case when t.capacity is null then null
              else greatest(t.capacity - coalesce(sum(r.quantity) filter (where r.status in ('free','paid','pending')), 0), 0)::int
         end as remaining
  from public.ticket_types t
  join public.events e on e.id = t.event_id and e.is_published
  left join public.registrations r on r.ticket_type_id = t.id
  group by t.id;
grant select on public.ticket_availability to anon, authenticated;

-- =====================================================================
-- Photo storage bucket (public images, only staff can upload/delete)
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

drop policy if exists "photos bucket: staff upload" on storage.objects;
drop policy if exists "photos bucket: staff change" on storage.objects;
drop policy if exists "photos bucket: staff delete" on storage.objects;
create policy "photos bucket: staff upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'photos' and public.is_staff());
create policy "photos bucket: staff change" on storage.objects
  for update to authenticated using (bucket_id = 'photos' and public.is_staff());
create policy "photos bucket: staff delete" on storage.objects
  for delete to authenticated using (bucket_id = 'photos' and public.is_staff());

-- =====================================================================
-- Starter data: the past events currently on the website.
-- Dates are approximate — correct them later in the admin area.
-- =====================================================================
insert into public.events (slug, title_en, title_ta, description_en, description_ta, starts_at, venue, is_published)
values
 ('deepavali-2026', 'Deepavali Celebration', 'தீபாவளிக் கொண்டாட்டம்',
  'An evening of lights, music, dance and festive food.', 'விளக்குகள், இசை, நடனம் மற்றும் பண்டிகை உணவுடன் ஒரு மாலைப் பொழுது.',
  '2026-11-01 17:00+00', 'Macclesfield', true),
 ('puthandu-2026', 'Tamil New Year (Puthandu)', 'தமிழ்ப் புத்தாண்டு',
  'Cultural programme by children and families.', 'குழந்தைகள் மற்றும் குடும்பங்களின் கலை நிகழ்ச்சிகள்.',
  '2026-04-14 14:00+01', 'Macclesfield', true),
 ('pongal-2026', 'Pongal Vizha', 'பொங்கல் விழா',
  'Traditional pongal, kolam competition and games.', 'பாரம்பரியப் பொங்கல், கோலப் போட்டி மற்றும் விளையாட்டுகள்.',
  '2026-01-15 11:00+00', 'Macclesfield', true),
 ('deepavali-2025', 'Deepavali Celebration', 'தீபாவளிக் கொண்டாட்டம்',
  'Community dinner and cultural performances.', 'சமூக இரவு விருந்தும் கலை நிகழ்ச்சிகளும்.',
  '2025-10-20 17:00+01', 'Macclesfield', true),
 ('summer-picnic-2025', 'Summer Picnic', 'கோடைச் சுற்றுலா',
  'Family day out with sports and games.', 'விளையாட்டுகளுடன் குடும்பங்களின் ஒரு நாள் சுற்றுலா.',
  '2025-07-12 11:00+01', 'Macclesfield', true),
 ('pongal-2024', 'Pongal Vizha', 'பொங்கல் விழா',
  'Our Pongal celebration with the whole community.', 'முழுச் சமூகத்துடன் எங்கள் பொங்கல் கொண்டாட்டம்.',
  '2024-01-15 11:00+00', 'Macclesfield', true)
on conflict (slug) do nothing;
