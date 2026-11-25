/* Member accounts: sign up, log in, log out, password reset (Supabase Auth),
   plus api() for database calls made as the logged-in person. */
(function () {
  const CFG = window.MTS_CONFIG;
  const KEY = 'mts-session';
  const base = CFG.supabaseUrl;
  const keyHeaders = () => {
    const h = { apikey: CFG.supabaseKey };
    if (CFG.supabaseKey.startsWith('eyJ')) h.Authorization = 'Bearer ' + CFG.supabaseKey; // older "anon" keys
    return h;
  };

  let session = null;
  try { session = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
  const save = s => { session = s; try { s ? localStorage.setItem(KEY, JSON.stringify(s)) : localStorage.removeItem(KEY); } catch (e) {} };
  const fromToken = d => ({ access_token: d.access_token, refresh_token: d.refresh_token, expires_at: Math.floor(Date.now() / 1000) + (d.expires_in || 3600), user: d.user });

  async function call(path, opts = {}) {
    const res = await fetch(base + path, {
      method: opts.method || 'GET',
      headers: { 'Content-Type': 'application/json', ...keyHeaders(), ...(opts.headers || {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
    const text = await res.text();
    let data = null; try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
    if (!res.ok) {
      const err = new Error((data && (data.msg || data.message || data.error_description || data.error)) || ('Error ' + res.status));
      err.status = res.status; err.code = data && (data.error_code || data.code); throw err;
    }
    return data;
  }

  /* Links in Supabase emails (confirm account / reset password) come back with tokens in the # */
  let recovery = false;
  (function readHash() {
    const h = new URLSearchParams(location.hash.slice(1));
    if (h.get('access_token')) {
      save({ access_token: h.get('access_token'), refresh_token: h.get('refresh_token'), expires_at: +h.get('expires_at') || Math.floor(Date.now() / 1000) + 3600, user: null });
      recovery = h.get('type') === 'recovery';
      history.replaceState(null, '', location.pathname + location.search);
    } else if (h.get('error_description')) {
      sessionStorage.setItem('mts-auth-error', h.get('error_description'));
      history.replaceState(null, '', location.pathname + location.search);
    }
  })();

  let refreshing = null;
  async function token() {
    if (!session) return null;
    if (session.expires_at - 60 > Date.now() / 1000) return session.access_token;
    if (!refreshing) refreshing = call('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: session.refresh_token } })
      .then(d => { save(fromToken(d)); return session.access_token; })
      .catch(() => { save(null); return null; })
      .finally(() => { refreshing = null; });
    return refreshing;
  }

  /* database call as the logged-in person (falls back to public access) */
  async function api(path, opts = {}) {
    const t = await token();
    const headers = { ...(opts.headers || {}) };
    if (t) headers.Authorization = 'Bearer ' + t;
    return call('/rest/v1/' + path, { ...opts, headers });
  }

  let profileCache = null;
  const Auth = {
    get session() { return session; },
    get recovery() { return recovery; },
    token, api, call,
    async user() {
      const t = await token(); if (!t) return null;
      try { const u = await call('/auth/v1/user', { headers: { Authorization: 'Bearer ' + t } }); session.user = u; save(session); return u; }
      catch (e) { if (e.status === 401 || e.status === 403) save(null); return null; }
    },
    async profile(force) {
      if (profileCache && !force) return profileCache;
      const u = await Auth.user(); if (!u) return (profileCache = null);
      const rows = await api(`profiles?select=*&id=eq.${u.id}`);
      return (profileCache = rows[0] ? { ...rows[0], email: u.email } : { id: u.id, email: u.email, role: 'member', status: 'pending' });
    },
    async signUp(email, password, meta) {
      const redirect = encodeURIComponent(location.origin + '/account.html');
      let d;
      try { d = await call('/auth/v1/signup?redirect_to=' + redirect, { method: 'POST', body: { email, password, data: meta } }); }
      catch (e) {
        if (e.code === 'user_already_exists' || /already (been )?registered|already exists/i.test(e.message)) e.code = 'user_already_exists';
        throw e;
      }
      /* with "Confirm email" on, Supabase hides existing accounts by returning a user with no identities */
      const u = d && (d.user || d);
      if (u && Array.isArray(u.identities) && u.identities.length === 0) throw Object.assign(new Error('User already registered'), { code: 'user_already_exists' });
      if (d && d.access_token) save(fromToken(d));       // email confirmation switched off
      return { needsConfirm: !(d && d.access_token) };
    },
    async signIn(email, password) {
      const d = await call('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } });
      save(fromToken(d)); profileCache = null; return d.user;
    },
    async signOut() {
      const t = await token();
      if (t) { try { await call('/auth/v1/logout', { method: 'POST', headers: { Authorization: 'Bearer ' + t } }); } catch (e) {} }
      save(null); profileCache = null;
    },
    async resetPassword(email) {
      const redirect = encodeURIComponent(location.origin + '/account.html');
      await call('/auth/v1/recover?redirect_to=' + redirect, { method: 'POST', body: { email } });
    },
    async setPassword(password) {
      const t = await token();
      await call('/auth/v1/user', { method: 'PUT', headers: { Authorization: 'Bearer ' + t }, body: { password } });
      recovery = false;
    },
    isStaff: p => !!p && (p.role === 'admin' || p.role === 'editor')
  };
  window.MTS_AUTH = Auth;
})();
