/* Home page: slideshow + upcoming and recent events from the database */
(function () {
  const { CFG, L, t, $, db, eventCard, onLang, loadingBox, errorBox, KOLAM } = MTS;
  const now = new Date().toISOString();
  let upcoming = null, recent = null, failed = false, photos = [];

  /* slideshow */
  let cur = 0, timer;
  function buildSlides() {
    $('#slides').innerHTML = CFG.slides.map((s, i) => `
      <div class="slide bg${i % 4} ${s.image ? 'has-photo' : ''} ${i === cur ? 'on' : ''}">
        ${s.image ? `<img class="slide-photo" src="${MTS.esc(s.image)}" alt="" ${i ? 'loading="lazy"' : ''}>` : KOLAM}
        <div class="wrap"><h1>${MTS.esc(L(s.title))}</h1><p>${MTS.esc(L(s.text))}</p>
          <a href="/events.html" class="btn">${t('seeEvents')}</a><a href="/join.html" class="btn ghost">${t('joinNow')}</a></div>
      </div>`).join('');
    $('#dots').innerHTML = CFG.slides.map((_, i) => `<button class="${i === cur ? 'on' : ''}" aria-label="Slide ${i + 1}"></button>`).join('');
    [...$('#dots').children].forEach((b, i) => b.onclick = () => show(i));
  }
  function show(i) {
    const s = $('#slides').children, d = $('#dots').children;
    s[cur].classList.remove('on'); d[cur].classList.remove('on');
    cur = (i + s.length) % s.length;
    s[cur].classList.add('on'); d[cur].classList.add('on');
    restart();
  }
  function restart() { clearInterval(timer); timer = setInterval(() => show(cur + 1), 5500); }
  $('.hero .prev').onclick = () => show(cur - 1);
  $('.hero .next').onclick = () => show(cur + 1);

  const withPhotos = list => list.map(e => {
    const p = photos.filter(x => x.event_id === e.id);
    return { ...e, photo_count: p.length, first_photo: p[0] && p[0].storage_path };
  });

  function render() {
    buildSlides(); restart();
    if (failed) { $('#upcoming').innerHTML = errorBox(); $('#recent').innerHTML = errorBox(); return; }
    if (!upcoming) { $('#upcoming').innerHTML = loadingBox(); $('#recent').innerHTML = loadingBox(); return; }
    $('#upcoming').innerHTML = upcoming.length
      ? withPhotos(upcoming).map(e => eventCard(e, { upcoming: true })).join('')
      : `<div class="state empty">${t('noUpcoming')}</div>`;
    $('#recent').innerHTML = recent.length ? withPhotos(recent).map(e => eventCard(e)).join('') : `<div class="state empty">${t('noPast')}</div>`;
  }
  onLang(render);

  /* heritage photo strip opens in the photo viewer */
  const hb = [...document.querySelectorAll('#heritage button')];
  hb.forEach(b => b.onclick = () => MTS.openLightbox(hb.map(x => ({ src: x.querySelector('img').src, caption: x.querySelector('img').alt })), +b.dataset.i));

  Promise.all([
    db(`events?select=*&is_published=eq.true&starts_at=gte.${now}&order=starts_at.asc&limit=3`),
    db(`events?select=*&is_published=eq.true&starts_at=lt.${now}&order=starts_at.desc&limit=3`),
    db('photos?select=event_id,storage_path&order=sort.asc,created_at.asc')
  ]).then(([u, r, p]) => { upcoming = u; recent = r; photos = p; render(); })
    .catch(err => { console.error(err); failed = true; render(); });
})();
