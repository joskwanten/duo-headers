// Maakt de schermafbeeldingen voor de Chrome Web Store (1280x800) in docs/store/.
// Vereist Node en Playwright met Chromium:  npx playwright install chromium
// Gebruik: node scripts/store-screenshots.js
// Gebruikt alleen voorbeelddomeinen en lokale testservers.
const path = require('path');
const { chromium } = require('playwright');
const http = require('http');
const OUT = path.join(__dirname, '..', 'docs', 'store');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = `${b64({alg:'RS256',typ:'JWT'})}.${b64({sub:'testgebruiker-01', exp: Math.floor(Date.now()/1000)+900})}.c2lnbmF0dXJl`;
const auth = http.createServer((q, r) => { r.setHeader('Authorization', 'Bearer ' + jwt); r.end(); }).listen(8767);
const app = http.createServer((q, r) => r.end(`<html><body style="margin:0;font-family:system-ui;background:#f1f5f9">
<div style="background:#0f172a;color:#fff;padding:18px 32px;font-size:20px;font-weight:600">Mijn testomgeving</div>
<div style="padding:32px;max-width:720px"><h1 style="margin-top:0">Welkom terug</h1>
<div style="background:#fff;border-radius:10px;padding:20px;margin-bottom:16px;box-shadow:0 1px 3px #0002"><b>Overzicht</b><p style="color:#475569">Je bent ingelogd als testgebruiker. De headers uit je actieve profielen worden automatisch meegestuurd.</p></div>
<div style="background:#fff;border-radius:10px;padding:20px;box-shadow:0 1px 3px #0002"><b>Gegevens</b><p style="color:#475569">Laatste wijziging: vandaag</p></div></div>
<script>setTimeout(()=>fetch('http://api.localhost:8768/data').catch(()=>{}),300)</script></body></html>`)).listen(8768);
(async () => {
  const ext = path.join(__dirname, '..', 'src');
  const ctx = await chromium.launchPersistentContext('', { headless: true, channel: 'chromium', viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1,
    args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`] });
  let [sw] = ctx.serviceWorkers(); if (!sw) sw = await ctx.waitForEvent('serviceworker');
  const id = sw.url().split('/')[2];
  const ts = (on, url='', path='') => ({ enabled: on, url, method: 'GET', body: '', tokenPath: path, headerName: 'Authorization', valueTemplate: 'Bearer {{token}}' });
  await sw.evaluate(({ profiles }) => chrome.storage.local.set({ profiles, collapsedProfiles: ['p2', 'p3'] }), { profiles: [
    { id: 'p1', name: 'Acceptatie – testgebruiker', enabled: true, domains: ['localhost', 'acc.example.nl'],
      headers: [{ name: 'X-Omgeving', value: 'acceptatie', operation: 'set' }, { name: 'X-Testgebruiker', value: 'testgebruiker-01', operation: 'set' }],
      tokenService: ts(true, 'http://127.0.0.1:8767/clientjwt/rest/jwt', 'header:Authorization') },
    { id: 'p2', name: 'Test – beheerder', enabled: false, domains: ['test.example.nl', 'api.test.example.nl'], headers: [{ name: 'X-Rol', value: 'beheerder', operation: 'set' }], tokenService: ts(false) },
    { id: 'p3', name: 'Feature flags', enabled: true, domains: ['acc.example.nl'], headers: [{ name: 'X-Feature-Flags', value: 'nieuw-dashboard', operation: 'set' }, { name: 'Cache-Control', value: '', operation: 'remove' }], tokenService: ts(false) },
  ]});
  await new Promise(r => setTimeout(r, 2500));

  const page = await ctx.newPage();
  await page.goto(`chrome-extension://${id}/options.html`);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/screenshot-1-profielen.png` });

  const site = await ctx.newPage();
  await site.goto('http://localhost:8768/');
  await site.waitForTimeout(1200);
  await site.screenshot({ path: `${OUT}/screenshot-2-toast.png` });

  // Popup op een canvas van 1280x800
  const pop = await ctx.newPage();
  await pop.setViewportSize({ width: 420, height: 330 });
  await pop.goto(`chrome-extension://${id}/popup.html`);
  await pop.addStyleTag({ content: 'html{zoom:1.4} .popup{width:100%;box-sizing:border-box}' }); await pop.waitForTimeout(300);
  const popPng = (await pop.screenshot({ fullPage: true })).toString('base64');
  const canvas = await ctx.newPage();
  await canvas.setContent(`<body style="margin:0;width:1280px;height:800px;display:flex;align-items:center;justify-content:center;gap:64px;background:linear-gradient(135deg,#154273,#01689b);font-family:system-ui;color:#fff">
    <div style="max-width:440px"><img src="data:image/png;base64,${require('fs').readFileSync(ext + '/icons/icon-128.png').toString('base64')}" style="width:96px"><h1 style="font-size:44px;margin:16px 0 8px">Duo Headers</h1>
    <p style="font-size:22px;line-height:1.4;opacity:.9">Profielen met headers per domein. Met één klik aan of uit.</p></div>
    <img src="data:image/png;base64,${popPng}" style="border-radius:12px;box-shadow:0 20px 50px #0008"></body>`);
  await canvas.waitForTimeout(300);
  await canvas.screenshot({ path: `${OUT}/screenshot-3-popup.png` });

  // Kleine promotegel 440x280
  const tile = await ctx.newPage();
  await tile.setViewportSize({ width: 440, height: 280 });
  await tile.setContent(`<body style="margin:0;width:440px;height:280px;display:flex;align-items:center;gap:22px;padding:0 34px;box-sizing:border-box;background:linear-gradient(135deg,#154273,#01689b);font-family:system-ui;color:#fff">
    <img src="data:image/png;base64,${require('fs').readFileSync(ext + '/icons/icon-128.png').toString('base64')}" style="width:104px;flex:none;filter:drop-shadow(0 6px 14px #0006)">
    <div><div style="font-size:34px;font-weight:700;line-height:1.1">Duo Headers</div>
    <div style="font-size:17px;opacity:.9;margin-top:8px;line-height:1.35">Headers en tokens per profiel, per domein</div></div></body>`);
  await tile.waitForTimeout(200);
  await tile.screenshot({ path: `${OUT}/promo-small-440x280.png` });
  await ctx.close(); auth.close(); app.close();
})().catch(e => { console.error(e); process.exit(1); });
