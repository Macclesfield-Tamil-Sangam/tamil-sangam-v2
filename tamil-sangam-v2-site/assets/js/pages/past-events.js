/* Memories page: past events year by year, each with its photos */
(function () {
  const { t, tr, esc, $, db, photoUrl, fmtMonthYear, yearOf, onLang, loadingBox, errorBox, openLightbox, ytId, videoEmbeds } = MTS;
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

    const shown = rows.filter(e => yearOf(e.starts_at) === year);
    box.innerHTML = shown.map((e, gi) => {
      const ph = photos.filter(p => p.event_id === e.id);
      const href = `/event.html?e=${encodeURIComponent(e.slug)}`;
      const vids = (e.videos || []).filter(ytId);
      return `<article class="memory">
        <div class="memory-head">
          <div>
            <div class="meta">${fmtMonthYear(e.starts_at)}${e.venue ? ' · ' + esc(e.venue) : ''}${ph.length ? ` · 📷 ${ph.length} ${t('photos')}` : ''}${vids.length ? ` · 🎬 ${vids.length} ${t('videos')}` : ''}</div>
            <h2><a href="${href}">${esc(tr(e, 'title'))}</a></h2>
            ${tr(e, 'description') ? `<p>${esc(tr(e, 'description'))}</p>` : ''}
          </div>
          <a class="view" href="${href}">${t('details')}</a>
        </div>
        ${ph.length
          ? `<div class="gal-grid">${ph.map((p, i) => `<button data-g="${gi}" data-i="${i}" aria-label="${esc(tr(e, 'title'))} ${i + 1}"><img src="${esc(photoUrl(p.storage_path))}" alt="${esc(tr(p, 'caption'))}" loading="lazy"></button>`).join('')}</div>`
          : (vids.length ? '' : `<div class="memory-empty">📷 ${t('photosSoon')}</div>`)}
        ${videoEmbeds(vids, tr(e, 'title'))}
      </article>`;
    }).join('');

    box.querySelectorAll('.gal-grid button').forEach(b => b.onclick = () => {
      const e = shown[+b.dataset.g], ph = photos.filter(p => p.event_id === e.id);
      openLightbox(ph.map(p => ({ src: photoUrl(p.storage_path), caption: tr(p, 'caption') || tr(e, 'title') })), +b.dataset.i);
    });
  }
  onLang(render);

  const fromHash = parseInt(location.hash.slice(1), 10);
  if (fromHash) year = fromHash;
  window.addEventListener('hashchange', () => { const y = parseInt(location.hash.slice(1), 10); if (y && y !== year) { year = y; render(); } });
  Promise.all([
    db(`events?select=*&is_published=eq.true&starts_at=lt.${new Date().toISOString()}&order=starts_at.desc`),
    db('photos?select=*&order=sort.asc,created_at.asc')
  ]).then(([e, p]) => { rows = e; photos = p; render(); })
    .catch(err => { console.error(err); failed = true; render(); });
})();
