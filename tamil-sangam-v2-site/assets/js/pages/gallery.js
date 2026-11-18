/* Gallery page: all photos, grouped by event, filter by year */
(function () {
  const { t, tr, esc, $, db, photoUrl, fmtMonthYear, yearOf, onLang, loadingBox, errorBox, openLightbox } = MTS;
  let rows = null, failed = false, year = 'all';
  function render() {
    const box = $('#gallery'), yb = $('#years');
    if (failed) { yb.innerHTML = ''; return box.innerHTML = errorBox(); }
    if (!rows) return box.innerHTML = loadingBox();
    if (!rows.length) { yb.innerHTML = ''; return box.innerHTML = `<div class="state empty"><div style="font-size:2.4rem">📷</div>${t('photosSoon')}</div>`; }

    const groups = new Map();
    rows.forEach(p => {
      const key = p.events ? p.events.slug : '_other';
      if (!groups.has(key)) groups.set(key, { ev: p.events, photos: [] });
      groups.get(key).photos.push(p);
    });
    const list = [...groups.values()].sort((a, b) => (b.ev ? +new Date(b.ev.starts_at) : 0) - (a.ev ? +new Date(a.ev.starts_at) : 0));
    const years = [...new Set(list.filter(g => g.ev).map(g => yearOf(g.ev.starts_at)))].sort((a, b) => b - a);
    const opts = ['all', ...years];
    yb.innerHTML = opts.map(y => `<button class="${y === year ? 'on' : ''}" aria-pressed="${y === year}">${y === 'all' ? t('allYears') : y}</button>`).join('');
    [...yb.children].forEach((b, i) => b.onclick = () => { year = opts[i]; render(); });

    const shown = list.filter(g => year === 'all' || (g.ev && yearOf(g.ev.starts_at) === year));
    box.innerHTML = shown.map((g, gi) => `<div class="gal-group">
      <h2>${g.ev ? `<a class="link" style="color:inherit" href="/event.html?e=${encodeURIComponent(g.ev.slug)}">${esc(tr(g.ev, 'title'))}</a>` : t('gallery')}</h2>
      <div class="meta">${g.ev ? fmtMonthYear(g.ev.starts_at) + ' · ' : ''}${g.photos.length} ${t('photos')}</div>
      <div class="gal-grid">${g.photos.map((p, i) => `<button data-g="${gi}" data-i="${i}"><img src="${esc(photoUrl(p.storage_path))}" alt="${esc(tr(p, 'caption'))}" loading="lazy"></button>`).join('')}</div>
    </div>`).join('');
    box.querySelectorAll('.gal-grid button').forEach(b => b.onclick = () => {
      const g = shown[+b.dataset.g];
      openLightbox(g.photos.map(p => ({ src: photoUrl(p.storage_path), caption: tr(p, 'caption') || (g.ev ? tr(g.ev, 'title') : '') })), +b.dataset.i);
    });
  }
  onLang(render);
  db('photos?select=*,events(slug,title_en,title_ta,starts_at)&order=sort.asc,created_at.asc')
    .then(r => { rows = r; render(); })
    .catch(err => { console.error(err); failed = true; render(); });
})();
