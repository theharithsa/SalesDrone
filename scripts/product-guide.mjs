const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ],
  );
export function renderProductGuide(guide, version) {
  const ids = new Set();
  for (const m of guide.modules) {
    if (
      !/^[a-z][a-z0-9-]+$/.test(m.id) ||
      ids.has(m.id) ||
      !m.steps?.length ||
      !m.details?.length ||
      !m.faq?.length
    )
      throw Error('Incomplete or duplicate product module');
    ids.add(m.id);
  }
  const links =
    '<a href="index.html">Overview</a><a href="settings.html">Every setting</a><a href="https://sales-drone-avinya.firebaseapp.com/api/docs">API portal ↗</a>';
  const md = [
    '# ' + guide.title,
    '',
    'Version ' + version,
    '',
    '[Complete settings reference](SETTINGS.md) · [API guide](API.md) · [Technical architecture](TECHNICAL.md)',
    '',
  ];
  const sections = guide.modules
    .map((m) => {
      md.push(
        '## ' + m.title,
        '',
        m.audience,
        '',
        ...m.steps.flatMap((s, i) => [i + 1 + '. ' + s, '']),
        ...m.details.flatMap((p) => [p, '']),
        '### Questions',
        '',
        ...m.faq.flatMap(([q, a]) => ['**' + q + '**', '', a, '']),
      );
      return `<section id="${m.id}" data-guide-module><p class="eyebrow">${escape(m.audience)}</p><h2>${escape(m.title)}</h2><ol>${m.steps.map((s) => `<li>${escape(s)}</li>`).join('')}</ol>${m.details.map((p) => `<p>${escape(p)}</p>`).join('')}<h3>Questions & troubleshooting</h3>${m.faq.map(([q, a]) => `<details><summary>${escape(q)}</summary><p>${escape(a)}</p></details>`).join('')}</section>`;
    })
    .join('');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="salesdrone-version" content="${escape(version)}"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SalesDrone · Product handbook</title><link rel="stylesheet" href="product.css"></head><body><a class="skip" href="#content">Skip to handbook</a><aside><a class="wordmark" href="index.html">SalesDrone<span>by AvinyaTech</span></a><p>Product handbook · v${escape(version)}</p><label for="find">Find in handbook</label><input id="find" type="search" placeholder="Search a feature or question"><nav aria-label="Handbook modules">${guide.modules.map((m) => `<a href="#${m.id}">${escape(m.title)}</a>`).join('')}</nav><div class="reference-links">${links}</div></aside><main id="content"><header><p class="eyebrow">A next step for every lead</p><h1>Work confidently with SalesDrone.</h1><p>Step-by-step workflows, feature explanations and answers for founders, sales representatives and administrators. This handbook covers the product; the <a href="settings.html">Settings reference</a> lists every configurable control.</p><p id="search-status" role="status"></p><figure><img src="assets/screenshots/lead-workspace-demo.jpg" alt="Fictional lead workspace with All, Comments, Calls, Tasks and Review tabs" width="1440" loading="lazy"><figcaption>Synthetic demonstration data. Your available controls depend on permission and viewport.</figcaption></figure></header>${sections}<figure><img src="assets/screenshots/book-mode-light.jpg" alt="Fictional lead workspace in Book mode with warm paper colours" width="1440" loading="lazy"><figcaption>Book mode is a personal setting under Appearance &amp; time. Synthetic demonstration data.</figcaption></figure><footer>${links}<p>SalesDrone by AvinyaTech · Part of Avinya Enterprises · v${escape(version)}</p></footer></main><script>const input=document.querySelector('#find'),sections=[...document.querySelectorAll('[data-guide-module]')];input.addEventListener('input',()=>{const q=input.value.trim().toLowerCase();let shown=0;for(const s of sections){s.hidden=!!q&&!s.textContent.toLowerCase().includes(q);if(!s.hidden)shown++;}document.querySelector('#search-status').textContent=q?shown+' matching modules. Clear search to show all.':'';});document.querySelector('nav').addEventListener('click',e=>{if(e.target.closest('a')){input.value='';input.dispatchEvent(new Event('input'));}});</script></body></html>`;
  return { html, markdown: md.join('\n').trimEnd() + '\n' };
}
