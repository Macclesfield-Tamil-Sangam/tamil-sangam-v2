-- =====================================================================
-- Macclesfield Tamil Sangam — step 3: booking window (opens / closes dates)
-- Run AFTER 02. Supabase → SQL Editor → New query → paste → Run. Safe to re-run.
-- =====================================================================
alter table public.events add column if not exists booking_opens_at  timestamptz;
alter table public.events add column if not exists booking_closes_at timestamptz;

-- Bookings are accepted only when: "Booking open" is ticked, the event hasn't started,
-- and today is between "Booking opens" and "Booking closes" (blank = no limit).
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
  if not found or not ev.is_published or not ev.registration_open or ev.starts_at < now()
     or (ev.booking_closes_at is not null and now() > ev.booking_closes_at) then
    raise exception 'REGISTRATION_CLOSED';
  end if;
  if ev.booking_opens_at is not null and now() < ev.booking_opens_at then
    raise exception 'BOOKING_NOT_OPEN';
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

notify pgrst, 'reload schema';
