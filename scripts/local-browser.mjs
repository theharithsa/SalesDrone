/** Local synthetic UI review via an already-installed isolated Chromium/CDP.
 * No browser/package download. Never connect a personal signed-in browser profile.
 * Start Chromium with a fresh profile and --remote-debugging-port=9337.
 * Outputs remain in test-results for review before curated screenshot publication.
 */
import { writeFile, readFile } from 'node:fs/promises';
const targets = await (await fetch('http://127.0.0.1:9337/json/list')).json();
const target = targets.find(
  (t) =>
    t.type === 'page' &&
    (t.url === 'about:blank' || t.url.startsWith('http://127.0.0.1:5180/')),
);
if (!target) throw Error('Use an isolated local review browser');
export const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.onopen = resolve;
  socket.onerror = reject;
});
let id = 0;
const pending = new Map();
socket.onmessage = ({ data }) => {
  const message = JSON.parse(data);
  if (message.id) {
    const task = pending.get(message.id);
    pending.delete(message.id);
    message.error
      ? task?.reject(Error(JSON.stringify(message.error)))
      : task?.resolve(message.result);
  }
};
export function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const key = ++id;
    pending.set(key, { resolve, reject });
    socket.send(JSON.stringify({ id: key, method, params }));
  });
}
export async function js(expression) {
  const r = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
}
export const delay = (ms) => new Promise((r) => setTimeout(r, ms));
export async function wait(expression) {
  for (let i = 0; i < 80; i++) {
    if (await js(expression)) return;
    await delay(100);
  }
  throw Error('Timed out: ' + expression);
}
export async function viewport(width, height = 900) {
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send('Emulation.setTouchEmulationEnabled', {
    enabled: width < 600,
    maxTouchPoints: width < 600 ? 5 : 1,
  });
}
export async function nav(path) {
  await send('Page.navigate', { url: 'http://127.0.0.1:5180' + path });
  await wait('document.readyState === "complete"');
  await js('document.fonts.ready.then(()=>true)');
  await delay(500);
}
export async function click(text) {
  await js(
    `(()=>{const el=[...document.querySelectorAll('button,a,summary')].find(e=>e.textContent.trim()===${JSON.stringify(text)}||e.getAttribute('aria-label')===${JSON.stringify(text)});if(!el)throw Error('Missing action '+${JSON.stringify(text)});el.click();})()`,
  );
  await delay(350);
}
export async function screenshot(file) {
  await js('document.fonts.ready.then(()=>true)');
  await delay(250);
  const r = await send('Page.captureScreenshot', {
    format: 'jpeg',
    quality: 86,
    fromSurface: true,
  });
  await writeFile(file, Buffer.from(r.data, 'base64'));
}
export async function close() {
  socket.close();
}
