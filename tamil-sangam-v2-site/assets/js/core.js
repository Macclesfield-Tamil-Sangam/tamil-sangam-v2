/* Shared code for every page: language, header/footer, database, helpers. */
(function () {
  const CFG = window.MTS_CONFIG, TEXT = window.TEXT;

  /* ---------- language ---------- */
  let lang = 'en';
  try {
    const saved = localStorage.getItem('mts-lang');
    if (saved === 'en' || saved === 'ta') lang = saved;
    else if ((navigator.language || '').toLowerCase().startsWith('ta')) lang = 'ta';
  } catch (e) {}
  const L = v => (v && typeof v === 'object' && !Array.isArray(v)) ? (v[lang] ?? v.en) : v;
  const O = v => (v && typeof v === 'object') ? (v[lang === 'en' ? 'ta' : 'en'] ?? '') : '';
  const t = k => L(TEXT[k]) ?? k;
  /* pick a database field in the current language, e.g. tr(row,'title') → title_ta or title_en */
  const tr = (row, field) => (lang === 'ta' && row[field + '_ta']) ? row[field + '_ta'] : (row[field + '_en'] || '');

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  /* ---------- dates (always shown in UK time) ---------- */
  const locale = () => lang === 'ta' ? 'ta-IN' : 'en-GB';
  const fmt = (iso, opts) => new Intl.DateTimeFormat(locale(), { timeZone: 'Europe/London', ...opts }).format(new Date(iso));
  const fmtDate = iso => fmt(iso, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
  const fmtMonthYear = iso => fmt(iso, { month: 'long', year: 'numeric' });
  const fmtTime = iso => fmt(iso, { hour: 'numeric', minute: '2-digit' });
  const fmtDay = iso => fmt(iso, { day: 'numeric' });
  const fmtMon = iso => fmt(iso, { month: 'short' });
  const yearOf = iso => +fmt(iso, { year: 'numeric' }).replace(/\D/g, '');
  const money = pence => pence ? '£' + (pence / 100).toFixed(pence % 100 ? 2 : 0) : t('free');

  /* ---------- database (Supabase REST API, read-only public data) ---------- */
  async function db(path) {
    const res = await fetch(`${CFG.supabaseUrl}/rest/v1/${path}`, { headers: { apikey: CFG.supabaseKey } });
    if (!res.ok) throw new Error(`Database error ${res.status}: ${await res.text()}`);
    return res.json();
  }
  const photoUrl = p => !p ? '' : /^https?:\/\//.test(p) ? p : `${CFG.supabaseUrl}/storage/v1/object/public/photos/${p.split('/').map(encodeURIComponent).join('/')}`;

  /* ---------- YouTube videos ---------- */
  const ytId = url => {
    const m = String(url || '').match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([A-Za-z0-9_-]{11})/);
    return m ? m[1] : null;
  };
  const videoEmbeds = (urls, title) => {
    const ids = (urls || []).map(ytId).filter(Boolean);
    if (!ids.length) return '';
    return `<div class="video-grid">${ids.map(id => `<div class="video"><iframe src="https://www.youtube-nocookie.com/embed/${id}" title="${esc(title || 'Video')}" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`).join('')}</div>`;
  };

  /* ---------- icons ---------- */
  const ICON = {
    phone: '<svg viewBox="0 0 24 24"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1z"/></svg>',
    mail: '<svg viewBox="0 0 24 24"><path d="M20 4H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 4-8 5-8-5V6l8 5 8-5z"/></svg>',
    wa: '<svg viewBox="0 0 24 24"><path d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1l-.9 1.2c-.2.2-.3.2-.6.1a8 8 0 0 1-4-3.5c-.3-.5.3-.5.9-1.6.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.2.2 2.1 3.2 5.1 4.5 1.9.8 2.6.9 3.6.7.6-.1 1.8-.7 2-1.4.3-.7.3-1.3.2-1.4l-.8-.5zM12 2a10 10 0 0 0-8.6 15l-1.4 5 5.2-1.4A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.2-1.2l-.3-.2-3.1.8.8-3-.2-.3A8.2 8.2 0 1 1 12 20.2z"/></svg>',
    fb: '<svg viewBox="0 0 24 24"><path d="M14 8h3V4h-3c-2.8 0-4.5 1.8-4.5 4.6V11H7v4h2.5v9h4v-9h3l.5-4h-3.5V8.8c0-.5.3-.8.5-.8z"/></svg>',
    x: '<svg viewBox="0 0 24 24"><path d="M17.8 3h3.3l-7.2 8.2L22.4 21h-6.6l-5.2-6.8L4.7 21H1.4l7.7-8.8L1 3h6.8l4.7 6.2zm-1.2 16h1.8L7.5 4.9H5.6z"/></svg>',
    ig: '<svg viewBox="0 0 24 24"><path d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 8.2a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4zM17.3 5.5a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4zM21.9 7.1c-.1-1.6-.4-3-1.6-4.2S17.6 1.3 16 1.2C14.3 1.1 9.7 1.1 8 1.2c-1.6.1-3 .4-4.2 1.6S2.2 5.5 2.1 7.1C2 8.8 2 13.4 2.1 15.1c.1 1.6.4 3 1.6 4.2s2.6 1.5 4.2 1.6c1.7.1 6.3.1 8 0 1.6-.1 3-.4 4.2-1.6s1.5-2.6 1.6-4.2c.2-1.7.2-6.3.2-8zM19.8 18a3.3 3.3 0 0 1-1.8 1.8c-1.3.5-4.3.4-5.9.4s-4.6.1-5.9-.4A3.3 3.3 0 0 1 4.4 18c-.5-1.3-.4-4.3-.4-5.9s-.1-4.6.4-5.9A3.3 3.3 0 0 1 6.2 4.4c1.3-.5 4.3-.4 5.9-.4s4.6-.1 5.9.4c.8.3 1.5 1 1.8 1.8.5 1.3.4 4.3.4 5.9s.1 4.6-.4 5.9z"/></svg>',
    yt: '<svg viewBox="0 0 24 24"><path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12a31 31 0 0 0 .5 4.8 3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1c.4-1.6.5-3.2.5-4.8s-.1-3.2-.5-4.8zM9.8 15V9l5.7 3z"/></svg>'
  };
  const KOLAM = '<svg class="kolam" viewBox="0 0 200 200" fill="none" stroke="#fff" stroke-width="2" aria-hidden="true"><circle cx="100" cy="100" r="90"/><circle cx="100" cy="100" r="60"/><path d="M100 10 Q130 70 190 100 Q130 130 100 190 Q70 130 10 100 Q70 70 100 10Z"/><path d="M36 36 Q100 80 164 36 Q120 100 164 164 Q100 120 36 164 Q80 100 36 36Z"/><g fill="#fff">' +
    [...Array(5)].map((_, i) => [...Array(5)].map((_, j) => `<circle cx="${40 + i * 30}" cy="${40 + j * 30}" r="3"/>`).join('')).join('') + '</g></svg>';

  /* contact channels — only the ones filled in config.js are shown */
  const channels = () => {
    const wa = CFG.whatsapp ? 'https://wa.me/' + CFG.whatsapp : '';
    return [
      { k: 'phone', cls: 'c-phone', label: t('callUs'), sub: CFG.phone, url: CFG.phone ? 'tel:' + CFG.phone.replace(/\s/g, '') : '' },
      { k: 'mail', cls: 'c-mail', label: t('emailUs'), sub: CFG.email, url: CFG.email ? 'mailto:' + CFG.email : '' },
      { k: 'wa', cls: 'c-wa', label: t('whatsapp'), sub: t('chatUs'), url: wa },
      { k: 'fb', cls: 'c-fb', label: t('facebook'), sub: t('fbSub'), url: CFG.facebook },
      { k: 'x', cls: 'c-x', label: t('twitter'), sub: t('xSub'), url: CFG.twitter },
      { k: 'ig', cls: 'c-ig', label: t('instagram'), sub: t('igSub'), url: CFG.instagram },
      { k: 'yt', cls: 'c-yt', label: t('youtube'), sub: t('ytSub'), url: CFG.youtube }
    ].filter(c => c.url);
  };
  const ext = url => /^https?:/.test(url) ? ' target="_blank" rel="noopener"' : '';
  const socialIcons = () => channels().map(c => `<a href="${esc(c.url)}"${ext(c.url)} aria-label="${esc(c.label)}" title="${esc(c.label)}">${ICON[c.k]}</a>`).join('');

  /* ---------- header & footer ---------- */
  const NAV = [['/', 'home'], ['/about.html', 'about'], ['/events.html', 'events'], ['/past-events.html', 'memories'], ['/contact.html', 'contact']];
  const page = (location.pathname.split('/').pop() || 'index').replace(/\.html$/, '');
  const isHere = href => { const h = (href.split('/').pop() || 'index').replace(/\.html$/, ''); return h === page || (page === 'event' && h === 'events') || (page === 'gallery' && h === 'past-events'); };

  function renderChrome() {
    const top = $('#site-header'), foot = $('#site-footer');
    const contactBits = [CFG.phone && `<a href="tel:${esc(CFG.phone.replace(/\s/g, ''))}">📞 ${esc(CFG.phone)}</a>`, CFG.email && `<a href="mailto:${esc(CFG.email)}">✉️ ${esc(CFG.email)}</a>`].filter(Boolean).join('');
    const social = socialIcons();
    if (top) top.innerHTML = `
      ${contactBits || social ? `<div class="topbar"><div class="wrap"><div class="contact">${contactBits}</div><div class="social">${social}</div></div></div>` : ''}
      <header><div class="wrap"><nav>
        <a href="/" class="brand">
          <img class="logo" src="${esc(CFG.logo)}" alt="" width="50" height="50">
          <div style="min-width:0"><b>${esc(L(CFG.name))}</b><small>${esc(O(CFG.name))}</small></div>
        </a>
        <div class="nav-right">
          <ul class="menu" id="menu">${NAV.map(([h, k]) => `<li><a href="${h}"${isHere(h) ? ' class="active" aria-current="page"' : ''}>${t(k)}</a></li>`).join('')}</ul>
          ${window.MTS_AUTH ? `<a class="acct-btn" id="acctBtn" href="${window.MTS_AUTH.session ? '/account.html' : '/login.html'}">${window.MTS_AUTH.session ? t('myAccount') : t('logIn')}</a>` : ''}
          <div class="lang" role="group" aria-label="Language / மொழி">
            <button data-lang="en"${lang === 'en' ? ' class="on"' : ''}>EN</button>
            <button data-lang="ta"${lang === 'ta' ? ' class="on"' : ''}>தமிழ்</button>
          </div>
          <button class="burger" aria-label="${t('openMenu')}" aria-expanded="false" aria-controls="menu"><span></span><span></span><span></span></button>
        </div>
      </nav></div></header>`;
    if (foot) foot.innerHTML = `
      <footer><div class="wrap">
        <div class="f-grid">
          <div>
            <img src="${esc(CFG.logo)}" alt="" width="64" height="64" style="margin-bottom:14px;border-radius:50%">
            <h4>${esc(L(CFG.name))}</h4>
            <p class="tamil" style="margin-bottom:10px;opacity:.85">${esc(O(CFG.name))}</p>
            <p style="opacity:.8;font-size:.92rem">${esc(L(CFG.address))}</p>
          </div>
          <div><h4>${t('menu')}</h4><ul>${NAV.map(([h, k]) => `<li><a href="${h}">${t(k)}</a></li>`).join('')}${window.MTS_AUTH ? `<li><a href="/join.html">${t('join')}</a></li><li><a href="/privacy.html">${t('privacy')}</a></li>` : ''}</ul></div>
          <div>${social ? `<h4>${t('followUs')}</h4><div class="social">${social}</div>` : ''}
            ${contactBits ? `<ul style="margin-top:14px">${contactBits.replace(/<a /g, '<li><a ').replace(/<\/a>/g, '</a></li>')}</ul>` : ''}</div>
        </div>
        <div class="copy">© ${new Date().getFullYear()} ${esc(L(CFG.name))}. ${t('madeBy')}${CFG.photoCredit ? '<br>' + esc(CFG.photoCredit) : ''}</div>
      </div></footer>
      ${CFG.whatsapp ? `<a class="wa-float" href="https://wa.me/${esc(CFG.whatsapp)}" target="_blank" rel="noopener" aria-label="WhatsApp">${ICON.wa}</a>` : ''}`;

    $$('.lang button').forEach(b => b.onclick = () => setLang(b.dataset.lang));
    /* show an Admin link to committee members */
    if (window.MTS_AUTH && window.MTS_AUTH.session) {
      window.MTS_AUTH.profile().then(p => {
        if (window.MTS_AUTH.isStaff(p) && !$('#adminLink')) $('#menu').insertAdjacentHTML('beforeend', `<li><a id="adminLink" href="/admin.html"${page === 'admin' ? ' class="active"' : ''}>⚙ ${t('admin')}</a></li>`);
        if (!p) { const b = $('#acctBtn'); if (b) { b.href = '/login.html'; b.textContent = t('logIn'); } }
      }).catch(() => {});
    }
    const burger = $('.burger');
    if (burger) burger.onclick = () => { const open = $('#menu').classList.toggle('open'); burger.setAttribute('aria-expanded', open); };
  }

  /* static text marked with data-t="key" */
  function renderStatic() {
    document.documentElement.lang = lang;
    $$('[data-t]').forEach(el => el.textContent = t(el.dataset.t));
    $$('[data-t-placeholder]').forEach(el => el.placeholder = t(el.dataset.tPlaceholder));
  }

  const listeners = [];
  function onLang(fn) { listeners.push(fn); }
  function setLang(l) {
    if (l === lang) return;
    lang = l;
    try { localStorage.setItem('mts-lang', l); } catch (e) {}
    document.body.classList.add('switching');
    setTimeout(() => { renderAll(); document.body.classList.remove('switching'); }, 160);
  }
  function renderAll() {
    renderChrome(); renderStatic();
    const title = document.body.dataset.title;
    document.title = (title ? t(title) + ' | ' : '') + L(CFG.name);
    listeners.forEach(fn => fn());
  }

  /* ---------- shared UI pieces ---------- */
  const loadingBox = () => `<div class="state"><div class="spinner"></div>${t('loading')}</div>`;
  const errorBox = () => `<div class="state error">${t('loadError')}</div>`;

  function eventCard(e, opts = {}) {
    const href = `/event.html?e=${encodeURIComponent(e.slug)}`;
    const count = e.photo_count || 0;
    const cover = e.cover_url ? photoUrl(e.cover_url) : (e.first_photo ? photoUrl(e.first_photo) : '');
    return `<article class="ev">
      <a class="cover" href="${href}" tabindex="-1" aria-hidden="true">
        ${cover ? `<img src="${esc(cover)}" alt="" loading="lazy">` : `<div class="ph"><div><span>${opts.upcoming ? '🪔' : '📷'}</span>${opts.upcoming ? '' : t('photosSoon')}</div></div>`}
        ${opts.upcoming ? `<div class="datebadge"><b>${fmtDay(e.starts_at)}</b>${fmtMon(e.starts_at)}</div>` : ''}
        ${count ? `<span class="count">📷 ${count} ${t('photos')}</span>` : ''}
      </a>
      <div class="body">
        <div class="meta">${opts.upcoming ? fmtDate(e.starts_at) + ' · ' + fmtTime(e.starts_at) : fmtMonthYear(e.starts_at)}${e.venue ? ' · ' + esc(e.venue) : ''}</div>
        <h3><a href="${href}">${esc(tr(e, 'title'))}</a></h3>
        <p>${esc(tr(e, 'description'))}</p>
        <a class="view" href="${href}">${t('details')}</a>
      </div>
    </article>`;
  }

  /* ---------- photo lightbox ---------- */
  let lbList = [], lbI = 0;
  function ensureLightbox() {
    if ($('#lb')) return;
    document.body.insertAdjacentHTML('beforeend', `<div class="lb" id="lb" role="dialog" aria-modal="true">
      <button class="x" aria-label="Close">×</button>
      <button class="arrow prev" aria-label="Previous">‹</button>
      <img id="lbImg" alt=""><button class="arrow next" aria-label="Next">›</button>
      <div class="cap" id="lbCap"></div></div>`);
    const lb = $('#lb');
    $('.x', lb).onclick = closeLightbox;
    $('.prev', lb).onclick = () => showLb(lbI - 1);
    $('.next', lb).onclick = () => showLb(lbI + 1);
    lb.addEventListener('click', e => { if (e.target === lb) closeLightbox(); });
    document.addEventListener('keydown', e => {
      if (!lb.classList.contains('open')) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') showLb(lbI + 1);
      if (e.key === 'ArrowLeft') showLb(lbI - 1);
    });
  }
  function showLb(i) {
    const n = lbList.length; lbI = (i + n) % n;
    const p = lbList[lbI];
    $('#lbImg').src = p.src; $('#lbImg').alt = p.caption || '';
    $('#lbCap').textContent = `${p.caption ? p.caption + ' · ' : ''}${lbI + 1} / ${n}`;
  }
  function openLightbox(list, i) { ensureLightbox(); lbList = list; $('#lb').classList.add('open'); showLb(i); }
  function closeLightbox() { $('#lb').classList.remove('open'); }

  /* ---------- show / hide password (eye button) ---------- */
  const EYE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5C6.5 5 2.7 9.1 1.5 12c1.2 2.9 5 7 10.5 7s9.3-4.1 10.5-7C21.3 9.1 17.5 5 12 5zm0 11.5A4.5 4.5 0 1 1 12 7.5a4.5 4.5 0 0 1 0 9zm0-7a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z"/></svg>';
  const EYE_OFF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.3 2.3 2 3.6l3.2 3.2C3.4 8.3 2.1 10.2 1.5 12c1.2 2.9 5 7 10.5 7 2 0 3.8-.5 5.3-1.4l3.1 3.1 1.3-1.3L3.3 2.3zM12 16.5A4.5 4.5 0 0 1 7.5 12c0-.8.2-1.5.5-2.1l1.5 1.5a2.5 2.5 0 0 0 3.1 3.1l1.5 1.5c-.6.3-1.3.5-2.1.5zm0-11.5c5.5 0 9.3 4.1 10.5 7-.5 1.3-1.5 2.8-2.8 4.1l-3.2-3.2c.2-.6.3-1.2.3-1.9A4.5 4.5 0 0 0 12 7.5c-.7 0-1.3.1-1.9.3L7.9 5.6C9.2 5.2 10.5 5 12 5z"/></svg>';
  function enhancePasswords(root = document) {
    root.querySelectorAll('input[type="password"]:not([data-eye])').forEach(inp => {
      inp.dataset.eye = '1';
      const wrap = document.createElement('div'); wrap.className = 'pw-wrap';
      inp.parentNode.insertBefore(wrap, inp); wrap.appendChild(inp);
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'pw-eye';
      const set = shown => { inp.type = shown ? 'text' : 'password'; btn.innerHTML = shown ? EYE_OFF : EYE; btn.setAttribute('aria-label', t(shown ? 'hidePassword' : 'showPassword')); btn.setAttribute('aria-pressed', shown); };
      btn.onclick = () => { set(inp.type === 'password'); inp.focus(); };
      set(false); wrap.appendChild(btn);
    });
  }
  document.addEventListener('DOMContentLoaded', () => {
    enhancePasswords();
    new MutationObserver(() => enhancePasswords()).observe(document.body, { childList: true, subtree: true });
  });

  window.MTS = { ytId, videoEmbeds, CFG, L, O, t, tr, esc, $, $$, db, photoUrl, fmtDate, fmtMonthYear, fmtTime, yearOf, money, ICON, KOLAM, channels, ext, onLang, renderAll, loadingBox, errorBox, eventCard, openLightbox, get lang() { return lang; } };
  document.addEventListener('DOMContentLoaded', renderAll);
})();
