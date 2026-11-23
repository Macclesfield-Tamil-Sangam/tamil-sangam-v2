/* Events page: all upcoming published events */
(function () {
  const { t, $, db, eventCard, onLang, loadingBox, errorBox } = MTS;
  let rows = null, failed = false;
  function render() {
    const box = $('#list');
    if (failed) return box.innerHTML = errorBox();
    if (!rows) return box.innerHTML = loadingBox();
    box.innerHTML = rows.length ? rows.map(e => eventCard(e, { upcoming: true })).join('')
      : `<div class="state empty">${t('noUpcoming')}<br><br><a class="btn outline" href="/past-events.html">${t('pastEvents')}</a></div>`;
  }
  onLang(render);
  db(`events?select=*&is_published=eq.true&starts_at=gte.${new Date().toISOString()}&order=starts_at.asc`)
    .then(r => { rows = r; render(); })
    .catch(err => { console.error(err); failed = true; render(); });
})();
