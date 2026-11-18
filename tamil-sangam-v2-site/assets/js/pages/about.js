/* About page: live counts from the database */
(function () {
  const { db, yearOf, $ } = MTS;
  db(`events?select=starts_at&is_published=eq.true&starts_at=lt.${new Date().toISOString()}`)
    .then(rows => {
      $('#statEvents').textContent = rows.length + (rows.length ? '+' : '');
      $('#statYears').textContent = new Set(rows.map(r => yearOf(r.starts_at))).size;
    })
    .catch(err => console.error(err));
})();
