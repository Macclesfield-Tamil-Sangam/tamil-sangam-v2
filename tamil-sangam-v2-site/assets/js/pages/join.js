/* Join page: create a member account (first + last name) */
(function () {
  const { t, $, esc } = MTS, A = MTS_AUTH;
  if (A.session) location.replace('/account.html');
  const form = $('#joinForm'), msg = $('#jmsg'), btn = $('#jbtn');
  const show = (text, ok) => { msg.textContent = text; msg.className = 'form-msg ' + (ok ? 'ok' : 'err'); };

  function alreadyRegistered(email) {
    msg.className = 'form-msg err';
    msg.innerHTML = `<b>${esc(t('emailTakenTitle'))}</b><br>${esc(t('emailTakenHelp'))}
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
        <a class="btn sm" href="/login.html?email=${encodeURIComponent(email)}">${esc(t('logIn'))}</a>
        <button type="button" class="btn sm plain" id="jReset">${esc(t('sendReset'))}</button>
      </div>`;
    $('#jReset').onclick = async () => {
      $('#jReset').disabled = true;
      try { await A.resetPassword(email); } catch (e) { console.error(e); }
      msg.className = 'form-msg ok'; msg.textContent = t('resetSent');
    };
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const first = $('#jf').value.trim(), last = $('#jl').value.trim();
    const email = $('#je').value.trim(), phone = $('#jp').value.trim(), pw = $('#jw').value;
    if (!first || !last) return show(t('nameNeeded'));
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return show(t('fEmail') + ' ?');
    if (pw.length < 8) return show(t('weakPassword'));
    if (!$('#jc').checked) return show(t('agreePrivacy'));
    btn.disabled = true;
    try {
      const r = await A.signUp(email, pw, { full_name: `${first} ${last}`, first_name: first, last_name: last, phone });
      if (r.needsConfirm) { form.querySelectorAll('input,button').forEach(el => el.disabled = true); show(t('checkEmail'), true); }
      else location.href = '/account.html';
    } catch (err) {
      console.error(err);
      if (err.code === 'user_already_exists') alreadyRegistered(email);
      else show(/password/i.test(err.message) ? t('weakPassword') : t('fError'));
    } finally { if (!$('#jf').disabled) btn.disabled = false; }
  });
})();
