/* Join page: create a member account */
(function () {
  const { t, $ } = MTS, A = MTS_AUTH;
  if (A.session) location.replace('/account.html');
  const form = $('#joinForm'), msg = $('#jmsg'), btn = $('#jbtn');
  const show = (text, ok) => { msg.textContent = text; msg.className = 'form-msg ' + (ok ? 'ok' : 'err'); };
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const name = $('#jn').value.trim(), email = $('#je').value.trim(), phone = $('#jp').value.trim(), pw = $('#jw').value;
    if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return show(t('fError'));
    if (pw.length < 8) return show(t('weakPassword'));
    if (!$('#jc').checked) return show(t('agreePrivacy'));
    btn.disabled = true;
    try {
      const r = await A.signUp(email, pw, { full_name: name, phone });
      if (r.needsConfirm) { form.querySelectorAll('input,button').forEach(el => el.disabled = true); show(t('checkEmail'), true); }
      else location.href = '/account.html';
    } catch (err) {
      console.error(err);
      show(/already|registered|exists/i.test(err.message) ? t('emailTaken') : /password/i.test(err.message) ? t('weakPassword') : t('fError'));
    } finally { if (!form.querySelector('#jn').disabled) btn.disabled = false; }
  });
})();
