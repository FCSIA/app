// node shoot.cjs <out dir> [pages=25] [label]: renders the admin audit page like prod and
// measures every page of results: sideways overflow and row heights.
const fs = require('fs'), path = require('path');
const { pub, PNG, launch } = require('./lib.cjs');
const dir = path.resolve(process.argv[2]), pages = Number(process.argv[3] || 25), label = process.argv[4] || path.basename(dir);
(async () => {
  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: Number(process.env.W || 1550), height: Number(process.env.HT || 1034) }, deviceScaleFactor: 2 });
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    await page.route('http://ia.local/**', (route) => {
      const u = new URL(route.request().url());
      if (u.pathname.startsWith('/admin')) return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="en" class="dark" style="--font-work-sans:'Work Sans'"><head><meta charset="utf-8"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Work+Sans:wght@300..700&display=block"><link rel="stylesheet" href="/page.css"></head><body class="font-sans"><div id="root"></div></body></html>` });
      if (u.pathname === '/page.css' || u.pathname === '/page.js') return route.fulfill({ path: path.join(dir, u.pathname) });
      const f = path.join(pub, u.pathname === '/_next/image' ? u.searchParams.get('url') : u.pathname);
      return fs.existsSync(f) && fs.statSync(f).isFile() ? route.fulfill({ path: f }) : route.fulfill({ status: 404 });
    });
    await page.goto(`http://ia.local/admin/${process.env.SECTION || 'audit'}` + (process.env.Q ? '?' + process.env.Q : ''));
    await page.evaluate(() => document.fonts.load('400 14px "Work Sans"'));
    await page.addScriptTag({ path: path.join(dir, 'page.js') });
    await page.locator('tbody tr td').first().waitFor({ timeout: 10000 });
    await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(300);
    const results = [];
    for (let i = 1; i <= pages; i++) {
      const m = await page.evaluate(() => {
        const vp = document.querySelector('table')?.closest('[data-slot=scroll-area-viewport]');
        const rows = [...document.querySelectorAll('tbody tr')].filter((r) => r.querySelectorAll('td').length > 1 && !r.querySelector('th'));
        const heights = rows.map((r) => Math.round(r.getBoundingClientRect().height));
        const cols = [...document.querySelectorAll('thead th[data-column-id]')].map((th) => [th.dataset.columnId, Math.round(th.getBoundingClientRect().width)]);
        const cut = {}; for (const td of document.querySelectorAll('tbody td[data-column-id]')) { const id = td.dataset.columnId; for (const el of td.querySelectorAll('*')) { if (getComputedStyle(el).textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1) { cut[id] = (cut[id] || 0) + 1; (window.__cutText ??= {})[id] ??= new Set(); window.__cutText[id].add(el.textContent.trim().slice(0, 60) + ` (${el.scrollWidth}>${el.clientWidth})`); break; } } }
        return { cut, overflow: vp ? vp.scrollWidth - vp.clientWidth : null, viewport: vp?.clientWidth, heights, cols, page: document.body.innerText.match(/Page \d+ of \d+/)?.[0] };
      });
      const tall = m.heights.filter((h) => h > Math.min(...m.heights) + 1).length;
      results.push({ page: i, overflowPx: m.overflow, rows: m.heights.length, rowHeights: [...new Set(m.heights)].sort((a, b) => a - b), tallRows: tall, cut: m.cut, cols: Object.fromEntries(m.cols) });
      if (i === 1 || i === 2 || m.overflow > 0 && !results.slice(0, -1).some((r) => r.overflowPx > 0)) await page.screenshot({ path: path.join(dir, `${label}-page${i}.png`) });
      if (process.env.SHOT_WHEN && !globalThis.__shot && await page.locator(process.env.SHOT_WHEN).count()) { globalThis.__shot = 1; await page.locator(process.env.SHOT_WHEN).first().scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(dir, `${label}-match.png`) }); console.log(label + ': matched on page ' + i); }
      if (i < pages) { const next = page.getByRole('button', { name: /next page/i }); try { await next.click({ timeout: 5000 }); } catch { console.log(label + ': next page unavailable after page ' + i); break; } await page.waitForTimeout(200); }
    }
    fs.writeFileSync(path.join(dir, `${label}-pages.json`), JSON.stringify(results, null, 1));
    const over = results.filter((r) => r.overflowPx > 0);
    console.log(`${label}: ${over.length}/${results.length} pages scroll sideways` + (over.length ? ` (e.g. page ${over[0].page}: +${over[0].overflowPx}px)` : ''));
    console.log(`${label}: rows taller than the page's shortest: ${results.reduce((s, r) => s + r.tallRows, 0)}/${results.reduce((s, r) => s + r.rows, 0)}; heights seen ${[...new Set(results.flatMap((r) => r.rowHeights))].sort((a, b) => a - b).join(',')}`);
    const cuts = {}; for (const r of results) for (const [k, v] of Object.entries(r.cut || {})) cuts[k] = (cuts[k] || 0) + v; console.log(`${label}: cells cut short by column:`, JSON.stringify(cuts));
    console.log(`${label}: examples:`, JSON.stringify(await page.evaluate(() => Object.fromEntries(Object.entries(window.__cutText ?? {}).filter(([k]) => k !== 'record').map(([k, v]) => [k, [...v].slice(0, 4)])))));
    if (errors.length) console.log('page errors:', [...new Set(errors)].slice(0, 5));
    console.log('unanswered queries:', await page.evaluate(() => [...(window.__unanswered ?? [])].join(', ')));
  } finally { await browser.close(); }
})().catch((e) => { console.error(e.message); process.exitCode = 1; });
