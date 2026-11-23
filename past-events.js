/* Past events page: grouped by year, with photo counts */
(function () {
  const { t, $, db, eventCard, yearOf, onLang, loadingBox, errorBox } = MTS;
  let rows = null, photos = [], failed = false, year = null;
  function render() {
    const box = $('#list'), yb = $('#years');
    if (failed) { yb.innerHTML = ''; return box.innerHTML = errorBox(); }
    if (!rows) return box.innerHTML = loadingBox();
    if (!rows.length) { yb.innerHTML = ''; return box.innerHTML = `<div class="state empty">${t('noPast')}</div>`; }
    const years = [...new Set(rows.map(e => yearOf(e.starts_at)))].sort((a, b) => b - a);
    if (!years.includes(year)) year = years[0];
    yb.innerHTML = years.map(y => `<button class="${y === year ? 'on' : ''}" aria-pressed="${y === year}">${y}</button>`).join('');
    [...yb.children].forEach((b, i) => b.onclick = () => { year = years[i]; history.replaceState(null, '', '#' + year); render(); });
    box.innerHTML = rows.filter(e => yearOf(e.starts_at) === year).map(e => {
      const p = photos.filter(x => x.event_id === e.id);
      return eventCard({ ...e, photo_count: p.length, first_photo: p[0] && p[0].storage_path });
    }).join('');
  }
  onLang(render);
  const fromHash = parseInt(location.hash.slice(1), 10);
  if (fromHash) year = fromHash;
  Promise.all([
    db(`events?select=*&is_published=eq.true&starts_at=lt.${new Date().toISOString()}&order=starts_at.desc`),
    db('photos?select=event_id,storage_path&order=sort.asc,created_at.asc')
  ]).then(([e, p]) => { rows = e; photos = p; render(); })
    .catch(err => { console.error(err); failed = true; render(); });
})();
