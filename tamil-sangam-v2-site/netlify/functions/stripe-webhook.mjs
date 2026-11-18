// POST /.netlify/functions/stripe-webhook — Stripe tells us a payment finished or expired
import { env, json, sb, verifyStripeSignature, sendConfirmation, loadEventAndTicket } from '../lib/shared.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'METHOD_NOT_ALLOWED' });
  const raw = await req.text();
  if (!verifyStripeSignature(raw, req.headers.get('stripe-signature'), env().stripeWebhookSecret)) {
    return json(400, { error: 'BAD_SIGNATURE' });
  }
  const evt = JSON.parse(raw);
  const s = evt.data && evt.data.object;
  const id = s && ((s.metadata && s.metadata.registration_id) || s.client_reference_id);
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return json(200, { ignored: true });

  try {
    if (evt.type === 'checkout.session.completed' || evt.type === 'checkout.session.async_payment_succeeded') {
      if (s.payment_status !== 'paid') return json(200, { waiting: true });
      const rows = await sb(`/rest/v1/registrations?id=eq.${id}&status=in.(pending,cancelled)`, {
        method: 'PATCH', body: { status: 'paid', amount_pence: s.amount_total }, headers: { Prefer: 'return=representation' }
      });
      if (rows && rows[0]) {
        const { event, ticket } = await loadEventAndTicket(rows[0].event_id, rows[0].ticket_type_id);
        try { await sendConfirmation({ reg: rows[0], event, ticket }); } catch (e) { console.error(e); }
      }
    } else if (evt.type === 'checkout.session.expired' || evt.type === 'checkout.session.async_payment_failed') {
      await sb(`/rest/v1/registrations?id=eq.${id}&status=eq.pending`, { method: 'PATCH', body: { status: 'cancelled' }, headers: { Prefer: 'return=minimal' } });
    }
  } catch (err) {
    console.error('webhook error', err.message, err.data);
    return json(500, { error: 'SERVER_ERROR' }); // Stripe will retry
  }
  return json(200, { received: true });
};
