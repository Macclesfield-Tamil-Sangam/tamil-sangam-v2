/* Shown after Stripe checkout: booking.html?status=success|cancelled&e=<event slug> */
(function () {
  const { t, $, onLang } = MTS;
  const q = new URLSearchParams(location.search), ok = q.get('status') === 'success', slug = q.get('e') || '';
  function render() {
    $('#bkIcon').textContent = ok ? '🎉' : '🪔';
    $('#bkTitle').textContent = ok ? t('bookingDoneTitle') : t('stCancelled');
    $('#bkText').textContent = ok ? t('bookingPaid') : t('bookingCancelled');
    $('#bkLinks').innerHTML = (slug ? `<a class="btn" href="/event.html?e=${encodeURIComponent(slug)}">${t('back')}</a> ` : '') +
      (MTS_AUTH.session ? `<a class="btn outline" href="/account.html">${t('myTickets')}</a>` : `<a class="btn outline" href="/events.html">${t('events')}</a>`);
  }
  onLang(render);
})();
