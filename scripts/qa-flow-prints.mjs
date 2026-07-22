// QA script: verifies fixes #2 (photo preview not black) and #3 (button label)
// on the premium-prints page.
//
// Flow: gallery-entry?code=WED-2024 → /consent → decline → /gallery?declined=1
//       → grab first photo from DOM → /premium-prints?...

import { spawnSync } from 'node:child_process';
import { readFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const CA = '/root/.ccr/ca-bundle.crt';
const BASE = 'https://oura-web.oura-events.workers.dev';
const API  = 'https://oura-api.oura-events.workers.dev';
const out  = process.argv[2] || '/tmp/qa-prints.png';

function curlFetch(req) {
  const bodyFile = join(tmpdir(), 'qa-body-' + Math.random().toString(36).slice(2));
  const headFile = join(tmpdir(), 'qa-head-' + Math.random().toString(36).slice(2));
  const args = [
    '-sS', '--cacert', CA, '--compressed',
    '-X', req.method(),
    '-o', bodyFile, '-D', headFile,
    '--max-time', '30',
  ];
  const headers = req.headers();
  for (const [k, v] of Object.entries(headers)) {
    if (['host', 'content-length', 'connection', 'accept-encoding'].includes(k.toLowerCase())) continue;
    args.push('-H', `${k}: ${v}`);
  }
  const postData = req.postDataBuffer();
  if (postData) args.push('--data-binary', '@-');
  args.push(req.url());

  const res = spawnSync('curl', args, {
    input: postData || undefined,
    maxBuffer: 64 * 1024 * 1024,
  });
  try {
    if (res.status !== 0) return null;
    const body = readFileSync(bodyFile);
    const rawHead = readFileSync(headFile, 'utf8');
    const blocks = rawHead.trim().split(/\r?\n\r?\n/);
    const last = blocks[blocks.length - 1].split(/\r?\n/);
    const statusLine = last[0];
    const status = parseInt(statusLine.split(' ')[1], 10) || 200;
    const respHeaders = {};
    for (const line of last.slice(1)) {
      const i = line.indexOf(':');
      if (i > 0) {
        const k = line.slice(0, i).trim().toLowerCase();
        if (['content-encoding', 'content-length', 'transfer-encoding', 'connection'].includes(k)) continue;
        respHeaders[k] = line.slice(i + 1).trim();
      }
    }
    return { status, headers: respHeaders, body };
  } catch {
    return null;
  } finally {
    try { unlinkSync(bodyFile); } catch {}
    try { unlinkSync(headFile); } catch {}
  }
}

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--disable-quic',
    '--disable-background-networking', '--disable-component-update'],
});
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  locale: 'he-IL',
  ignoreHTTPSErrors: true,
});

await ctx.route('**/*', async (route) => {
  const req = route.request();
  const r = curlFetch(req);
  if (!r) return route.abort();
  await route.fulfill({ status: r.status, headers: r.headers, body: r.body });
});

const page = await ctx.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERR: ' + e.message));

try {
  // Step 1: go through gallery-entry → consent → decline → gallery
  console.error('Step 1: gallery-entry?code=WED-2024...');
  await page.goto(`${BASE}/gallery-entry?code=WED-2024`, { waitUntil: 'domcontentloaded', timeout: 40000 });
  await page.waitForURL('**/consent**', { timeout: 15000 });
  await page.waitForTimeout(1500);

  const declineBtn = page.getByText('לא תודה, אני אעיין בגלריה הכללית');
  await declineBtn.waitFor({ state: 'visible', timeout: 8000 });
  console.error('Step 2: declining consent...');
  await declineBtn.click();

  await page.waitForURL('**/gallery**declined**', { timeout: 15000 });
  await page.waitForTimeout(3000);

  // Step 3: grab guest token and first photo data from the page
  console.error('Step 3: extracting session token from localStorage...');
  const session = await page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem('oura.guestSession.v1') || 'null');
    } catch { return null; }
  });
  console.error('Session:', JSON.stringify(session));

  // Grab the first photo img src and data-photo-id from the grid
  const firstPhotoSrc = await page.evaluate(() => {
    const imgs = document.querySelectorAll('button[aria-label="פתיחת התמונה"] img');
    return imgs[0]?.src ?? null;
  });
  console.error('First photo src:', firstPhotoSrc);

  if (!session?.token || !firstPhotoSrc) {
    throw new Error('Could not get session token or photo URL');
  }

  // Step 4: navigate to premium-prints with a real photo
  // Extract photo_id from the src URL (last path segment before query)
  let photoId = '';
  try {
    const srcUrl = new URL(firstPhotoSrc);
    // src is like /media/<key> or the full Worker URL
    // key is like "events/.../photos/<uuid>.jpg"
    const pathParts = srcUrl.pathname.split('/').filter(Boolean);
    // photo_id needs to come from the gallery response, not the URL; use token to query
    photoId = 'from-gallery';
  } catch {}

  // Directly fetch the gallery JSON to get real photo IDs
  const galleryRes = spawnSync('curl', [
    '-sS', '--cacert', CA,
    '-H', `Authorization: Bearer ${session.token}`,
    `${API}/gallery/${encodeURIComponent(session.token)}`,
  ], { maxBuffer: 8 * 1024 * 1024 });

  let photoUrl = firstPhotoSrc;
  if (galleryRes.status === 0) {
    try {
      const galleryData = JSON.parse(galleryRes.stdout.toString());
      const firstPhoto = galleryData?.photos?.[0];
      if (firstPhoto) {
        photoId = firstPhoto.id;
        photoUrl = firstPhoto.url || firstPhotoSrc;
        console.error('Got photo from gallery API:', photoId, photoUrl);
      }
    } catch (e) {
      console.error('Gallery parse error:', e.message);
    }
  }

  const printsUrl = `${BASE}/premium-prints?photo_id=${encodeURIComponent(photoId)}&photo_url=${encodeURIComponent(photoUrl)}&token=${encodeURIComponent(session.token)}`;
  console.error('Step 4: navigating to premium-prints...');
  await page.goto(printsUrl, { waitUntil: 'domcontentloaded', timeout: 40000 });
  await page.waitForTimeout(3000);

  await page.screenshot({ path: out, fullPage: true });
  console.log(JSON.stringify({ ok: true, url: page.url(), title: await page.title(), out, consoleErrors: errors.slice(0, 10) }));
} catch (e) {
  try { await page.screenshot({ path: out, fullPage: true }); } catch {}
  console.log(JSON.stringify({ ok: false, url: page.url?.() ?? 'unknown', error: e.message.split('\n')[0], consoleErrors: errors.slice(0, 10) }));
} finally {
  await browser.close();
  process.exit(0);
}
