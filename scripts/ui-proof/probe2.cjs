// node probe2.cjs <out dir> [label]: second batch of audit-page checks, one per owner
// correction in audit-log-stats/defects.csv (ids in brackets). Thresholds were set
// before running them on any revision. PROBES=a,b limits the run.
const fs = require('fs'), path = require('path');
const { pub, PNG, launch } = require('./lib.cjs');
const dir = path.resolve(process.argv[2]), label = process.argv[3] || path.basename(dir);
async function open(browser, { query = '', width = 1550, height = 1034 } = {}) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.route('http://ia.local/**', (route) => {
    const u = new URL(route.request().url());
    if (u.pathname.startsWith('/admin')) return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="en" class="dark" style="--font-work-sans:'Work Sans'"><head><meta charset="utf-8"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Work+Sans:wght@300..700&display=block"><link rel="stylesheet" href="/page.css"></head><body class="font-sans"><div id="root"></div></body></html>` });
    if (u.pathname === '/page.css' || u.pathname === '/page.js') return route.fulfill({ path: path.join(dir, u.pathname) });
    const f = path.join(pub, u.pathname === '/_next/image' ? u.searchParams.get('url') : u.pathname);
    return fs.existsSync(f) && fs.statSync(f).isFile() ? route.fulfill({ path: f }) : route.fulfill({ status: 404 });
  });
  await page.goto('http://ia.local/admin/audit' + query);
  await page.evaluate(() => document.fonts.load('400 14px "Work Sans"'));
  await page.addScriptTag({ path: path.join(dir, 'page.js') });
  await page.locator('tbody tr td').first().waitFor({ timeout: 10000 });
  await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(300);
  return page;
}
const shot = (page, name) => page.screenshot({ path: path.join(dir, `${label}-${name}.png`) });
const png = async (page, clip) => PNG.sync.read(await page.screenshot(clip ? { clip } : {}));
const changed = (a, b, rects) => { // pixels that differ, counted only inside rects (CSS px, dpr 1)
  let n = 0;
  for (const r of rects) for (let y = Math.max(0, Math.floor(r.y)); y < Math.min(a.height, r.y + r.h); y++) for (let x = Math.max(0, Math.floor(r.x)); x < Math.min(a.width, r.x + r.w); x++) {
    const i = (y * a.width + x) * 4; if (Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]) > 12) n++;
  }
  return n;
};
const filterButtons = (page) => page.evaluate(() => [...document.querySelectorAll('button')].filter((b) => b.offsetParent && !b.closest('tbody') && /filter|^(when|action|person|actor|record|category)\b/i.test((b.getAttribute('aria-label') || b.textContent || '').trim())).length);

const probes = {
  // [20] Wasted space next to cut text: a wide column whose content fills under
  // half of it, on a page where another column cuts 10%+ of its cells.
  async columnDensity(browser) {
    const page = await open(browser);
    const r = await page.evaluate(() => {
      const heads = [...document.querySelectorAll('thead th')].filter((th) => th.getBoundingClientRect().width > 0);
      const rows = [...document.querySelectorAll('tbody tr')].filter((tr) => tr.children.length >= heads.length - 1 && tr.children.length > 2);
      return heads.map((th, i) => {
        const cells = rows.map((tr) => tr.children[i]).filter(Boolean);
        const width = th.getBoundingClientRect().width;
        const natural = cells.map((td) => { const cs = getComputedStyle(td); const left = td.getBoundingClientRect().left; let right = left; const tw = document.createTreeWalker(td, NodeFilter.SHOW_TEXT); for (let n; (n = tw.nextNode());) { if (!n.textContent.trim()) continue; const rg = document.createRange(); rg.selectNodeContents(n); for (const r of rg.getClientRects()) right = Math.max(right, r.right); } for (const e of td.querySelectorAll('svg, img, [data-slot=avatar]')) right = Math.max(right, e.getBoundingClientRect().right); return right - left + parseFloat(cs.paddingRight); }).sort((a, b) => a - b);
        const cut = cells.filter((td) => [td, ...td.querySelectorAll('*')].some((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX !== 'visible')).length;
        const p90 = natural[Math.floor(natural.length * 0.9)] || 0;
        return { col: (th.textContent || th.getAttribute('aria-label') || '').trim().slice(0, 14) || `#${i}`, width: Math.round(width), p90: Math.round(p90), fill: +(p90 / width).toFixed(2), cutShare: +(cut / Math.max(1, cells.length)).toFixed(2) };
      });
    });
    const wasteful = r.filter((c) => c.width >= 160 && c.fill < 0.5);
    const cutting = r.filter((c) => c.cutShare >= 0.1);
    await shot(page, 'density'); await page.close();
    return { columns: r.map((c) => `${c.col}:${c.width}px fill ${c.fill} cut ${c.cutShare}`), flag: wasteful.length > 0 && cutting.length > 0, why: wasteful.length && cutting.length ? `${wasteful.map((c) => c.col)} wastes space while ${cutting.map((c) => c.col)} cuts text` : '' };
  },
  // [13] Clickable things in the rows show a pointer.
  async pointer(browser) {
    const page = await open(browser);
    const r = await page.evaluate(() => {
      const els = [...document.querySelectorAll('tbody a[href], tbody [aria-haspopup]')].filter((e) => e.offsetParent);
      const bad = els.filter((e) => getComputedStyle(e).cursor !== 'pointer');
      return { interactive: els.length, withoutPointer: bad.length, examples: [...new Set(bad.map((e) => (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 30)))].slice(0, 4) };
    });
    await page.close();
    return { ...r, flag: r.withoutPointer > 0 };
  },
  // [38][35][46] After scrolling down a long page of events, the header row,
  // the search box and the pagination stay in view.
  async sticky(browser) {
    const page = await open(browser, { height: 760 });
    await page.evaluate(async () => {
      const table = document.querySelector('table');
      const scrollers = []; for (let e = table.parentElement; e; e = e.parentElement) { const cs = getComputedStyle(e); if (/auto|scroll/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 4) scrollers.push(e); }
      for (const s of scrollers) s.scrollTop = Math.min(700, s.scrollHeight);
      window.scrollTo(0, 700);
      await new Promise((r) => setTimeout(r, 300));
    });
    const r = await page.evaluate(() => {
      const inView = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); if (!b.height) return null; let top = 0, bottom = innerHeight; for (let p = e.parentElement; p; p = p.parentElement) { const cs = getComputedStyle(p); if (/auto|scroll|hidden|clip/.test(cs.overflowY)) { const pb = p.getBoundingClientRect(); top = Math.max(top, pb.top); bottom = Math.min(bottom, pb.bottom); } } return b.top >= top - 1 && b.bottom <= bottom + 1; };
      const head = document.querySelector('thead th');
      const search = [...document.querySelectorAll('input')].find((i) => /search/i.test(i.placeholder + (i.getAttribute('aria-label') || '') + i.type));
      const pag = [...document.querySelectorAll('nav, div, footer')].reverse().find((e) => /page \d+ of|rows per page|older|previous/i.test(e.getAttribute('aria-label') || '') || (/^(page \d+|\d+\s*[–-]\s*\d+ of|rows per page)/i.test((e.textContent || '').trim()) && e.querySelector('button')));
      return { headerVisible: inView(head), searchVisible: inView(search), paginationVisible: inView(pag) };
    });
    await shot(page, 'scrolled'); await page.close();
    return { ...r, flag: Object.values(r).some((v) => v === false) };
  },
  // [37] The pagination sits close to the bottom of its frame: no dead band under it.
  async paginationGap(browser) {
    const page = await open(browser);
    const r = await page.evaluate(() => {
      const pag = [...document.querySelectorAll('nav, div, footer')].reverse().find((e) => /^(page \d+|\d+\s*[–-]\s*\d+ of|rows per page|\d+ \/ \d+ rows)/i.test((e.textContent || '').trim()) && e.querySelector('button'));
      if (!pag) return { error: 'no pagination' };
      let frame = pag.parentElement; while (frame && frame !== document.body && !(getComputedStyle(frame).borderBottomWidth !== '0px' || /auto|scroll|hidden/.test(getComputedStyle(frame).overflowY))) frame = frame.parentElement;
      const pb = pag.getBoundingClientRect(); const fb = frame && frame !== document.body ? frame.getBoundingClientRect().bottom : innerHeight;
      return { gapBelow: Math.round(Math.min(fb, innerHeight) - pb.bottom) };
    });
    await page.close();
    return { ...r, flag: (r.gapBelow ?? 0) > 40 };
  },
  // [34] Two joined filter buttons keep the toolbar's corner radius on their outer corners.
  async joinedRadius(browser) {
    const page = await open(browser, { query: '?audit_action=REPORT_UPDATED' });
    const r = await page.evaluate(() => {
      const bs = [...document.querySelectorAll('button')].filter((b) => b.offsetParent && !b.closest('table'));
      const pairs = [];
      for (const a of bs) for (const b of bs) { const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); if (a !== b && Math.abs(ra.right - rb.left) <= 1 && Math.abs(ra.top - rb.top) <= 2 && Math.abs(ra.height - rb.height) <= 2 && ra.height > 16) pairs.push([a, b]); }
      const solo = bs.filter((b) => !pairs.flat().includes(b) && b.getBoundingClientRect().height > 20 && parseFloat(getComputedStyle(b).borderTopLeftRadius) > 0);
      const h = pairs.length ? pairs[0][0].getBoundingClientRect().height : 0; const same = solo.filter((b) => Math.abs(b.getBoundingClientRect().height - h) <= 2).map((b) => parseFloat(getComputedStyle(b).borderTopLeftRadius)).sort((a, b) => a - b); const ref = same.length ? same[Math.floor(same.length / 2)] : null;
      return { reference: ref, outer: pairs.map(([a, b]) => [parseFloat(getComputedStyle(a).borderTopLeftRadius), parseFloat(getComputedStyle(b).borderTopRightRadius)]) };
    });
    await shot(page, 'joined'); await page.close();
    const bad = r.reference == null ? [] : r.outer.filter((o) => o.some((v) => Math.abs(v - r.reference) > 1));
    return { ...r, flag: bad.length > 0 };
  },
  // [26] At a narrow width, an opened event shows all of itself: nothing cut at the side or bottom.
  async narrowDetail(browser) {
    const page = await open(browser, { width: 900, height: 900 });
    await page.evaluate(() => document.querySelector('tbody button[aria-expanded="false"]')?.focus());
    await page.keyboard.press('Enter'); await page.waitForTimeout(700);
    const r = await page.evaluate(() => {
      const opened = document.querySelector('tbody [aria-expanded="true"]')?.closest('tr'); const detail = opened?.nextElementSibling;
      if (!detail) return { error: 'no detail row' };
      let right = innerWidth; for (let p = detail.parentElement; p; p = p.parentElement) { const cs = getComputedStyle(p); if (/auto|scroll|hidden|clip/.test(cs.overflowX)) right = Math.min(right, p.getBoundingClientRect().right); }
      const outside = [...detail.querySelectorAll('*')].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.right > right + 4 && e.textContent.trim(); }).length;
      const clipped = [...detail.querySelectorAll('*')].filter((e) => e.scrollHeight > e.clientHeight + 2 && /hidden|clip/.test(getComputedStyle(e).overflowY) && e.clientHeight > 0).length;
      return { outsideRight: outside, clippedVertically: clipped };
    });
    await shot(page, 'narrow-detail'); await page.close();
    return { ...r, flag: (r.outsideRight || 0) + (r.clippedVertically || 0) > 0 };
  },
  // [44] Pointing at an open filter menu doesn't light up the rows beneath it.
  async menuHoverLeak(browser) {
    const page = await open(browser);
    let btn = null; for (const name of [/^Action filter/i, /^Filter action/i, /^When filter/i, /^Action\b/, /^When\b/]) { const b = page.getByRole('button', { name }).first(); if (await b.count()) { btn = b; break; } }
    if (!btn) { await page.close(); return { error: 'no filter button' }; }
    await btn.click(); await page.waitForTimeout(400);
    const geo = await page.evaluate(() => {
      const menu = document.querySelector('[role=menu], [role=listbox], [role=dialog]'); if (!menu) return null;
      const m = menu.getBoundingClientRect();
      const item = [...menu.querySelectorAll('[role=menuitem],[role=menuitemcheckbox],[role=menuitemradio],[role=option]')].find((i) => { const b = i.getBoundingClientRect(); return [...document.querySelectorAll('tbody tr')].some((tr) => { const t = tr.getBoundingClientRect(); return b.top + b.height / 2 > t.top && b.top + b.height / 2 < t.bottom; }); });
      const t = document.querySelector('table').getBoundingClientRect();
      return { menu: { x: m.left, y: m.top, w: m.width, h: m.height }, item: item && (() => { const b = item.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; })(), table: { x: t.left, y: t.top, w: t.width, h: Math.min(t.height, innerHeight - t.top) } };
    });
    if (!geo?.item) { await page.close(); return { error: 'menu does not sit over rows' }; }
    await page.mouse.move(geo.menu.x + geo.menu.w / 2, Math.max(2, geo.menu.y - 30)); await page.waitForTimeout(200);
    const before = await png(page);
    await page.mouse.move(geo.item.x, geo.item.y, { steps: 4 }); await page.waitForTimeout(300);
    const after = await png(page);
    // Only the table area outside the menu.
    const m = geo.menu, t = geo.table;
    const rects = [{ x: t.x, y: t.y, w: Math.max(0, m.x - t.x - 4), h: t.h }, { x: m.x + m.w + 4, y: t.y, w: Math.max(0, t.x + t.w - m.x - m.w - 4), h: t.h }, { x: m.x, y: m.y + m.h + 4, w: m.w, h: Math.max(0, t.y + t.h - m.y - m.h - 4) }];
    const n = changed(before, after, rects);
    await shot(page, 'menu-hover'); await page.close();
    return { changedPixelsUnderMenu: n, flag: n > 200 };
  },
  // [45] Pointing at a day separator lights nothing.
  async separatorHover(browser) {
    const page = await open(browser);
    const geo = await page.evaluate(() => {
      const sep = [...document.querySelectorAll('tbody tr')].find((tr) => tr.children.length === 1);
      if (!sep) return null; const b = sep.getBoundingClientRect(); const t = document.querySelector('table').getBoundingClientRect();
      return { sep: { x: b.left, y: b.top, w: b.width, h: b.height }, table: { x: t.left, y: t.top, w: t.width, h: Math.min(t.height, innerHeight - t.top) } };
    });
    if (!geo) { await page.close(); return { error: 'no day separator row' }; }
    await page.mouse.move(geo.sep.x + 5, geo.table.y - 40); await page.waitForTimeout(200);
    const before = await png(page);
    await page.mouse.move(geo.sep.x + geo.sep.w / 2, geo.sep.y + geo.sep.h / 2, { steps: 4 }); await page.waitForTimeout(300);
    const after = await png(page);
    const s = geo.sep, t = geo.table;
    const n = changed(before, after, [{ x: t.x, y: t.y, w: t.w, h: s.y - t.y - 1 }, { x: t.x, y: s.y + s.h + 1, w: t.w, h: t.y + t.h - s.y - s.h - 1 }]);
    await page.close();
    return { changedPixelsInRows: n, flag: n > 200 };
  },
};
(async () => {
  const browser = await launch();
  const only = process.env.PROBES ? process.env.PROBES.split(',') : Object.keys(probes);
  const results = {};
  try { for (const name of only) { try { results[name] = await probes[name](browser); } catch (e) { results[name] = { error: e.message.split('\n')[0].slice(0, 120) }; } } }
  finally { await browser.close(); }
  fs.writeFileSync(path.join(dir, `${label}-probes2.json`), JSON.stringify(results, null, 1));
  for (const [k, v] of Object.entries(results)) console.log(`${label} ${k}: ${v.error ? 'ERROR ' + v.error : (v.flag ? 'FLAG ' : 'ok   ') + JSON.stringify(Object.fromEntries(Object.entries(v).filter(([kk]) => kk !== 'flag')))}`);
})();
