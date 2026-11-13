const filter = document.querySelector('#filter');
const results = document.querySelector('#results');
const rows = [...document.querySelectorAll('.release-list > li')];
const searchable = rows.map((row) => row.textContent.toLowerCase());

function filterReleases() {
  const terms = filter.value.trim().toLowerCase().split(/\s+/);
  let count = 0;
  rows.forEach((row, index) => {
    row.hidden = !terms.every((term) => searchable[index].includes(term));
    if (!row.hidden) count += 1;
  });
  results.textContent = count ? `${count} ${count === 1 ? 'version' : 'versions'}` : 'No matching releases.';
}

document.querySelector('.release-filter').hidden = false;
filter.addEventListener('input', filterReleases);
filterReleases();
