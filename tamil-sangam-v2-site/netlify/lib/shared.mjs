// Shared helpers for the Netlify Functions (server-side Node.js code).
// Secrets come from Netlify → Project configuration → Environment variables.
import crypto from 'node:crypto';

export const env = () => ({
  supabaseUrl: (process.env.SUPABASE_URL || '').replace(/\/$/, ''),
  supabaseKey: process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  stripeKey: process.env.STRIPE_SECRET_KEY || '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  siteUrl: (process.env.SITE_URL || process.env.URL || '').replace(/\/$/, ''),
  resendKey: process.env.RESEND_API_KEY || '',
  emailFrom: process.env.EMAIL_FROM || 'Macclesfield Tamil Sangam <onboarding@resend.dev>'
});

export const json = (status, body) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
});

const keyHeaders = key => {
  const h = { apikey: key };
  if (key.startsWith('eyJ')) h.Authorization = 'Bearer ' + key; // older service_role JWT keys
  return h;
};

// Database call with the secret key (bypasses the public security rules — server only!)
export async function sb(path, { method = 'GET', body, headers = {} } = {}) {
  const { supabaseUrl, supabaseKey } = env();
  const res = await fetch(`${supabaseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...keyHeaders(supabaseKey), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await res.text();
  let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const err = new Error((data && (data.message || data.msg)) || `Supabase ${res.status}`);
    err.status = res.status; err.data = data; throw err;
  }
  return data;
}

// Who is logged in (if anyone), from the browser's access token
export async function userFromRequest(req) {
  const auth = req.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  const { supabaseUrl, supabaseKey } = env();
  const res = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: supabaseKey, Authorization: auth } });
  if (!res.ok) return null;
  const u = await res.json();
  return u && u.id ? u : null;
}

// Stripe REST API (form-encoded), no extra packages needed
export function formEncode(obj, prefix = '', out = []) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object') formEncode(v, key, out);
    else out.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(v)));
  }
  return out.join('&');
}
export async function stripe(path, params) {
  const res = await fetch('https://api.stripe.com/v1/' + path, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + env().stripeKey, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formEncode(params)
  });
  const data = await res.json();
  if (!res.ok) throw new Error('Stripe: ' + (data.error && data.error.message));
  return data;
}

// Check a webhook really came from Stripe (Stripe-Signature header)
export function verifyStripeSignature(rawBody, header, secret, toleranceSec = 300, now = Date.now()) {
  if (!header || !secret) return false;
  const sigs = [];
  let ts = null;
  for (const p of header.split(',')) {
    const [k, v] = p.split('=');
    if (k === 't') ts = Number(v);
    if (k === 'v1') sigs.push(v);
  }
  if (!ts || !sigs.length || Math.abs(now / 1000 - ts) > toleranceSec) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${ts}.${rawBody}`).digest('hex');
  return sigs.some(s => s.length === expected.length && crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected)));
}

// Confirmation email (sent only if RESEND_API_KEY is set)
const escHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export async function sendConfirmation({ reg, event, ticket }) {
  const { resendKey, emailFrom, siteUrl } = env();
  if (!resendKey) return false;
  const when = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(event.starts_at));
  const paid = reg.amount_pence > 0;
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#2a1a14">
    <h2 style="color:#7a1e2c">வணக்கம் ${escHtml(reg.name)}!</h2>
    <p>${paid ? 'Thank you — your payment was received and your booking is confirmed.' : 'Thank you — you are registered.'}</p>
    <table style="border-collapse:collapse;width:100%;margin:16px 0">
      <tr><td style="padding:6px 0;color:#6d5a50">Event</td><td><b>${escHtml(event.title_en)}</b></td></tr>
      <tr><td style="padding:6px 0;color:#6d5a50">When</td><td>${escHtml(when)}</td></tr>
      ${event.venue ? `<tr><td style="padding:6px 0;color:#6d5a50">Where</td><td>${escHtml(event.venue)}</td></tr>` : ''}
      <tr><td style="padding:6px 0;color:#6d5a50">Tickets</td><td>${reg.quantity} × ${escHtml(ticket.name_en)}</td></tr>
      ${paid ? `<tr><td style="padding:6px 0;color:#6d5a50">Paid</td><td>£${(reg.amount_pence / 100).toFixed(2)}</td></tr>` : ''}
      <tr><td style="padding:6px 0;color:#6d5a50">Reference</td><td>${escHtml(reg.id.slice(0, 8).toUpperCase())}</td></tr>
    </table>
    <p>Please show this email (or just give your name) at the door.</p>
    <p><a href="${siteUrl}/event.html?e=${encodeURIComponent(event.slug)}" style="color:#7a1e2c">Event details</a></p>
    <p style="color:#6d5a50;font-size:13px">Macclesfield Tamil Sangam · மெக்கல்ஸ்ஃபீல்ட் தமிழ்ச் சங்கம்</p></div>`;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + resendKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: emailFrom, to: [reg.email], subject: `Booking confirmed: ${event.title_en}`, html })
  });
  if (!res.ok) console.error('Email failed', res.status, await res.text());
  return res.ok;
}

export async function loadEventAndTicket(eventId, ticketId) {
  const [ev] = await sb(`/rest/v1/events?select=id,slug,title_en,title_ta,starts_at,venue&id=eq.${eventId}`);
  const [tk] = await sb(`/rest/v1/ticket_types?select=id,name_en,name_ta,price_pence&id=eq.${ticketId}`);
  return { event: ev, ticket: tk };
}
