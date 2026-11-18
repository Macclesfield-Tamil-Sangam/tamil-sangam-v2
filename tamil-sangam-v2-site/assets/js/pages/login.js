/* Login page (and "forgot password") */
(function () {
  const { t, $ } = MTS, A = MTS_AUTH;
  if (A.session) location.replace('/account.html');
  const msg = $('#lmsg'), btn = $('#lbtn');
  const show = (text, ok) => { msg.textContent = text; msg.className = 'form-msg ' + (ok ? 'ok' : 'err'); };
  const authErr = sessionStorage.getItem('mts-auth-error');
  if (authErr) { show(authErr); sessionStorage.removeItem('mts-auth-error'); }
  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    btn.disabled = true;
    try {
      await A.signIn($('#le').value.trim(), $('#lw').value);
      const back = new URLSearchParams(location.search).get('next');
      location.href = back && back.startsWith('/') && !back.startsWith('//') ? back : '/account.html';
    } catch (err) {
      console.error(err);
      show(/confirm/i.test(err.message) || err.code === 'email_not_confirmed' ? t('notConfirmed') : err.status === 400 ? t('wrongLogin') : t('fError'));
      btn.disabled = false;
    }
  });
  $('#forgotLink').addEventListener('click', async e => {
    e.preventDefault();
    const email = $('#le').value.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { $('#le').focus(); return show(t('fEmail') + ' ?'); }
    try { await A.resetPassword(email); } catch (err) { console.error(err); }
    show(t('resetSent'), true);
  });
})();
