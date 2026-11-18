-- =====================================================================
-- Macclesfield Tamil Sangam — step 2: members, registrations & tickets
-- Run AFTER 01_setup.sql.  Supabase → SQL Editor → New query → paste → Run
-- Safe to re-run.
-- =====================================================================

-- Unpaid bookings hold their places for this long while the person pays
create or replace function public.pending_hold() returns interval
language sql immutable as $$ select interval '35 minutes' $$;

-- Places taken = free + paid + recent unpaid holds
create or replace view public.ticket_availability
with (security_invoker = false) as
  select t.id as ticket_type_id, t.event_id, t.capacity,
         coalesce(sum(r.quantity) filter (
           where r.status in ('free','paid')
              or (r.status = 'pending' and r.created_at > now() - public.pending_hold())), 0)::int as taken,
         case when t.capacity is null then null
              else greatest(t.capacity - coalesce(sum(r.quantity) filter (
                     where r.status in ('free','paid')
                        or (r.status = 'pending' and r.created_at > now() - public.pending_hold())), 0), 0)::int
         end as remaining
  from public.ticket_types t
  join public.events e on e.id = t.event_id and e.is_published
  left join public.registrations r on r.ticket_type_id = t.id
  group by t.id;
grant select on public.ticket_availability to anon, authenticated;

-- One booking, checked and saved in a single step so two people can't
-- take the last place at the same time. Only the server (Netlify Function,
-- using the secret key) may call this.
create or replace function public.create_registration(
  p_event uuid, p_ticket uuid, p_qty int,
  p_name text, p_email text, p_phone text, p_user uuid default null
) returns public.registrations
language plpgsql security definer set search_path = public as $$
declare
  ev  public.events;
  tk  public.ticket_types;
  taken int;
  reg public.registrations;
begin
  if p_qty is null or p_qty < 1 or p_qty > 10 then raise exception 'BAD_QUANTITY'; end if;
  if coalesce(trim(p_name), '') = '' or p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'BAD_DETAILS'; end if;

  select * into ev from public.events where id = p_event;
  if not found or not ev.is_published or not ev.registration_open or ev.starts_at < now() then
    raise exception 'REGISTRATION_CLOSED';
  end if;

  select * into tk from public.ticket_types where id = p_ticket and event_id = p_event for update;
  if not found then raise exception 'BAD_TICKET'; end if;

  select coalesce(sum(quantity), 0) into taken from public.registrations
   where ticket_type_id = p_ticket
     and (status in ('free','paid') or (status = 'pending' and created_at > now() - public.pending_hold()));
  if tk.capacity is not null and taken + p_qty > tk.capacity then raise exception 'SOLD_OUT'; end if;

  insert into public.registrations (event_id, ticket_type_id, user_id, name, email, phone, quantity, amount_pence, status)
  values (p_event, p_ticket, p_user, trim(p_name), lower(trim(p_email)), nullif(trim(coalesce(p_phone, '')), ''),
          p_qty, tk.price_pence * p_qty, case when tk.price_pence = 0 then 'free' else 'pending' end)
  returning * into reg;
  return reg;
end;
$$;
revoke all on function public.create_registration(uuid, uuid, int, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.create_registration(uuid, uuid, int, text, text, text, uuid) to service_role;

-- Members can see their own bookings with the event/ticket names
grant select on public.events, public.ticket_types to authenticated;

-- Staff can see who registered for unpublished events too (already covered),
-- and admins can delete registrations made by mistake
drop policy if exists "registrations: admin delete" on public.registrations;
create policy "registrations: admin delete" on public.registrations
  for delete to authenticated using (public.is_admin());
grant delete on public.registrations to authenticated;

-- Admins can see members' email addresses (stored by Supabase Auth)
create or replace view public.member_list
with (security_invoker = false) as
  select p.id, p.full_name, p.phone, p.role, p.status, p.created_at, u.email
  from public.profiles p
  join auth.users u on u.id = p.id
  where public.is_staff();
revoke all on public.member_list from anon;
grant select on public.member_list to authenticated;

-- =====================================================================
-- AFTER you have created your own account on the website (Join page),
-- run this ONE line (with your email) to make yourself the admin:
--
--   update public.profiles set role = 'admin', status = 'approved'
--   where id = (select id from auth.users where email = 'YOUR-EMAIL-HERE');
-- =====================================================================
