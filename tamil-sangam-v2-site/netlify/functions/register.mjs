// POST /.netlify/functions/register — book a free place, or start a Stripe payment
import { env, json, sb, userFromRequest, stripe, sendConfirmation, loadEventAndTicket } from '../lib/shared.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KNOWN = ['BAD_QUANTITY', 'BAD_DETAILS', 'REGISTRATION_CLOSED', 'BAD_TICKET', 'SOLD_OUT'];

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'METHOD_NOT_ALLOWED' });
  const cfg = env();
  if (!cfg.supabaseUrl || !cfg.supabaseKey) return json(500, { error: 'NOT_CONFIGURED' });

  let b;
  try { b = await req.json(); } catch { return json(400, { error: 'BAD_REQUEST' }); }
  const qty = Number(b.quantity);
  if (!UUID.test(b.event_id || '') || !UUID.test(b.ticket_type_id || '') || !Number.isInteger(qty)) return json(400, { error: 'BAD_REQUEST' });
  const name = String(b.name || '').slice(0, 120), email = String(b.email || '').slice(0, 200), phone = String(b.phone || '').slice(0, 40);

  const user = await userFromRequest(req);

  let reg;
  try {
    const r = await sb('/rest/v1/rpc/create_registration', {
      method: 'POST',
      body: { p_event: b.event_id, p_ticket: b.ticket_type_id, p_qty: qty, p_name: name, p_email: email, p_phone: phone, p_user: user ? user.id : null }
    });
    reg = Array.isArray(r) ? r[0] : r;
  } catch (err) {
    const code = KNOWN.find(c => String(err.message).includes(c));
    if (code) return json(code === 'SOLD_OUT' ? 409 : 400, { error: code });
    console.error('create_registration failed', err.message, err.data);
    return json(500, { error: 'SERVER_ERROR' });
  }

  const { event, ticket } = await loadEventAndTicket(reg.event_id, reg.ticket_type_id);

  if (reg.status === 'free') {
    try { await sendConfirmation({ reg, event, ticket }); } catch (e) { console.error(e); }
    return json(200, { ok: true, status: 'free', reference: reg.id.slice(0, 8).toUpperCase() });
  }

  // Paid ticket → Stripe Checkout
  if (!cfg.stripeKey) {
    await sb(`/rest/v1/registrations?id=eq.${reg.id}`, { method: 'PATCH', body: { status: 'cancelled' }, headers: { Prefer: 'return=minimal' } });
    return json(503, { error: 'PAYMENTS_NOT_SET_UP' });
  }
  try {
    const session = await stripe('checkout/sessions', {
      mode: 'payment',
      customer_email: reg.email,
      client_reference_id: reg.id,
      metadata: { registration_id: reg.id },
      payment_intent_data: { metadata: { registration_id: reg.id } },
      expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
      line_items: [{ quantity: reg.quantity, price_data: { currency: 'gbp', unit_amount: ticket.price_pence, product_data: { name: `${event.title_en} – ${ticket.name_en}` } } }],
      success_url: `${cfg.siteUrl}/booking.html?status=success&e=${encodeURIComponent(event.slug)}`,
      cancel_url: `${cfg.siteUrl}/booking.html?status=cancelled&e=${encodeURIComponent(event.slug)}`
    });
    await sb(`/rest/v1/registrations?id=eq.${reg.id}`, { method: 'PATCH', body: { stripe_session_id: session.id }, headers: { Prefer: 'return=minimal' } });
    return json(200, { ok: true, status: 'pending', checkout_url: session.url });
  } catch (err) {
    console.error(err);
    await sb(`/rest/v1/registrations?id=eq.${reg.id}`, { method: 'PATCH', body: { status: 'cancelled' }, headers: { Prefer: 'return=minimal' } }).catch(() => {});
    return json(502, { error: 'PAYMENT_ERROR' });
  }
};
