// Oura QA screenshot launcher — renders live pages in real Chromium from behind
// the Claude Code agent proxy.
//
// Why the obvious approach fails: the agent proxy MITM-re-terminates TLS using
// its own CA (/root/.ccr/ca-bundle.crt). curl/Node trust it via
// NODE_EXTRA_CA_CERTS, but Chromium validates against its own NSS store, does
// NOT see that CA, gets ERR_CERT_AUTHORITY_INVALID (netlog net_error -202), and
// the proxy then resets the sockets — so pointing Chromium at the proxy yields
// ERR_CONNECTION_RESET on every navigation, no matter the flags.
//
// The fix: DON'T give Chromium a proxy. Intercept every request via Playwright's
// routing and fetch the bytes with curl (which does trust the proxy CA and
// tunnels correctly). Chromium renders real, live pages; the network happens in
// curl. Fully self-contained, no CA install, no NSS surgery — works forever.
//
// Usage:  node scripts/qa-shot.mjs <url> <out.png> [mobile|desktop]

import { spawnSync } from 'node:child_process';
import { readFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const CA = '/root/.ccr/ca-bundle.crt';

const url = process.argv[2];
const out = process.argv[3] || '/tmp/qa/shot.png';
const form = process.argv[4] || 'mobile';
if (!url) { console.error('usage: qa-shot.mjs <url> <out.png> [mobile|desktop]'); process.exit(1); }
const viewport = form === 'desktop' ? { width: 1440, height: 900 } : { width: 390, height: 844 };

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
    // last header block (after redirects)
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
  viewport, deviceScaleFactor: 2, locale: 'he-IL', ignoreHTTPSErrors: true,
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
  const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 40000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: out, fullPage: true });
  console.log(JSON.stringify({ ok: true, url, status: resp && resp.status(), title: await page.title(), out, consoleErrors: errors.slice(0, 10) }));
} catch (e) {
  console.log(JSON.stringify({ ok: false, url, error: e.message.split('\n')[0], consoleErrors: errors.slice(0, 10) }));
} finally {
  await browser.close();
  process.exit(0);
}
