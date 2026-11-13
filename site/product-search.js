const search = document.querySelector('#find');
const status = document.querySelector('#search-status');
const modules = [...document.querySelectorAll('[data-guide-module]')];
const topics = document.querySelector('#handbook-topics');
const gallery = document.querySelector('#handbook-gallery');
const desktop = matchMedia('(min-width: 60rem)');

function fitTopics() {
  topics.open = desktop.matches;
}

function filterHandbook() {
  const query = search.value.trim().toLowerCase();
  let count = 0;
  for (const module of modules) {
    module.hidden = Boolean(query) && !module.textContent.toLowerCase().includes(query);
    if (!module.hidden) count++;
  }
  gallery.hidden = Boolean(query);
  status.textContent = query
    ? count === 0 ? 'No matching topics. Try a different term.' : `${count} matching ${count === 1 ? 'topic' : 'topics'}`
    : '';
}

search.closest('section').hidden = false;
search.addEventListener('input', filterHandbook);
topics.addEventListener('click', (event) => {
  if (!event.target.closest('a')) return;
  search.value = '';
  filterHandbook();
  if (!desktop.matches) topics.open = false;
});
desktop.addEventListener('change', fitTopics);
fitTopics();
