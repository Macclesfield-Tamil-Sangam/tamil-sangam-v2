# Macclesfield Tamil Sangam website

**First time? Follow `SETUP.md`.**

## What's inside
| Part | Where |
|---|---|
| Public pages | `index.html`, `about.html`, `events.html`, `event.html?e=<name>`, `past-events.html`, `gallery.html`, `contact.html`, `privacy.html` |
| Members | `join.html`, `login.html`, `account.html` |
| Committee | `admin.html` (events & tickets, photos, bookings & check-in, members) |
| Booking / payments (Node.js) | `netlify/functions/register.mjs`, `netlify/functions/stripe-webhook.mjs` |
| Database setup | `supabase/*.sql` (run in Supabase SQL Editor) |
| Contact details, links, logo, slideshow | `assets/js/config.js` |
| English / Tamil wording | `assets/js/i18n.js` |
| Colours & layout | `assets/css/style.css` |

## Security
- `config.js` holds the **publishable** key — meant to be public; database rules limit what visitors can do.
- The **secret** key, Stripe keys and email key live only in Netlify → Environment variables. Never commit them.
