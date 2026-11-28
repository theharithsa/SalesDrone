import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const publicAssets = new URL('../apps/web/public/', import.meta.url);
const readAsset = (path: string) => readFileSync(new URL(path.replace(/^\//, ''), publicAssets));
const manifest = JSON.parse(readAsset('manifest.webmanifest').toString());

test('the install manifest has standalone scope and separate real maskable artwork', () => {
  assert.equal(manifest.scope, '/');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, '/today');
  const purposes = new Set<string>();
  for (const icon of manifest.icons) {
    const png = readAsset(icon.src);
    assert.equal(png.readUInt32BE(0), 0x89504e47);
    assert.equal(icon.sizes, `${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`);
    purposes.add(icon.sizes + ':' + icon.purpose);
  }
  assert.deepEqual([...purposes].sort(), ['192x192:any', '512x512:any', '512x512:maskable']);
});

test('the browser and notification surfaces resolve their expected branded assets', () => {
  const html = readFileSync(new URL('../apps/web/index.html', import.meta.url), 'utf8');
  assert.match(html, /rel="apple-touch-icon" sizes="180x180" href="\/apple-touch-icon.png"/);
  const icon = readAsset('apple-touch-icon.png');
  assert.equal(icon.readUInt32BE(16), 180);
  assert.equal(icon.readUInt32BE(20), 180);
  const worker = readAsset('firebase-messaging-sw.js').toString();
  assert.match(worker, /badge:'\/notification-badge\.png'/);
  assert.equal(readAsset('notification-badge.png').readUInt32BE(16), 96);
});
