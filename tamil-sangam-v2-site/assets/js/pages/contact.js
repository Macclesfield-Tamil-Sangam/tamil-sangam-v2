/* Contact page: contact cards + message form (sent through Netlify Forms) */
(function () {
  const { t, esc, $, channels, ext, ICON, onLang } = MTS;
  function render() {
    const ch = channels();
    $('#cards').innerHTML = ch.map(c => `<a class="card" href="${esc(c.url)}"${ext(c.url)}><div class="ci ${c.cls}">${ICON[c.k]}</div><div><small>${esc(c.label)}</small><b>${esc(c.sub)}</b></div></a>`).join('');
    $('#cards').classList.toggle('hidden', !ch.length);
    $('#contactGrid').classList.toggle('solo', !ch.length);
    const sel = $('#fs'), idx = Math.max(0, sel.selectedIndex);
    sel.innerHTML = t('subjects').map(s => `<option>${esc(s)}</option>`).join('');
    sel.selectedIndex = idx;
  }
  onLang(render);

  const form = $('#contactForm');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = $('#fsend'), msg = $('#fmsg');
    btn.disabled = true; btn.textContent = t('fSending');
    msg.className = 'form-msg hidden';
    try {
      const res = await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(new FormData(form)).toString()
      });
      if (!res.ok) throw new Error('Form error ' + res.status);
      form.reset();
      msg.textContent = t('fThanks'); msg.className = 'form-msg ok';
    } catch (err) {
      console.error(err);
      msg.textContent = t('fError'); msg.className = 'form-msg err';
    } finally {
      btn.disabled = false; btn.textContent = t('fSend');
    }
  });
})();
