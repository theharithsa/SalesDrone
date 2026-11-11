/** Real local UI regression. Start design:dev and isolated installed Chromium/CDP first. */
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import {
  nav,
  viewport,
  js,
  send,
  wait,
  delay,
  screenshot,
  close,
} from './local-browser.mjs';
await mkdir('test-results/mobile', { recursive: true });
const evidence = [];
const { version } = JSON.parse(
  await readFile(new URL('../package.json', import.meta.url), 'utf8'),
);
async function tap(selector) {
  // A drawer can still be moving after viewport/zoom changes. Hit its settled target.
  await js("Promise.all(document.getAnimations().filter(a=>Number.isFinite(a.effect.getTiming().iterations)).map(a=>a.finished.catch(()=>{})))");
  const box = await js(
    `(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing '+${JSON.stringify(selector)});let r=e.getBoundingClientRect();if(r.top<0||r.bottom>innerHeight)e.scrollIntoView({block:'center',behavior:'instant'});r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`,
  );
  await send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [box],
  });
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await delay(320);
}
async function action(text) {
  const selector = await js(
    `(()=>{const e=[...document.querySelectorAll('button,summary,a')].find(e=>(e.textContent.trim()===${JSON.stringify(text)}||e.getAttribute('aria-label')===${JSON.stringify(text)})&&e.getClientRects().length&&e.getBoundingClientRect().left>=0&&e.getBoundingClientRect().right<=innerWidth&&!e.closest('[aria-hidden=true]')&&getComputedStyle(e).visibility!=='hidden');if(!e)throw Error('Missing visible action '+${JSON.stringify(text)});e.setAttribute('data-mobile-action','active');return '[data-mobile-action="active"]';})()`,
  );
  await tap(selector);
  await js(
    'document.querySelector("[data-mobile-action]")?.removeAttribute("data-mobile-action")',
  );
}
async function select(selector, value) {
  await wait('!!document.querySelector(' + JSON.stringify(selector) + ')');
  await js(
    `(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('change',{bubbles:true}));})()`,
  );
  await delay(150);
}
async function settingsSection(section) {
  const marker = '.settings-directory a[href*="section=' + section + '"]';
  if (!(await js('!!document.querySelector(' + JSON.stringify(marker) + ')'))) {
    if (await js('!!document.querySelector(".settings-section-header .settings-back")'))
      await tap('.settings-section-header .settings-back');
    if (await js('!!document.querySelector(".settings-directory > .settings-back")'))
      await tap('.settings-directory > .settings-back');
  }
  await tap(marker);
  await wait('new URL(location.href).searchParams.get("section")===' + JSON.stringify(section));
}
async function geometry(page, width) {
  await viewport(width, 844);
  await delay(100);
  const data = await js(
    `({page:${JSON.stringify(page)},width:innerWidth,overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),scale:getComputedStyle(document.documentElement).zoom})`,
  );
  assert.ok(data.overflow <= 1, JSON.stringify(data));
  evidence.push(data);
}
try {
  await viewport(390, 844);
  await nav('/');
  await js(
    "localStorage.setItem('salesdrone.guestDisplayScale','100');localStorage.setItem('salesdrone.guestBookMode','false');localStorage.setItem('salesdrone.guestFontStyle','standard');localStorage.setItem('salesdrone.theme','light')",
  );
  await nav('/');
  assert.equal(
    await js('!!document.querySelector(".login-top .enterprise-brand")'),
    false,
  );
  await screenshot('test-results/mobile/login.jpg');
  await action('Explore the demo');
  await action('Leads');
  await wait('!!document.querySelector(".worksheet-lead-card")');
  for (const width of [320, 360, 390, 430, 600, 767, 768, 1000, 1280, 1440]) {
    await geometry('leads', width);
    const sizes = await js(
      '({section:document.querySelector(".leads-table").getBoundingClientRect().width,area:document.querySelector(".leads-main").getBoundingClientRect().width-parseFloat(getComputedStyle(document.querySelector(".leads-main")).paddingLeft)-parseFloat(getComputedStyle(document.querySelector(".leads-main")).paddingRight)})',
    );
    assert.ok(
      sizes.section / sizes.area > 0.98,
      'Lead section must fill its grid area: ' +
        JSON.stringify({ width, ...sizes }),
    );
  }
  assert.equal(await js('!!document.querySelector(".topbar .enterprise-brand")'), false);
  for (const width of [320, 390, 600, 767]) {
    await viewport(width, 844);
    await wait('!!document.querySelector(".mobile-lead-search-trigger")');
    const boxes = await js(`([...document.querySelectorAll('.worksheet-lead-card')].slice(0,6).map(e=>{const n=e.querySelector('strong').getBoundingClientRect(),b=e.getBoundingClientRect();return {select:!!e.querySelector('.mobile-lead-select'),nameLeft:n.left,left:b.left}}))`);
    assert.ok(boxes.every(r=>!r.select && r.nameLeft>=r.left && Math.abs(r.nameLeft-boxes[0].nameLeft)<1), JSON.stringify({width,boxes}));
    assert.equal(await js('!!document.querySelector(".batch-toolbar")'),false);
    evidence.push({case:'mobile-leads-without-batch-selection',width,result:'passed'});
  }
  await viewport(390, 844);
  await tap('.mobile-lead-search-trigger');
  await wait('document.activeElement?.type==="search"');
  await send('Input.insertText', {text:'Ananya'});
  await action('Search');
  await wait('document.activeElement?.matches(".mobile-lead-search-trigger[data-active]")');
  await tap('.mobile-lead-search-trigger');
  await wait('document.activeElement?.value==="Ananya"');
  await action('Clear search');
  await wait('!document.querySelector(".mobile-lead-search-trigger[data-active]")');
  await screenshot('test-results/mobile/leads.jpg');
  const header = await js(
    "({subtitle:getComputedStyle(document.querySelector('.leads-main > .page-title p')).display,chips:getComputedStyle(document.querySelector('.stage-tabs')).display,toolbar:!!document.querySelector('.page-title .mobile-lead-filter-trigger + .mobile-lead-search-trigger'),inline:getComputedStyle(document.querySelector('.lead-search-row')).display,listTop:document.querySelector('.leads-table').getBoundingClientRect().top})",
  );
  assert.equal(header.subtitle, 'none');
  assert.equal(header.chips, 'none');
  assert.ok(header.toolbar);
  assert.equal(header.inline, 'none');
  assert.ok(header.listTop < 380, JSON.stringify(header));
  await action('More lead actions');
  await wait("!!document.querySelector('.lead-action-popover.open')");
  await send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Escape',
    code: 'Escape',
  });
  await send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'Escape',
    code: 'Escape',
  });
  await delay(100);
  assert.equal(
    await js(
      "document.querySelector('.lead-action-popover').classList.contains('open')",
    ),
    false,
  );

  // Edits stay drafts until Apply, cancel discards them, and dialog returns focus.
  const before = await js(
    'document.querySelectorAll(".worksheet-lead-card").length',
  );
  await tap('.mobile-lead-filter-trigger');
  await wait('!!document.querySelector("[role=dialog]")');
  await select('[role=dialog] [aria-label="Filter stage"]', 'Working');
  await action('Cancel');
  assert.equal(
    await js('document.querySelectorAll(".worksheet-lead-card").length'),
    before,
  );
  assert.equal(
    await js(
      'document.activeElement===document.querySelector(".mobile-lead-filter-trigger")',
    ),
    true,
  );
  await tap('.mobile-lead-filter-trigger');
  await select('[role=dialog] [aria-label="Filter stage"]', 'Working');
  await screenshot('test-results/mobile/filters.jpg');
  await action('Apply filters');
  await wait('!document.querySelector("[role=dialog]")');
  assert.equal(
    await js('document.querySelectorAll(".worksheet-lead-card").length'),
    24,
  );
  await tap('.mobile-lead-filter-trigger');
  await action('Reset');
  await action('Apply filters');
  await wait('document.querySelectorAll(".worksheet-lead-card").length===30');
  evidence.push({
    case: 'mobile-filter-apply-cancel-reset-focus',
    passed: true,
  });
  // Open a full lead at phone size and verify each tab and its content bounds.
  await tap('.worksheet-card-open');
  await wait('!!document.querySelector(".full-lead-page")');
  assert.equal(await js("document.querySelectorAll('.full-lead-page .detail-profile h1').length"), 1);
  evidence.push({case:'lead-record-heading', result:'passed'});
  for (const width of [320, 390, 600, 768])
    await geometry('lead-record', width);
  await viewport(390, 844);
  await screenshot('test-results/mobile/lead-record.jpg');
  for (const tab of ['All', 'Comments', 'Calls', 'Tasks', 'Files', 'Review']) {
    await js(
      `[...document.querySelectorAll('.lead-work-tabs button')].find(e=>e.textContent.trim()===${JSON.stringify(tab)}).click()`,
    );
    await delay(100);
    await geometry('lead-tab-' + tab, 390);
  }
  await action('Back to leads');
  await action('Today');
  for (const width of [320, 360, 390, 430, 600, 768])
    await geometry('dashboard', width);
  await viewport(390, 844);
  await screenshot('test-results/mobile/dashboard.jpg');
  assert.equal(await js("document.querySelectorAll('.pipeline-funnel .dashboard-category-control select').length"), 1);
  evidence.push({case:'dashboard-field-control-in-chart', result:'passed'});
  await action('Open notifications');
  await geometry('notifications-overlay', 390);
  await screenshot('test-results/mobile/notifications.jpg');
  await action('Close notifications');
  await action('Leads');
  await action('More lead actions');
  await action('Export Excel');
  for (const width of [320, 390, 600]) await geometry('lead-export', width);
  await viewport(390, 844);
  await action('Close dialog');
  assert.equal(
    await js(
      "document.activeElement===document.querySelector('.lead-more-button')",
    ),
    true,
    'Export returns focus to More actions',
  );
  await action('Tasks');
  for (const width of [320, 360, 390, 600, 767, 768, 1024, 1280, 1920]) {
    await geometry('tasks', width);
    const layout = await js(`(()=>{
      const page=document.querySelector('.tasks-page');
      const panel=document.querySelector('.tasks-panel');
      const styles=getComputedStyle(page);
      const rows=[...document.querySelectorAll('.task-row')];
      const head=panel.querySelector('.task-list-head');
      const table=head.getClientRects().length>0;
      const edges=[...head.children].map(e=>e.getBoundingClientRect().left);
      return {compact:matchMedia('(max-width:767.99px)').matches, ratio:panel.getBoundingClientRect().width/(page.getBoundingClientRect().width-parseFloat(styles.paddingLeft)-parseFloat(styles.paddingRight)),
        picker:getComputedStyle(document.querySelector('.task-status-picker')).display,
        subtitle:getComputedStyle(document.querySelector('.tasks-page .page-title p')).display,
        aligned:rows.every(e=>{
          const row=e.getBoundingClientRect();
          const bounds=s=>e.querySelector(s)?.getBoundingClientRect();
          const inside=s=>!bounds(s) || bounds(s).right<=row.right+1;
          return inside('.task-menu summary') && inside('.task-reschedule') &&
            (table ? ['.task-body','.task-lead','.task-responsible','.task-time'].every((s,i)=>Math.abs(bounds(s).left-edges[i+1])<1) : bounds('.task-people').top>=bounds('.task-body').bottom);
        }),
        symbol:document.querySelector('.task-check-symbol').getBoundingClientRect().width,
        target:document.querySelector('.task-check').getBoundingClientRect().width};
    })()`);
    assert.ok(layout.ratio > 0.98, JSON.stringify({width,...layout}));
    assert.ok(layout.aligned, JSON.stringify({width, ...layout}));
    assert.ok(layout.symbol <= 24, 'Completion symbol stays visually small');
    if (layout.compact) {
      assert.equal(layout.subtitle, 'none');
      assert.notEqual(layout.picker, 'none');
      assert.ok(layout.target >= 44);
    }
  }
  await viewport(390, 844);
  await screenshot('test-results/mobile/tasks.jpg');
  await js(
    `(()=>{const menus=document.querySelectorAll('.task-menu');const e=menus[menus.length-1];e.setAttribute('data-edge-menu','true');const r=e.querySelector('summary').getBoundingClientRect();const n=document.querySelector('.bottom-nav').getBoundingClientRect();window.scrollBy(0,r.bottom-(n.top-8));})()`,
  );
  await tap('[data-edge-menu] summary');
  const menu = await js(
    "document.querySelector('.task-menu[open] > div').getBoundingClientRect().toJSON()",
  );
  assert.ok(
    menu.left >= 0 && menu.right <= 390 && menu.top >= 0 && menu.bottom <= 780,
    JSON.stringify(menu),
  );
  await send('Input.dispatchKeyEvent', {type:'keyDown', key:'Escape', code:'Escape', windowsVirtualKeyCode:27});
  await send('Input.dispatchKeyEvent', {type:'keyUp', key:'Escape', code:'Escape', windowsVirtualKeyCode:27});
  assert.equal(await js('!!document.querySelector(".task-menu[open]")'), false);
  assert.equal(await js('document.activeElement.matches(".task-menu summary")'), true);
  await js('window.scrollTo(0,0)');
  for (const name of ['Edit task', 'Reschedule', 'Delete task']) {
    if (name !== 'Reschedule') await tap('.task-menu summary');
    await action(name);
    await wait('!!document.querySelector("[role=dialog]")');
    assert.equal(await js('!!document.querySelector(".task-menu[open]")'), false);
    await geometry('task-menu-' + name, 320);
    await action('Close dialog');
    await viewport(390, 844);
  }
  await tap('.task-menu summary');
  await tap('.tasks-page h1');
  assert.equal(await js('!!document.querySelector(".task-menu[open]")'), false, 'Outside tap dismisses');
  await select('.task-status-picker select', 'Completed');
  assert.equal(await js('document.querySelectorAll(".task-row").length'), 0);
  await select('.task-status-picker select', 'Pending');
  await tap('.task-row .task-check');
  await wait('!!document.querySelector("[role=dialog] textarea[name=comment]")');
  assert.equal(await js('document.querySelector("[role=dialog] textarea[name=comment]").required'),true);
  await js('document.querySelector("[role=dialog] textarea[name=comment]").value="Fictional task completed";document.querySelector("[role=dialog] form").requestSubmit()');
  await wait('document.querySelectorAll(".task-row").length===4');
  await select('.task-status-picker select', 'Completed');
  await wait('document.querySelectorAll(".task-row").length===1');
  assert.equal(await js('document.querySelector(".task-check").disabled'), true);
  await tap('.task-menu summary');
  assert.deepEqual(await js('[...document.querySelectorAll(".task-menu[open] button")].map(e=>e.textContent.trim())'), ['Edit task','Delete task']);
  await tap('.tasks-page h1');
  await tap('.task-row .task-body');
  await action('Reopen task');
  await wait('!!document.querySelector("[role=dialog] textarea[name=comment]")');
  await js('document.querySelector("[role=dialog] textarea[name=comment]").value="Fictional task reopened";document.querySelector("[role=dialog] form").requestSubmit()');
  await wait('!document.querySelector("[role=dialog]")');
  await select('.task-status-picker select', 'Pending');
  // The reopened fixture is the owned task. Menu hit testing is covered above.
  await wait('document.querySelectorAll(".task-row").length===5');
  await js(`[...document.querySelectorAll('.task-menu button')].find(button => button.textContent.trim() === 'Cancel task').click()`);
  await wait('document.querySelectorAll(".task-row").length===4');
  await select('.task-status-picker select', 'Cancelled');
  await wait('document.querySelectorAll(".task-row").length===1');
  await tap('.task-menu summary');
  assert.deepEqual(await js('[...document.querySelectorAll(".task-menu[open] button")].map(e=>e.textContent.trim())'), ['Edit task','Delete task']);
  await tap('.tasks-page h1');
  await select('.task-status-picker select', 'Pending');
  evidence.push({case:'task-status-menu-actions', result:'passed', fixture:'synthetic in-memory only'});

  for (const [width, height] of [[320, 540], [390, 720], [599, 720]]) {
    await viewport(width, height);
    await js('window.scrollTo(0, 0)');
    await action('Open navigation');
    await wait(`!!document.elementFromPoint(100, ${height - 120})?.closest('.sidebar.mobile-open')`);
    const layout = await js(`(() => {
      const drawer = document.querySelector('.sidebar.mobile-open');
      return {overflow: getComputedStyle(drawer).overflowY, range: drawer.scrollHeight - drawer.clientHeight,
        navigationOverflow: getComputedStyle(drawer.querySelector('.navigation-scroll')).overflowY};
    })()`);
    assert.equal(layout.overflow, 'auto');
    assert.equal(layout.navigationOverflow, 'visible');
    assert.ok(layout.range > 0, JSON.stringify({width, height, ...layout}));
    await send('Input.synthesizeScrollGesture', {
      x: 100, y: height - 120, yDistance: -1600, gestureSourceType: 'touch',
    });
    await wait(`(() => {
      const drawer = document.querySelector('.sidebar.mobile-open');
      return drawer.scrollHeight - drawer.clientHeight - drawer.scrollTop <= 1;
    })()`);
    const end = await js(`(() => {
      const drawer = document.querySelector('.sidebar.mobile-open');
      const last = drawer.querySelector('.sidebar-attribution').getBoundingClientRect();
      const settings = drawer.querySelector('button[aria-label=Settings]').getBoundingClientRect();
      return {remaining: drawer.scrollHeight - drawer.clientHeight - drawer.scrollTop,
        last: last.bottom, settings: settings.bottom, drawer: drawer.getBoundingClientRect().bottom};
    })()`);
    assert.ok(end.remaining <= 1 && end.last <= end.drawer && end.settings <= end.drawer, JSON.stringify(end));
    await tap('.sidebar button[aria-label=Settings]');
    await wait('!!document.querySelector(".settings-page") && !document.querySelector(".sidebar.mobile-open")');
    evidence.push({case:'mobile-drawer-scrolls-to-footer',width,height,result:'passed'});
  }
  await viewport(390, 844);
  console.log(
    'Settings controls',
    await js(
      'JSON.stringify([...document.querySelectorAll("select")].map(e=>({cls:e.className,label:e.getAttribute("aria-label")})))',
    ),
  );
  await settingsSection('appearance');
  await wait(
    '!!document.querySelector("[aria-describedby=display-scale-help]")',
  );
  for (const scale of [85, 90, 100, 110, 125]) {
    await select('[aria-describedby=display-scale-help]', String(scale));
    if (await js('!!document.querySelector(".settings-save-actions button[type=submit]:enabled")')) await action('Save changes');
    await delay(200);
    const info = await js(
      '({zoom:Number(getComputedStyle(document.documentElement).zoom),overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),target:document.querySelector(".bottom-nav button").getBoundingClientRect().height,nav:document.querySelector(".bottom-nav").getBoundingClientRect().height})',
    );
    assert.ok(
      Math.abs(info.zoom - scale / 100) < 0.01,
      JSON.stringify({ scale, ...info }),
    );
    assert.ok(info.target >= 44, JSON.stringify(info));
    assert.ok(info.overflow <= 1, JSON.stringify(info));
    evidence.push({ case: 'mobile-display-scale', scale, ...info });
    const icons = await js(
      "[...document.querySelectorAll('.topbar .icon-button,.topbar .theme-toggle')].filter(e=>e.getClientRects().length).map(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height}))",
    );
    assert.ok(
      icons.every((r) => r.width >= 44 && r.height >= 44),
      JSON.stringify({ scale, icons }),
    );
    await action('Leads');
    for (const width of [320, 390]) {
      await geometry('leads-header-scale-' + scale, width);
      const placement = await js(`(()=>{const e=document.querySelector('.mobile-lead-search-trigger'),r=e.getBoundingClientRect();return {left:r.left,right:r.right,viewport:innerWidth,target:r.width,selection:!!document.querySelector('.mobile-lead-select')}})()`);
      assert.ok(placement.left>=0 && placement.right<=placement.viewport+1 && placement.target>=44 && !placement.selection,JSON.stringify({scale,width,placement}));
    }
    await action('Tasks');
    for (const width of [320, 390, 768]) await geometry('tasks-scale-' + scale, width);
    await viewport(390, 844);
    const taskBounds = await js(`(()=>{const r=document.querySelector('.task-row');const b=r.getBoundingClientRect();const m=r.querySelector('.task-menu summary').getBoundingClientRect();const c=r.querySelector('.task-check').getBoundingClientRect();return {left:b.left,right:b.right,menuRight:m.right,target:c.width};})()`);
    assert.ok(taskBounds.left >= 0 && taskBounds.right <= 390 && taskBounds.menuRight <= 390 && taskBounds.target >= 44, JSON.stringify({scale,...taskBounds}));
    // Return navigation is programmatic; the saved preference form and task geometry are real.
    await js("document.querySelector('.sidebar button[aria-label=Settings]').click()");
    await settingsSection('appearance');

  }
  await select('[aria-describedby=display-scale-help]', '100');
  await action('Save changes');
  await screenshot('test-results/mobile/settings.jpg');
  // Real admin components stay isolated: no token/device/membership or backend writes.
  await nav('/design-admin.html');
  for (const name of ['New enquiry', 'Log call', 'Reminder', 'Edit task']) {
    await action(name);
    await wait('!!document.querySelector("[role=dialog]")');
    for (const width of [320, 390, 600]) await geometry('form-' + name, width);
    await viewport(390, 844);
    if (name === 'New enquiry')
      await screenshot('test-results/mobile/new-enquiry.jpg');
    await action('Close dialog');
  }
  for (const section of [
    'appearance',
    'workspace',
    'developer',
    'access',
    'fields',
    'field-order',
    'lead-header',
    'choices',
    'scoring',
    'ai',
    'notifications',
    'reminders',
    'about',
  ]) {
    await settingsSection(section);
    for (const width of [320, 390, 600])
      await geometry('admin-' + section, width);
  }
  await viewport(390, 844);
  await action('Import preview');
  for (const width of [320, 390, 600, 844]) await geometry('imports', width);
  await screenshot('test-results/mobile/imports.jpg');
  assert.equal(await js("document.querySelectorAll('.import-steps [aria-current=step]').length"), 1);
  await action('View history');
  await wait("document.activeElement.id==='import-job-history'");
  evidence.push({case:'import-step-and-history-focus', result:'passed'});
  await nav('/api/docs');
  await wait('!!document.querySelector(".swagger-ui .info")');
  for (const width of [320, 390, 600, 844]) await geometry('api-portal', width);
  await viewport(390, 844);
  await screenshot('test-results/mobile/api-portal.jpg');
  await nav('/');
  for (const mode of [
    { name: 'dark', book: false, theme: 'dark' },
    { name: 'book-day', book: true, theme: 'light' },
    { name: 'book-night', book: true, theme: 'dark' },
  ]) {
    await js(
      `localStorage.setItem('salesdrone.guestBookMode','${mode.book}');localStorage.setItem('salesdrone.theme','${mode.theme}')`,
    );
    await nav('/');
    await action('Explore the demo');
    await action('Leads');
    for (const width of [320, 390, 768])
      await geometry('palette-' + mode.name, width);
    await viewport(390, 844);
    await screenshot('test-results/mobile/' + mode.name + '.jpg');
    if (mode.book) {
      assert.equal(await js('document.querySelectorAll("#main-content .book-index-page").length'), 1);
      assert.ok(await js(`(() => {
        document.querySelector('#main-content .book-page-controls button:last-child').click();
        const layer = document.querySelector('.book-turn-layer[inert]');
        return !!layer?.querySelector('.book-index-page') &&
          !layer.querySelector('.topbar, .page-title, .mobile-lead-search-trigger, .mobile-lead-filter-trigger, .book-page-controls');
      })()`));
      await wait('document.querySelector("#main-content .book-page-number")?.textContent.startsWith("Page 2 of ")');
      await wait('!document.querySelector(".book-turn-layer")');
      const leadId = await js('document.querySelector(".book-index-link").dataset.bookLead');
      await tap('.book-index-link');
      await wait('!!document.querySelector(".full-lead-page")');
      await action('Back to leads');
      await wait('document.activeElement?.dataset.bookLead===' + JSON.stringify(leadId));
      assert.equal(await js('document.querySelector(".book-page-number").textContent.startsWith("Page 2 of ")'), true);
      evidence.push({case:'book-sheet-navigation-and-focus',width:390,mode:mode.name,result:'passed'});
    }
    await action('Tasks');
    for (const width of [320, 390, 768]) await geometry('tasks-palette-' + mode.name, width);
    await viewport(390, 844);
    await screenshot('test-results/mobile/tasks-' + mode.name + '.jpg');
  }
  await js(
    "localStorage.setItem('salesdrone.guestBookMode','false');localStorage.setItem('salesdrone.theme','light')",
  );
  await nav('/');
  await writeFile(
    'test-results/mobile-review.json',
    JSON.stringify(
      {
        version,
        checks: evidence,
        limitations:
          'Synthetic Chromium viewports; not physical devices or live backend writes.',
      },
      null,
      2,
    ),
  );
  console.log(
    'Mobile layout and interaction review passed:',
    evidence.length,
    'checks',
  );
} finally {
  await close();
}
