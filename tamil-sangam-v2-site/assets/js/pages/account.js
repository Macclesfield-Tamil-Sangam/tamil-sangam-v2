/* My account: membership status, details, bookings, change password */
(function () {
  const { t, tr, esc, $, fmtDate, money, onLang, loadingBox, errorBox } = MTS, A = MTS_AUTH;
  let prof = null, regs = [], state = 'loading';
  const stBadge = s => s === 'approved' ? `<span class="badge ok">${t('stApproved')}</span>` : s === 'rejected' ? `<span class="badge bad">${t('stRejected')}</span>` : `<span class="badge wait">${t('stPending')}</span>`;
  const nameParts = n => { const p = String(n || '').trim().split(/\s+/); return [p.shift() || '', p.join(' ')]; };
  const regSt = { free: 'stFree', paid: 'stPaid', pending: 'stPendingPay', cancelled: 'stCancelled', refunded: 'stRefunded' };

  function render() {
    const box = $('#account');
    if (state === 'loading') return box.innerHTML = loadingBox();
    if (state === 'error') return box.innerHTML = errorBox();
    if (state === 'out') return box.innerHTML = `<div class="state empty">${t('pleaseLogin')}<br><br><a class="btn" href="/login.html?next=/account.html">${t('logIn')}</a></div>`;
    box.innerHTML = `
      ${A.recovery ? `<form class="box" id="pwForm" style="margin-bottom:28px;border-color:var(--gold)">
          <h3>${t('setNewPassword')}</h3>
          <label for="np">${t('newPassword')} <small>(${t('passwordHint')})</small></label><input id="np" type="password" minlength="8" required autocomplete="new-password">
          <label for="np2">${t('confirmPassword')}</label><input id="np2" type="password" minlength="8" required autocomplete="new-password">
          <button class="btn" type="submit" id="pwBtn">${t('savePassword')}</button><div class="form-msg hidden" id="pwMsg" role="status"></div></form>` : ''}
      <div class="acc-grid">
        <div>
          <form class="box" id="detForm">
            <h3>${t('myDetails')}</h3>
            <p style="margin-bottom:14px"><small style="color:var(--muted)">${t('membership')}</small><br>${stBadge(prof.status)}</p>
            <div class="row">
              <div><label for="dfn">${t('firstName')}</label><input id="dfn" value="${esc(nameParts(prof.full_name)[0])}" required autocomplete="given-name"></div>
              <div><label for="dln">${t('lastName')}</label><input id="dln" value="${esc(nameParts(prof.full_name)[1])}" autocomplete="family-name"></div>
            </div>
            <label for="dp">${t('fPhone')}</label><input id="dp" type="tel" value="${esc(prof.phone || '')}">
            <label>${t('fEmail')}</label><input value="${esc(prof.email || '')}" disabled>
            <button class="btn" type="submit">${t('save')}</button>
            <div class="form-msg hidden" id="detMsg"></div>
          </form>
          <p style="margin-top:16px"><button class="btn plain" id="outBtn">${t('logOut')}</button></p>
        </div>
        <div class="box" style="background:#fff;border:1px solid var(--line);border-radius:var(--radius);padding:30px">
          <h3 style="color:var(--maroon);margin-bottom:8px;font-size:1.4rem">${t('myTickets')}</h3>
          ${regs.length ? `<ul class="mini-list">${regs.map(r => `<li>
              <div><a class="link" href="/event.html?e=${encodeURIComponent(r.events ? r.events.slug : '')}">${esc(r.events ? tr(r.events, 'title') : '')}</a>
              <small>${r.events ? fmtDate(r.events.starts_at) : ''} · ${r.quantity} × ${esc(r.ticket_types ? tr(r.ticket_types, 'name') : '')}</small></div>
              <div style="text-align:right"><b>${r.amount_pence ? money(r.amount_pence) : ''}</b><br><span class="pill ${r.status}">${t(regSt[r.status] || 'stFree')}</span></div></li>`).join('')}</ul>`
            : `<p style="color:var(--muted)">${t('noTickets')}</p><p style="margin-top:14px"><a class="btn outline" href="/events.html">${t('events')}</a></p>`}
        </div>
      </div>`;

    $('#detForm').onsubmit = async e => {
      e.preventDefault();
      const m = $('#detMsg');
      try {
        const full = [$('#dfn').value.trim(), $('#dln').value.trim()].filter(Boolean).join(' ');
        if (!full) { m.textContent = t('nameNeeded'); m.className = 'form-msg err'; return; }
        await A.api(`profiles?id=eq.${prof.id}`, { method: 'PATCH', body: { full_name: full, phone: $('#dp').value.trim() }, headers: { Prefer: 'return=minimal' } });
        prof.full_name = full; prof.phone = $('#dp').value.trim();
        m.textContent = t('saved'); m.className = 'form-msg ok';
      } catch (err) { console.error(err); m.textContent = t('fError'); m.className = 'form-msg err'; }
    };
    $('#outBtn').onclick = async () => { await A.signOut(); location.href = '/'; };
    if ($('#pwForm')) $('#pwForm').onsubmit = async e => {
      e.preventDefault();
      const m = $('#pwMsg'), pw = $('#np').value, pw2 = $('#np2').value;
      if (pw.length < 8) { m.textContent = t('weakPassword'); m.className = 'form-msg err'; return; }
      if (pw !== pw2) { m.textContent = t('passwordsDontMatch'); m.className = 'form-msg err'; $('#np2').focus(); return; }
      $('#pwBtn').disabled = true;
      try {
        await A.setPassword(pw);
        $('#pwForm').innerHTML = `<h3>✅ ${t('passwordChanged')}</h3><p style="color:var(--muted)">${t('passwordChangedHelp')}</p>`;
        $('#pwForm').style.borderColor = '#bfe3cb'; $('#pwForm').style.background = '#eaf6ee';
      } catch (err) {
        console.error(err); $('#pwBtn').disabled = false;
        m.textContent = /different|same/i.test(err.message) ? t('samePassword') : t('fError'); m.className = 'form-msg err';
      }
    };
  }
  onLang(render);

  (async () => {
    try {
      prof = await A.profile(true);
      if (!prof) { state = 'out'; return render(); }
      regs = await A.api(`registrations?select=*,events(slug,title_en,title_ta,starts_at),ticket_types(name_en,name_ta)&user_id=eq.${prof.id}&order=created_at.desc`);
      state = 'ok';
    } catch (err) { console.error(err); state = 'error'; }
    render();
  })();
})();
