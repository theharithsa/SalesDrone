/** Synthetic theme-control review; uses the isolated browser described in local-browser.mjs. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { nav, viewport, js, send, wait, delay, screenshot, close, click } from './local-browser.mjs';
await mkdir('test-results/theme', { recursive: true });
const checks = [];
async function geometry(surface, width) {
  await viewport(width, 844);
  await delay(100);
  assert.equal(await js('!!document.querySelector(".topbar .enterprise-brand")'), false);
  const r = await js(`(()=>{const e=document.querySelector('.theme-toggle'),b=e.getBoundingClientRect();return {width:innerWidth,scale:getComputedStyle(document.documentElement).zoom,left:b.left,right:b.right,height:b.height,toggleWidth:b.width,overflow:document.documentElement.scrollWidth-innerWidth,overlap:e.closest('.topbar-actions')?[...e.parentElement.children].filter(c=>c!==e&&c.getBoundingClientRect().width).some(c=>{const r=c.getBoundingClientRect();return r.left<b.right-1&&r.right>b.left+1}):false}})()`);
  assert.ok(r.left >= 0 && r.right <= width && r.height >= (width < 600 ? 44 : 32) && r.toggleWidth >= 44 && r.overflow <= 1 && !r.overlap, JSON.stringify({surface,...r}));
  checks.push({ surface, ...r });
}
async function touchToggle() {
  const point = await js(`(()=>{const r=document.querySelector('.theme-toggle').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await send('Input.dispatchTouchEvent', {type:'touchStart',touchPoints:[point]});
  await send('Input.dispatchTouchEvent', {type:'touchEnd',touchPoints:[]});
  await delay(350);
}
try {
  await viewport(390,844); await nav('/');
  await js("localStorage.setItem('salesdrone.theme','light');localStorage.setItem('salesdrone.guestDisplayScale','100');localStorage.setItem('salesdrone.guestBookMode','false')");
  await nav('/');
  for (const width of [320,360,390,600,768,1024,1280,1920]) await geometry('login',width);
  await viewport(390,844);
  await touchToggle();
  assert.equal(await js("document.querySelector('.theme-toggle').getAttribute('aria-label')"),'Switch to light mode');
  assert.equal(await js("localStorage.getItem('salesdrone.theme')"),'dark');
  await screenshot('test-results/theme/login-dark.jpg');
  await nav('/');
  assert.equal(await js("document.querySelector('.theme-toggle').dataset.night"),'true');
  await send('Page.bringToFront');
  await js("document.querySelector('.theme-toggle').focus()");
  for (const key of ['Enter',' ']) {
    const old = await js("document.querySelector('.theme-toggle').dataset.night");
    const code = key === ' ' ? 'Space' : 'Enter';
    const virtual = key === ' ' ? 32 : 13;
    await send('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:virtual,text:key==='Enter'?'\r':' '});
    await send('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:virtual});
    await delay(200);
    assert.notEqual(await js("document.querySelector('.theme-toggle').dataset.night"),old);
    assert.equal(await js("document.activeElement===document.querySelector('.theme-toggle')"),true);
  }
  checks.push({case:'touch-keyboard-and-local-persistence',result:'passed'});
  await js("localStorage.setItem('salesdrone.theme','system')");
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'light'}]});
  await nav('/');
  assert.equal(await js("document.querySelector('.theme-toggle').dataset.night"),'false');
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'dark'},{name:'prefers-reduced-motion',value:'reduce'}]});
  await wait("document.querySelector('.theme-toggle').dataset.night==='true'");
  assert.equal(await js("getComputedStyle(document.querySelector('.mode-toggle-indicator')).transitionDuration"),'0s');
  await touchToggle();
  assert.equal(await js("localStorage.getItem('salesdrone.theme')"),'light');
  checks.push({case:'system-change-explicit-override-reduced-motion',result:'passed'});
  await send('Emulation.setEmulatedMedia',{features:[]});
  await click('Explore the demo'); await click('Tasks');
  for (const width of [320,360,390,600,768,1024,1280,1920]) await geometry('workspace',width);
  await viewport(390,844);
  await screenshot('test-results/theme/workspace-light.jpg');
  await touchToggle();
  await screenshot('test-results/theme/workspace-dark.jpg');
  // Stored synthetic preference fixtures exercise the shared layout; no account save is claimed.
  for (const scale of [85,90,100,110,125]) {
    await js(`localStorage.setItem('salesdrone.guestDisplayScale','${scale}')`);
    await nav('/'); await click('Explore the demo'); await click('Tasks');
    for (const width of [320,390,768,1280]) await geometry('stored-scale-'+scale,width);
  }
  for (const theme of ['light','dark']) {
    await js(`localStorage.setItem('salesdrone.guestDisplayScale','100');localStorage.setItem('salesdrone.guestBookMode','true');localStorage.setItem('salesdrone.theme','${theme}')`);
    await nav('/'); await click('Explore the demo'); await click('Tasks');
    for (const width of [320,390,768,1280]) await geometry('book-'+theme,width);
    await viewport(390,844); await screenshot('test-results/theme/book-'+theme+'.jpg');
  }
  await writeFile('test-results/theme/review.json',JSON.stringify({version:'2.0.1',checks,limits:'Synthetic Chromium, stored scale fixtures, local demo only. No account persistence, physical-device or Safari certification.'},null,2));
  console.log('Theme review passed:',checks.length,'checks');
} finally { await close(); }
