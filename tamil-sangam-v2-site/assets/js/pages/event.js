/* Event detail page: /event.html?e=<slug> */
(function () {
  const { t, tr, esc, $, db, photoUrl, fmtDate, fmtTime, money, onLang, loadingBox, errorBox, openLightbox } = MTS;
  const slug = new URLSearchParams(location.search).get('e') || decodeURIComponent(location.hash.slice(1));
  let ev = null, tickets = [], avail = {}, photos = [], state = 'loading', me = {};

  function render() {
    const box = $('#detail');
    $('#crumb').textContent = t('back');
    if (state === 'loading') { box.innerHTML = loadingBox(); return; }
    if (state === 'error') { box.innerHTML = errorBox(); return; }
    if (state === 'missing') {
      $('#evTitle').textContent = t('notFound');
      $('#evWhen').textContent = '';
      box.innerHTML = `<p class="center"><a class="btn" href="/events.html">${t('events')}</a></p>`;
      return;
    }
    const isPast = new Date(ev.ends_at || ev.starts_at) < new Date();
    $('#crumb').href = isPast ? '/past-events.html' : '/events.html';
    $('#evTitle').textContent = tr(ev, 'title');
    $('#evWhen').textContent = fmtDate(ev.starts_at) + (ev.venue ? ' · ' + ev.venue : '');
    document.title = tr(ev, 'title') + ' | ' + MTS.L(MTS.CFG.name);

    const cover = ev.cover_url ? photoUrl(ev.cover_url) : (photos[0] ? photoUrl(photos[0].storage_path) : '');
    const timeStr = fmtTime(ev.starts_at) + (ev.ends_at ? ' – ' + fmtTime(ev.ends_at) : '');

    let ticketHtml = '';
    if (!isPast) {
      ticketHtml = tickets.length ? `<h3 style="margin-top:6px">${t('tickets')}</h3>` + tickets.map(tk => {
        const a = avail[tk.id], soldOut = a && a.remaining === 0;
        return `<div class="ticket"><div>${esc(tr(tk, 'name'))}${a && a.remaining != null && !soldOut ? `<small>${a.remaining} ${t('left')}</small>` : ''}</div>
          <b>${soldOut ? t('soldOut') : money(tk.price_pence)}</b></div>`;
      }).join('') : '';
      const nowIso = new Date().toISOString();
      const notYet = ev.booking_opens_at && ev.booking_opens_at > nowIso;
      const closedEarly = ev.booking_closes_at && ev.booking_closes_at < nowIso;
      const open = ev.registration_open && tickets.length && window.MTS_AUTH && !notYet && !closedEarly;
      const avail1 = tickets.filter(tk => !(avail[tk.id] && avail[tk.id].remaining === 0));
      if (open && avail1.length) {
        ticketHtml += `<form class="book-form" id="bookForm" novalidate>
          <h3 style="margin-top:18px">${t('bookTitle')}</h3>
          ${ev.booking_closes_at ? `<p class="note" style="margin:0 0 12px">⏳ ${t('bookingClosesOn')} ${fmtDate(ev.booking_closes_at)}, ${fmtTime(ev.booking_closes_at)}</p>` : ''}
          <div class="row">
            <div><label for="bt">${t('ticketType')}</label><select id="bt">${avail1.map(tk => `<option value="${tk.id}">${esc(tr(tk, 'name'))} — ${money(tk.price_pence)}</option>`).join('')}</select></div>
            <div><label for="bq">${t('quantity')}</label><select id="bq">${[1,2,3,4,5,6,7,8,9,10].map(n => `<option>${n}</option>`).join('')}</select></div>
          </div>
          <label for="bn">${t('fName')}</label><input id="bn" required autocomplete="name" value="${esc(me.full_name || '')}">
          <label for="be">${t('fEmail')}</label><input id="be" type="email" required autocomplete="email" value="${esc(me.email || '')}">
          <label for="bp">${t('fPhone')}</label><input id="bp" type="tel" autocomplete="tel" value="${esc(me.phone || '')}">
          <div class="total"><span>${t('total')}</span><span id="btotal"></span></div>
          <button class="btn" type="submit" id="bbtn"></button>
          <div class="form-msg hidden" id="bmsg" role="status"></div>
          <p class="note" id="bsecure" style="margin-top:10px">🔒 ${t('securePay')}</p>
        </form>`;
      } else if (ev.registration_open && tickets.length && notYet) {
        ticketHtml += `<div class="note">📅 ${t('bookingOpensOn')} ${fmtDate(ev.booking_opens_at)}, ${fmtTime(ev.booking_opens_at)}</div>`;
      } else if (ev.registration_open && tickets.length && closedEarly) {
        ticketHtml += `<div class="note">${t('closedMsg')} <a class="link" href="/contact.html">${t('contact')} →</a></div>`;
      } else if (!(ev.registration_open && tickets.length)) {
        ticketHtml += `<div class="note">${t('regClosed')} <a class="link" href="/contact.html">${t('contact')} →</a></div>`;
      }
    } else {
      ticketHtml = `<div class="note ok">${t('pastEventNote')}</div>`;
    }

    box.innerHTML = `<div class="ev-detail">
      <div>
        ${cover ? `<div class="hero-img"><img src="${esc(cover)}" alt=""></div>` : ''}
        <p class="desc">${esc(tr(ev, 'description'))}</p>
        ${photos.length ? `<h2 class="sec-title" style="font-size:1.6rem;margin-top:36px">${t('eventPhotos')}</h2>
          <div class="gal-grid" id="evPhotos">${photos.map((p, i) => `<button data-i="${i}" aria-label="${t('eventPhotos')} ${i + 1}"><img src="${esc(photoUrl(p.storage_path))}" alt="${esc(tr(p, 'caption'))}" loading="lazy"></button>`).join('')}</div>` : ''}
      </div>
      <aside class="panel">
        <ul class="facts">
          <li><span>📅</span><div><small>${t('date')}</small>${fmtDate(ev.starts_at)}</div></li>
          <li><span>🕕</span><div><small>${t('time')}</small>${timeStr}</div></li>
          ${ev.venue ? `<li><span>📍</span><div><small>${t('venue')}</small>${esc(ev.venue)}</div></li>` : ''}
        </ul>
        ${ticketHtml}
      </aside>
    </div>`;

    const bf = $('#bookForm');
    if (bf) {
      const upd = () => {
        const tk = tickets.find(x => x.id === $('#bt').value), q = +$('#bq').value, amt = tk.price_pence * q;
        $('#btotal').textContent = money(amt);
        $('#bbtn').textContent = amt ? t('bookPay') + ' · ' + money(amt) : t('bookFree');
        $('#bsecure').classList.toggle('hidden', !amt);
      };
      $('#bt').onchange = upd; $('#bq').onchange = upd; upd();
      bf.onsubmit = async e => {
        e.preventDefault();
        const msg = $('#bmsg'), btn = $('#bbtn');
        const show = (txt, ok) => { msg.textContent = txt; msg.className = 'form-msg ' + (ok ? 'ok' : 'err'); };
        const body = { event_id: ev.id, ticket_type_id: $('#bt').value, quantity: +$('#bq').value, name: $('#bn').value.trim(), email: $('#be').value.trim(), phone: $('#bp').value.trim(), lang: MTS.lang };
        if (!body.name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email)) return show(t('fError'));
        btn.disabled = true; const label = btn.textContent; btn.textContent = t('booking');
        try {
          const headers = { 'Content-Type': 'application/json' };
          const tok = await MTS_AUTH.token(); if (tok) headers.Authorization = 'Bearer ' + tok;
          const res = await fetch('/.netlify/functions/register', { method: 'POST', headers, body: JSON.stringify(body) });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw Object.assign(new Error(data.error || 'error'), { code: data.error });
          if (data.checkout_url) { location.href = data.checkout_url; return; }
          bf.querySelectorAll('input,select,button').forEach(el => el.disabled = true);
          show(t('bookedFree'), true);
          btn.textContent = label;
        } catch (err) {
          console.error(err);
          show(err.code === 'SOLD_OUT' ? t('soldOutMsg') : err.code === 'REGISTRATION_CLOSED' ? t('closedMsg') : err.code === 'BOOKING_NOT_OPEN' ? t('notOpenMsg') : t('fError'));
          btn.disabled = false; btn.textContent = label;
        }
      };
    }

    const list = photos.map(p => ({ src: photoUrl(p.storage_path), caption: tr(p, 'caption') }));
    document.querySelectorAll('#evPhotos button').forEach(b => b.onclick = () => openLightbox(list, +b.dataset.i));
  }
  onLang(render);

  if (!slug) { state = 'missing'; }
  else {
    db(`events?select=*&slug=eq.${encodeURIComponent(slug)}&is_published=eq.true&limit=1`)
      .then(async rows => {
        if (!rows.length) { state = 'missing'; return render(); }
        ev = rows[0];
        const [tk, av, ph] = await Promise.all([
          db(`ticket_types?select=*&event_id=eq.${ev.id}&order=sort.asc`),
          db(`ticket_availability?select=*&event_id=eq.${ev.id}`),
          db(`photos?select=*&event_id=eq.${ev.id}&order=sort.asc,created_at.asc`)
        ]);
        tickets = tk; photos = ph; av.forEach(a => avail[a.ticket_type_id] = a);
        if (window.MTS_AUTH && MTS_AUTH.session) { try { me = (await MTS_AUTH.profile()) || {}; } catch (e) {} }
        state = 'ok'; render();
      })
      .catch(err => { console.error(err); state = 'error'; render(); });
  }
})();
