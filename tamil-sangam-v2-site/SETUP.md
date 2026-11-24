# Tamil Sangam website — setup guide (one time)

Do these in order. Each step says where to click.

## 1. Upload the site
1. GitHub → new repository `tamil-sangam-v2` → upload everything in this folder (keep the folders) → **Commit changes**.
2. Netlify → **Add new project → Import from GitHub** → pick `tamil-sangam-v2` → **Deploy**.
3. Netlify → the project → **Forms → Enable form detection**.
4. Note your site address, e.g. `https://tamil-sangam-v2.netlify.app`.

## 2. Database (Supabase)
1. Supabase → **SQL Editor → New query** → paste `supabase/02_members_and_tickets.sql` → **Run**.
   (`01_setup.sql` was already run earlier.)
   Then run `supabase/03_booking_window.sql` the same way (adds booking opens / closes dates).
2. Supabase → **Authentication → URL Configuration**:
   - **Site URL:** your site address (step 1.4)
   - **Redirect URLs:** add `https://YOUR-SITE/**` (and later `https://macclesfieldtamilsangam.org.uk/**`)
   This makes the "confirm your email" and "reset password" links come back to the website.

## 3. Connect Netlify to the database (secret key)
1. Supabase → **Project Settings → API Keys** → copy the **secret** key (starts `sb_secret_`).
   Never paste it into GitHub, chat or the website files.
2. Netlify → the project → **Project configuration → Environment variables → Add a variable**:
   | Key | Value |
   |---|---|
   | `SUPABASE_URL` | `https://jionzadqkgvktpppfejb.supabase.co` |
   | `SUPABASE_SECRET_KEY` | the secret key |
   | `SITE_URL` | your site address (no `/` at the end) |
3. Netlify → **Deploys → Trigger deploy → Deploy site** (so the new settings are used).

Free events can now be booked.

## 4. Make yourself admin
1. On the website click **Join**, create your account, and click the link in the confirmation email.
2. Supabase → **SQL Editor** → run (with your email):
   ```sql
   update public.profiles set role = 'admin', status = 'approved'
   where id = (select id from auth.users where email = 'YOUR-EMAIL');
   ```
3. Log in on the website → **⚙ Admin** appears in the menu.
   To give a helper access: Admin → Members → set their role to **editor** (events, photos, bookings) or **admin** (everything).

## 5. Paid tickets (Stripe) — when the Sangam's Stripe account is ready
The Stripe account must be in the Sangam's name with the Sangam's bank account.
1. Stripe → **Developers → API keys** → copy the **Secret key** (`sk_test_…` while testing, `sk_live_…` for real).
2. Stripe → **Developers → Webhooks → Add endpoint**:
   - URL: `https://YOUR-SITE/.netlify/functions/stripe-webhook`
   - Events: `checkout.session.completed`, `checkout.session.expired`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`
   - Copy the **Signing secret** (`whsec_…`).
3. Netlify environment variables: `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` → **Trigger deploy**.
4. Test with a test key and card `4242 4242 4242 4242`, any future date, any CVC. Then switch to the live key and live webhook secret.

Until this is done, paid tickets show "Sorry, something went wrong" — free tickets work.

## 6. Confirmation emails (optional)
1. Create a free account at resend.com and verify a domain the Sangam owns (e.g. `mtauk.org`) — Resend shows the DNS records to add in GoDaddy.
2. Netlify environment variables: `RESEND_API_KEY` and `EMAIL_FROM` (e.g. `Macclesfield Tamil Sangam <events@mtauk.org>`) → **Trigger deploy**.

Note: Supabase's built-in account emails (confirm / reset password) are limited to a few per hour on the free plan.
For more, add your own email service under Supabase → **Authentication → Emails → SMTP Settings** (Resend works here too).

## Everyday use
- **Add an event:** Admin → Events & tickets → **+ New event** → fill in, add ticket types, tick *Published* and *Booking open* → Save.
- **Photos:** Admin → Photos → pick the event → choose or drag photos.
- **On the day:** Admin → Bookings → tick **Here** as people arrive. **Download list (CSV)** for a printed copy.
- **New members:** Admin → Members → **Approve**.
- **Refunds:** refund in the Stripe dashboard, then Admin → Bookings → *Mark refunded*.
- **Contact messages:** Netlify → the project → **Forms**.
- **Phone, email, social links:** edit `assets/js/config.js` on GitHub.
