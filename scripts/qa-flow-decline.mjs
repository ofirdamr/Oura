// QA script: tests the declined-consent flow (fix #1) and takes a screenshot
// of the gallery opened in "declined" mode (general gallery, no personal photos).
//
// Flow: gallery-entry?code=WED-2024 (auto-submits) → /consent → click decline
//       → /gallery?declined=1 → screenshot

import { spawnSync } from 'node:child_process';
import { readFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const CA = '/root/.ccr/ca-bundle.crt';
const BASE = 'https://oura-web.oura-events.workers.dev';
const out = process.argv[2] || '/tmp/qa-decline.png';

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
  // Step 1: gallery-entry with code → auto-submits → redirects to /consent
  console.error('Step 1: navigating to gallery-entry?code=WED-2024...');
  await page.goto(`${BASE}/gallery-entry?code=WED-2024`, {
    waitUntil: 'domcontentloaded',
    timeout: 40000,
  });
  // Wait for redirect to /consent
  await page.waitForURL('**/consent**', { timeout: 15000 });
  console.error('Step 2: reached /consent, waiting for page to settle...');
  await page.waitForTimeout(2000);

  // Step 3: click the decline button
  const declineBtn = page.getByText('לא תודה, אני אעיין בגלריה הכללית');
  await declineBtn.waitFor({ state: 'visible', timeout: 8000 });
  console.error('Step 3: clicking decline button...');
  await declineBtn.click();

  // Step 4: wait for redirect to /gallery?declined=1
  await page.waitForURL('**/gallery**declined**', { timeout: 15000 });
  console.error('Step 4: reached gallery, waiting for photos to load...');
  await page.waitForTimeout(4000);

  await page.screenshot({ path: out, fullPage: true });
  const title = await page.title();
  console.log(JSON.stringify({ ok: true, url: page.url(), title, out, consoleErrors: errors.slice(0, 10) }));
} catch (e) {
  // Take screenshot of whatever state we're in for diagnosis
  try { await page.screenshot({ path: out, fullPage: true }); } catch {}
  console.log(JSON.stringify({ ok: false, url: page.url(), error: e.message.split('\n')[0], consoleErrors: errors.slice(0, 10) }));
} finally {
  await browser.close();
  process.exit(0);
}
