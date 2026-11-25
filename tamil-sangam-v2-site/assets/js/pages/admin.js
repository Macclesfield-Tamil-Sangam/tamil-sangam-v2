/* Admin area (committee only): events & tickets, photos, bookings, members.
   The database security rules enforce who can change what — this page is just the controls. */
(function () {
  const { esc, $, $$, photoUrl, fmtDate, money, CFG } = MTS, A = MTS_AUTH;
  const box = $('#admin');
  let me = null, events = [], tab = 'events', selEvent = '';
  const api = (path, opts) => A.api(path, opts);
  const toast = (el, text, ok = true) => { el.textContent = text; el.className = 'form-msg ' + (ok ? 'ok' : 'err'); };
  const slugify = s => s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 60);
  const toLocalInput = iso => { if (!iso) return ''; const d = new Date(iso), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
  const fromLocalInput = v => v ? new Date(v).toISOString() : null;
  const pounds = p => (p / 100).toFixed(2);
  const bookingState = e => {
    const now = new Date().toISOString();
    if (!e.registration_open || e.starts_at < now || (e.booking_closes_at && e.booking_closes_at < now)) return 'closed';
    if (e.booking_opens_at && e.booking_opens_at > now) return 'soon';
    return 'open';
  };
  const evName = e => `${esc(e.title_en)} · ${fmtDate(e.starts_at)}`;

  async function loadEvents() { events = await api('events?select=*&order=starts_at.desc'); }
  /* sensible default: bookings → the next event coming up; photos → the most recent past event */
  function defaultEvent(kind) {
    if (selEvent && events.some(e => e.id === selEvent)) return;
    const now = new Date().toISOString();
    const upcoming = events.filter(e => e.starts_at >= now).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    const past = events.filter(e => e.starts_at < now);
    const pick = kind === 'photos' ? (past[0] || upcoming[0]) : (upcoming[0] || past[0]);
    selEvent = pick ? pick.id : '';
  }

  /* ---------- page shell ---------- */
  function shell(inner) {
    const tabs = [['events', '📅 Events & tickets'], ['bookings', '🎟 Bookings'], ['photos', '📷 Photos'], ['members', '👥 Members']];
    box.innerHTML = `<div class="tabs">${tabs.map(([k, l]) => `<button data-tab="${k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}</div><div id="pane">${inner || ''}</div>`;
    $$('.tabs button', box).forEach(b => b.onclick = () => { tab = b.dataset.tab; selEvent = ''; history.replaceState(null, '', '#' + tab); show(); });
  }
  async function show() {
    shell('<div class="state"><div class="spinner"></div>Loading…</div>');
    try {
      if (tab === 'events') await eventsTab();
      else if (tab === 'bookings') await bookingsTab();
      else if (tab === 'photos') await photosTab();
      else if (tab === 'members') await membersTab();
    } catch (err) { console.error(err); $('#pane').innerHTML = `<div class="state error">Something went wrong: ${esc(err.message)}</div>`; }
  }

  /* ---------- EVENTS ---------- */
  async function eventsTab() {
    await loadEvents();
    const now = new Date().toISOString();
    $('#pane').innerHTML = `
      <div class="toolbar"><button class="btn" id="newEv">+ New event</button></div>
      <div id="evForm"></div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Event</th><th>Public?</th><th>Booking open?</th><th></th></tr></thead><tbody>
      ${events.map(e => `<tr>
        <td>${fmtDate(e.starts_at)}${e.starts_at < now ? ' <span class="pill">past</span>' : ''}</td>
        <td><b>${esc(e.title_en)}</b><br><small style="color:var(--muted)">${esc(e.title_ta || '')}</small></td>
        <td>${e.is_published ? '<span class="pill approved">Published</span>' : '<span class="pill pending">Hidden</span>'}</td>
        <td>${bookingState(e) === 'open' ? '<span class="pill approved">Open</span>' : bookingState(e) === 'soon' ? `<span class="pill pending">Opens ${fmtDate(e.booking_opens_at)}</span>` : '<span class="pill">Closed</span>'}${e.booking_closes_at && bookingState(e) !== 'closed' ? `<br><small style="color:var(--muted)">until ${fmtDate(e.booking_closes_at)}</small>` : ''}</td>
        <td style="white-space:nowrap"><button class="btn sm plain" data-edit="${e.id}">Edit</button>
          <a class="btn sm plain" href="/event.html?e=${encodeURIComponent(e.slug)}" target="_blank" rel="noopener">View</a></td></tr>`).join('') || '<tr><td colspan="5">No events yet.</td></tr>'}
      </tbody></table></div>`;
    $('#newEv').onclick = () => eventForm(null);
    $$('[data-edit]').forEach(b => b.onclick = () => eventForm(events.find(e => e.id === b.dataset.edit)));
  }

  async function eventForm(ev) {
    const tickets = ev ? await api(`ticket_types?select=*&event_id=eq.${ev.id}&order=sort.asc`) : [];
    const f = $('#evForm');
    const tkRow = tk => `<div class="row3 tk-row" data-id="${tk.id || ''}">
        <div><label>Ticket name (English / தமிழ்)</label><input class="tn" value="${esc(tk.name_en || '')}" placeholder="e.g. Adult"><input class="tnt" value="${esc(tk.name_ta || '')}" placeholder="பெரியவர்" style="margin-top:6px"></div>
        <div><label>Price £ (0 = free)</label><input class="tp" type="number" min="0" step="0.01" value="${tk.price_pence != null ? pounds(tk.price_pence) : '0.00'}"></div>
        <div><label>Places (blank = no limit)</label><input class="tc" type="number" min="1" value="${tk.capacity || ''}"></div>
        <div><button type="button" class="btn sm danger tk-del" title="Remove">✕</button></div></div>`;
    f.innerHTML = `<form class="adm-form" id="ef">
      <h3>${ev ? 'Edit event' : 'New event'}</h3>
      <div class="row"><div><label>Title (English) *</label><input id="e_ten" required value="${esc(ev ? ev.title_en : '')}"></div>
        <div><label>Title (தமிழ்)</label><input id="e_tta" value="${esc(ev ? ev.title_ta || '' : '')}"></div></div>
      <div class="row"><div><label>Description (English)</label><textarea id="e_den">${esc(ev ? ev.description_en || '' : '')}</textarea></div>
        <div><label>Description (தமிழ்)</label><textarea id="e_dta">${esc(ev ? ev.description_ta || '' : '')}</textarea></div></div>
      <div class="row"><div><label>Event starts * <small style="color:var(--muted)">(when the event begins)</small></label><input id="e_st" type="datetime-local" required value="${toLocalInput(ev && ev.starts_at)}"></div>
        <div><label>Event ends <small style="color:var(--muted)">(optional)</small></label><input id="e_en" type="datetime-local" value="${toLocalInput(ev && ev.ends_at)}"></div></div>
      <div class="row"><div><label>Venue</label><input id="e_ve" value="${esc(ev ? ev.venue || '' : '')}" placeholder="e.g. Macclesfield Town Hall"></div>
        <div><label>Web address name</label><input id="e_sl" value="${esc(ev ? ev.slug : '')}" placeholder="made from the title automatically"></div></div>
      <label>YouTube videos <small style="color:var(--muted)">(paste one link per line — e.g. https://youtu.be/…)</small></label>
      <textarea id="e_vid" style="min-height:80px" placeholder="https://www.youtube.com/watch?v=...">${esc(ev && ev.videos ? ev.videos.join('\n') : '')}</textarea>
      <label>Cover photo ${ev && ev.cover_url ? '(current photo kept unless you choose a new one)' : '(optional)'}</label>
      <input id="e_cv" type="file" accept="image/*">
      <label class="check"><input type="checkbox" id="e_pub" ${ev && ev.is_published ? 'checked' : ''}> Published (visible on the website)</label>
      <label class="check"><input type="checkbox" id="e_reg" ${ev && ev.registration_open ? 'checked' : ''}> Booking open (people can register / buy tickets)</label>
      <div class="row"><div><label>Booking opens <small style="color:var(--muted)">(blank = straight away)</small></label><input id="e_bo" type="datetime-local" value="${toLocalInput(ev && ev.booking_opens_at)}"></div>
        <div><label>Booking closes <small style="color:var(--muted)">(blank = when the event starts)</small></label><input id="e_bc" type="datetime-local" value="${toLocalInput(ev && ev.booking_closes_at)}"></div></div>
      <h3 style="margin-top:10px">Tickets</h3>
      <div id="tks">${tickets.map(tkRow).join('')}</div>
      <button type="button" class="btn sm plain" id="addTk">+ Add ticket type</button>
      <div style="margin-top:20px;display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn" type="submit" id="efSave">Save event</button>
        <button class="btn plain" type="button" id="efCancel">Cancel</button>
        ${ev && me.role === 'admin' ? '<button class="btn danger" type="button" id="efDel" style="margin-left:auto">Delete event</button>' : ''}
      </div>
      <div class="form-msg hidden" id="efMsg"></div></form>`;
    f.scrollIntoView({ behavior: 'smooth' });
    const removed = [];
    const bindDel = () => $$('.tk-del', f).forEach(b => b.onclick = () => { const r = b.closest('.tk-row'); if (r.dataset.id) removed.push(r.dataset.id); r.remove(); });
    bindDel();
    $('#addTk').onclick = () => { $('#tks').insertAdjacentHTML('beforeend', tkRow({})); bindDel(); };
    $('#efCancel').onclick = () => { f.innerHTML = ''; };
    if ($('#efDel')) $('#efDel').onclick = async () => {
      if (!window.confirmDelete) { window.confirmDelete = true; $('#efDel').textContent = 'Click again to delete — this also removes its bookings & photos'; return; }
      window.confirmDelete = false;
      try { await api(`events?id=eq.${ev.id}`, { method: 'DELETE' }); show(); } catch (err) { toast($('#efMsg'), err.message, false); }
    };
    $('#ef').onsubmit = async e => {
      e.preventDefault();
      const msg = $('#efMsg'), btn = $('#efSave');
      const title = $('#e_ten').value.trim(), st = $('#e_st').value;
      if (!title || !st) return toast(msg, 'Please fill in the English title and start date.', false);
      const slug = slugify($('#e_sl').value || (title.includes(st.slice(0, 4)) ? title : `${title} ${st.slice(0, 4)}`));
      const row = {
        slug, title_en: title, title_ta: $('#e_tta').value.trim() || null,
        description_en: $('#e_den').value.trim() || null, description_ta: $('#e_dta').value.trim() || null,
        starts_at: fromLocalInput(st), ends_at: fromLocalInput($('#e_en').value),
        venue: $('#e_ve').value.trim() || null, is_published: $('#e_pub').checked, registration_open: $('#e_reg').checked,
        booking_opens_at: fromLocalInput($('#e_bo').value), booking_closes_at: fromLocalInput($('#e_bc').value)
      };
      const vidLines = $('#e_vid').value.split(/\s+/).map(v => v.trim()).filter(Boolean);
      const badVid = vidLines.find(v => !MTS.ytId(v));
      if (badVid) return toast(msg, 'This is not a YouTube link: ' + badVid, false);
      if (vidLines.length || (ev && ev.videos && ev.videos.length)) row.videos = vidLines;
      if (row.booking_closes_at && row.booking_closes_at > row.starts_at) return toast(msg, 'Booking must close before the event starts.', false);
      if (row.booking_opens_at && row.booking_closes_at && row.booking_opens_at >= row.booking_closes_at) return toast(msg, 'Booking opens must be before Booking closes.', false);
      btn.disabled = true; btn.textContent = 'Saving…';
      try {
        const file = $('#e_cv').files[0];
        if (file) row.cover_url = await uploadImage(file, slug + '/cover');
        let saved;
        if (ev) [saved] = await api(`events?id=eq.${ev.id}`, { method: 'PATCH', body: row, headers: { Prefer: 'return=representation' } });
        else [saved] = await api('events', { method: 'POST', body: row, headers: { Prefer: 'return=representation' } });
        for (const id of removed) await api(`ticket_types?id=eq.${id}`, { method: 'DELETE' });
        const rows = $$('.tk-row', f);
        for (let i = 0; i < rows.length; i++) {
          const r = rows[i], name = $('.tn', r).value.trim(); if (!name) continue;
          const t = { event_id: saved.id, name_en: name, name_ta: $('.tnt', r).value.trim() || null,
            price_pence: Math.round(parseFloat($('.tp', r).value || '0') * 100), capacity: parseInt($('.tc', r).value, 10) || null, sort: i };
          if (r.dataset.id) await api(`ticket_types?id=eq.${r.dataset.id}`, { method: 'PATCH', body: t });
          else await api('ticket_types', { method: 'POST', body: t });
        }
        await show();
      } catch (err) {
        console.error(err);
        toast(msg, /duplicate|unique/i.test(err.message) ? 'That web address name is already used by another event — change "Web address name".' : 'Could not save: ' + err.message, false);
        btn.disabled = false; btn.textContent = 'Save event';
      }
    };
  }

  /* ---------- image upload (resized in the browser first) ---------- */
  function resize(file, max = 1600) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(b => b ? resolve(b) : reject(new Error('Could not read image')), 'image/jpeg', 0.85);
        URL.revokeObjectURL(img.src);
      };
      img.onerror = () => reject(new Error('Not an image: ' + file.name));
      img.src = URL.createObjectURL(file);
    });
  }
  async function uploadImage(file, prefix) {
    const blob = await resize(file);
    const path = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`;
    const res = await fetch(`${CFG.supabaseUrl}/storage/v1/object/photos/${path}`, {
      method: 'POST', body: blob,
      headers: { apikey: CFG.supabaseKey, Authorization: 'Bearer ' + await A.token(), 'Content-Type': 'image/jpeg', 'x-upsert': 'false' }
    });
    if (!res.ok) throw new Error('Upload failed (' + res.status + '): ' + await res.text());
    return path;
  }

  /* ---------- PHOTOS ---------- */
  async function photosTab() {
    await loadEvents(); defaultEvent('photos');
    const ev = events.find(e => e.id === selEvent);
    const photos = ev ? await api(`photos?select=*&event_id=eq.${ev.id}&order=sort.asc,created_at.asc`) : [];
    $('#pane').innerHTML = `
      <div class="toolbar"><label style="margin:0">Event</label><select id="phEv">${events.map(e => `<option value="${e.id}" ${e.id === selEvent ? 'selected' : ''}>${evName(e)}</option>`).join('')}</select></div>
      ${ev ? `<label class="drop" id="drop"><input type="file" id="phFiles" accept="image/*" multiple hidden>
          <b>Click to choose photos</b> or drag them here<br><small>They are resized automatically. You can select many at once.</small></label>
        <div class="form-msg hidden" id="phMsg"></div>
        <div class="ph-grid">${photos.map(p => `<div class="ph-item"><img src="${esc(photoUrl(p.storage_path))}" alt="" loading="lazy"><button data-del="${p.id}" data-path="${esc(p.storage_path)}" title="Delete photo">✕</button></div>`).join('') || '<p style="color:var(--muted)">No photos for this event yet.</p>'}</div>`
        : '<p>Create an event first.</p>'}`;
    if (!ev) return;
    $('#phEv').onchange = () => { selEvent = $('#phEv').value; show(); };
    const drop = $('#drop'), msg = $('#phMsg');
    const upload = async files => {
      files = [...files].filter(f => f.type.startsWith('image/'));
      let done = 0;
      for (const f of files) {
        toast(msg, `Uploading ${done + 1} of ${files.length}…`);
        try {
          const path = await uploadImage(f, ev.slug + '/photo');
          await api('photos', { method: 'POST', body: { event_id: ev.id, storage_path: path, sort: photos.length + done } });
          done++;
        } catch (err) { console.error(err); toast(msg, err.message, false); return; }
      }
      show();
    };
    $('#phFiles').onchange = e => upload(e.target.files);
    drop.ondragover = e => { e.preventDefault(); drop.classList.add('over'); };
    drop.ondragleave = () => drop.classList.remove('over');
    drop.ondrop = e => { e.preventDefault(); drop.classList.remove('over'); upload(e.dataTransfer.files); };
    $$('[data-del]').forEach(b => b.onclick = async () => {
      b.disabled = true;
      try {
        await fetch(`${CFG.supabaseUrl}/storage/v1/object/photos/${b.dataset.path}`, { method: 'DELETE', headers: { apikey: CFG.supabaseKey, Authorization: 'Bearer ' + await A.token() } });
        await api(`photos?id=eq.${b.dataset.del}`, { method: 'DELETE' });
        b.closest('.ph-item').remove();
      } catch (err) { toast(msg, err.message, false); b.disabled = false; }
    });
  }

  /* ---------- BOOKINGS ---------- */
  async function bookingsTab() {
    await loadEvents(); defaultEvent('bookings');
    const ev = events.find(e => e.id === selEvent);
    const regs = ev ? await api(`registrations?select=*,ticket_types(name_en)&event_id=eq.${ev.id}&order=created_at.asc`) : [];
    const live = regs.filter(r => r.status === 'free' || r.status === 'paid');
    const people = live.reduce((n, r) => n + r.quantity, 0), takings = live.reduce((n, r) => n + (r.status === 'paid' ? r.amount_pence : 0), 0);
    const inCount = live.filter(r => r.checked_in).reduce((n, r) => n + r.quantity, 0);
    $('#pane').innerHTML = `
      <div class="toolbar"><label style="margin:0">Event</label><select id="bkEv">${events.map(e => `<option value="${e.id}" ${e.id === selEvent ? 'selected' : ''}>${evName(e)}</option>`).join('')}</select>
        ${regs.length ? '<button class="btn sm plain" id="csv">⬇ Download list (CSV)</button>' : ''}
        <input id="bkSearch" placeholder="Search name or email…" style="width:auto;margin:0;flex:1;min-width:180px"></div>
      <div class="stat-row"><div><b>${people}</b><small>places booked</small></div><div><b>${money(takings) === MTS.t('free') ? '£0' : money(takings)}</b><small>paid online</small></div>
        <div><b>${inCount}</b><small>checked in</small></div><div><b>${regs.filter(r => r.status === 'pending').length}</b><small>awaiting payment</small></div></div>
      <div class="tbl-wrap"><table class="tbl" id="bkTbl"><thead><tr><th>Here</th><th>Name</th><th>Contact</th><th>Ticket</th><th>Qty</th><th>Amount</th><th>Status</th><th></th></tr></thead><tbody>
      ${regs.map(r => `<tr data-q="${esc((r.name + ' ' + r.email).toLowerCase())}">
        <td><input type="checkbox" data-in="${r.id}" ${r.checked_in ? 'checked' : ''} ${r.status === 'free' || r.status === 'paid' ? '' : 'disabled'} style="width:20px;height:20px;margin:0"></td>
        <td><b>${esc(r.name)}</b><br><small style="color:var(--muted)">${esc(r.id.slice(0, 8).toUpperCase())}</small></td>
        <td>${esc(r.email)}${r.phone ? '<br>' + esc(r.phone) : ''}</td>
        <td>${esc(r.ticket_types ? r.ticket_types.name_en : '')}</td><td>${r.quantity}</td>
        <td>${r.amount_pence ? '£' + pounds(r.amount_pence) : '—'}</td>
        <td><span class="pill ${r.status}">${r.status}</span></td>
        <td>${me.role === 'admin' && r.status !== 'cancelled' && r.status !== 'refunded' ? `<select data-st="${r.id}" style="width:auto;margin:0;padding:6px"><option value="">Change…</option><option value="cancelled">Cancel</option>${r.status === 'paid' ? '<option value="refunded">Mark refunded</option>' : ''}</select>` : ''}</td></tr>`).join('') || '<tr><td colspan="8">No bookings for this event yet.</td></tr>'}
      </tbody></table></div>
      <p class="note" style="margin-top:14px">Refunds: make the refund in your Stripe dashboard, then mark it here as refunded.</p>`;
    if (!ev) return;
    $('#bkEv').onchange = () => { selEvent = $('#bkEv').value; show(); };
    $('#bkSearch').oninput = e => { const q = e.target.value.toLowerCase(); $$('#bkTbl tbody tr').forEach(tr => tr.style.display = !q || (tr.dataset.q || '').includes(q) ? '' : 'none'); };
    $$('[data-in]').forEach(c => c.onchange = async () => {
      try { await api(`registrations?id=eq.${c.dataset.in}`, { method: 'PATCH', body: { checked_in: c.checked } }); } catch (err) { c.checked = !c.checked; alertBox(err.message); }
    });
    $$('[data-st]').forEach(s => s.onchange = async () => {
      if (!s.value) return;
      try { await api(`registrations?id=eq.${s.dataset.st}`, { method: 'PATCH', body: { status: s.value } }); show(); } catch (err) { alertBox(err.message); }
    });
    if ($('#csv')) $('#csv').onclick = () => {
      const cell = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const lines = [['Reference', 'Name', 'Email', 'Phone', 'Ticket', 'Quantity', 'Amount £', 'Status', 'Checked in', 'Booked at'].map(cell).join(',')]
        .concat(regs.map(r => [r.id.slice(0, 8).toUpperCase(), r.name, r.email, r.phone, r.ticket_types ? r.ticket_types.name_en : '', r.quantity, pounds(r.amount_pence), r.status, r.checked_in ? 'yes' : '', new Date(r.created_at).toLocaleString('en-GB')].map(cell).join(',')));
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv' }));
      a.download = `${ev.slug}-bookings.csv`; a.click();
    };
  }
  function alertBox(text) { const p = $('#pane'); p.insertAdjacentHTML('afterbegin', `<div class="form-msg err">${esc(text)}</div>`); }

  /* ---------- MEMBERS ---------- */
  async function membersTab() {
    const list = await api('member_list?select=*&order=created_at.desc');
    const pending = list.filter(m => m.status === 'pending');
    const row = m => `<tr>
      <td><b>${esc(m.full_name || '—')}</b></td><td>${esc(m.email)}${m.phone ? '<br>' + esc(m.phone) : ''}</td>
      <td>${new Date(m.created_at).toLocaleDateString('en-GB')}</td>
      <td><span class="pill ${m.status}">${m.status}</span></td>
      <td>${me.role === 'admin' && m.id !== me.id ? `<select data-role="${m.id}" style="width:auto;margin:0;padding:6px">${['member', 'editor', 'admin'].map(r => `<option ${m.role === r ? 'selected' : ''}>${r}</option>`).join('')}</select>` : esc(m.role)}</td>
      <td style="white-space:nowrap">${me.role === 'admin' && m.id !== me.id ? `${m.status !== 'approved' ? `<button class="btn sm" data-ok="${m.id}">Approve</button>` : ''} ${m.status !== 'rejected' ? `<button class="btn sm danger" data-no="${m.id}">Reject</button>` : ''}` : ''}</td></tr>`;
    $('#pane').innerHTML = `
      <div class="stat-row"><div><b>${list.filter(m => m.status === 'approved').length}</b><small>members</small></div><div><b>${pending.length}</b><small>waiting for approval</small></div>
        <div><b>${list.filter(m => m.role !== 'member').length}</b><small>committee (admin/editor)</small></div><div><b>${list.length}</b><small>accounts in total</small></div></div>
      ${me.role !== 'admin' ? '<p class="note" style="margin-bottom:14px">Only admins can approve members or change roles.</p>' : ''}
      <p class="note" style="margin-bottom:14px"><b>Roles:</b> member = normal account · editor = can manage events, photos and bookings · admin = everything, including members.</p>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Name</th><th>Contact</th><th>Joined</th><th>Status</th><th>Role</th><th></th></tr></thead>
      <tbody>${list.map(row).join('') || '<tr><td colspan="6">No accounts yet.</td></tr>'}</tbody></table></div>`;
    const patch = async (id, body) => { try { await api(`profiles?id=eq.${id}`, { method: 'PATCH', body }); show(); } catch (err) { alertBox(err.message); } };
    $$('[data-ok]').forEach(b => b.onclick = () => patch(b.dataset.ok, { status: 'approved' }));
    $$('[data-no]').forEach(b => b.onclick = () => patch(b.dataset.no, { status: 'rejected' }));
    $$('[data-role]').forEach(s => s.onchange = () => patch(s.dataset.role, { role: s.value }));
  }

  /* ---------- start ---------- */
  (async () => {
    try { me = await A.profile(true); } catch (e) { me = null; }
    if (!me) { box.innerHTML = `<div class="state empty">Please log in with a committee account.<br><br><a class="btn" href="/login.html?next=/admin.html">Log in</a></div>`; return; }
    if (!A.isStaff(me)) { box.innerHTML = `<div class="state empty">Your account (${esc(me.email)}) doesn't have admin access. Ask an admin to give you the <b>editor</b> or <b>admin</b> role.</div>`; return; }
    const h = location.hash.slice(1); if (['events', 'bookings', 'photos', 'members'].includes(h)) tab = h;
    show();
  })();
})();
