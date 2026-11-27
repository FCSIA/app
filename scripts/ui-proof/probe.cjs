// node probe.cjs <out dir> [label]: deterministic UI checks on the full admin audit page.
// Each probe reports a value and whether it flags a defect, with a screenshot of the state it measured.
const fs = require('fs'), path = require('path');
const { pub, PNG, launch } = require('./lib.cjs');
const dir = path.resolve(process.argv[2]), label = process.argv[3] || path.basename(dir);
const SEAM = Number(process.env.SEAM || 3);
async function open(browser, query = "") {
  const t0 = Date.now(); const log = (m) => process.env.DEBUG && console.error(`[${Date.now() - t0}ms] ${m}`);
  const page = await browser.newPage({ viewport: { width: 1550, height: 1034 }, deviceScaleFactor: 2 });
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
async function firstButton(page, patterns) {
  for (const name of patterns) { const b = page.getByRole('button', { name }).first(); if (await b.count()) return b; }
  return null;
}
const probes = {
  // One icon on most rows while the actions differ: the icon isn't telling rows apart.
  async iconShare(browser) {
    const page = await open(browser);
    const r = await page.evaluate(() => {
      const heads = [...document.querySelectorAll('thead th')]; const i = heads.findIndex((th) => /action/i.test(th.textContent || ''));
      const cells = [...document.querySelectorAll('tbody tr')].map((tr) => tr.querySelectorAll('td')[i]).filter(Boolean);
      const icons = cells.map((td) => td.querySelector('svg')?.getAttribute('class')?.match(/lucide-[\w-]+/g)?.filter((c) => c !== 'lucide-icon').join(' ') || 'none');
      const labels = new Set(cells.map((td) => td.textContent.trim()));
      // How many different actions each icon stands for: 1 means the icon tells them apart.
      const byIcon = {}; cells.forEach((td, i) => (byIcon[icons[i]] ??= new Set()).add(td.textContent.trim()));
      const widest = Object.entries(byIcon).sort((a, b) => b[1].size - a[1].size)[0] || ['none', new Set()];
      return { rows: cells.length, distinctActions: labels.size, distinctIcons: Object.keys(byIcon).length, actionsPerIcon: +(labels.size / Math.max(1, Object.keys(byIcon).length)).toFixed(2), widestIcon: `${widest[0]} covers ${widest[1].size} actions` };
    });
    await shot(page, 'icons'); await page.close();
    return { ...r, flag: r.actionsPerIcon > 2 };
  },
  // A menu that needs scrolling is a search box in disguise.
  async menuScroll(browser) {
    const page = await open(browser);
    const button = await firstButton(page, [/^Action\b/, /filter action/i]);
    if (!button) { await page.close(); return { error: 'no Action filter button' }; }
    await button.click(); await page.waitForTimeout(400);
    const r = await page.evaluate(() => {
      const els = [...document.querySelectorAll('[role=menu], [role=menu] *, [role=listbox], [role=listbox] *')];
      const s = els.filter((e) => e.scrollHeight > e.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(e).overflowY));
      return { items: document.querySelectorAll('[role=menuitem],[role=menuitemcheckbox],[role=menuitemradio],[role=option]').length, scrollers: s.map((e) => `${e.scrollHeight}/${e.clientHeight}`) };
    });
    await shot(page, 'menu'); await page.close();
    return { ...r, flag: r.scrollers.length > 0 };
  },
  // Content wider than its popup: fixed-width popovers overflow silently.
  async popoverOverflow(browser) {
    const page = await open(browser);
    const when = await firstButton(page, [/^When\b/, /filter when/i]);
    if (!when) { await page.close(); return { error: 'no When filter button' }; }
    await when.click(); await page.waitForTimeout(300);
    const custom = page.locator('[role=menuitemradio], [role=menuitem]').filter({ hasText: /custom/i }).first();
    if (!(await custom.count())) { await page.close(); return { error: 'no custom range item' }; }
    await custom.click({ timeout: 5000 }); await page.waitForTimeout(500);
    const r = await page.evaluate(() => {
      const pops = [...document.querySelectorAll('[data-radix-popper-content-wrapper] > *, [role=dialog]')];
      const out = [];
      for (const pop of pops) {
        const box = pop.getBoundingClientRect();
        for (const el of pop.querySelectorAll('*')) {
          const b = el.getBoundingClientRect();
          if (b.width && (b.right > box.right + 1 || b.left < box.left - 1)) out.push(`${el.tagName.toLowerCase()} +${Math.round(Math.max(b.right - box.right, box.left - b.left))}px`);
        }
      }
      return { popovers: pops.length, overflowing: [...new Set(out)].slice(0, 5) };
    });
    await shot(page, 'popover'); await page.close();
    return { ...r, flag: r.overflowing.length > 0 };
  },
  // Two translucent controls meeting edge to edge draw a line where they overlap.
  async seam(browser) {
    const page = await open(browser, '?audit_action=REPORT_UPDATED');
    await page.waitForTimeout(300);
    const pairs = await page.evaluate(() => {
      const bs = [...document.querySelectorAll('button')].filter((b) => b.offsetParent && !b.closest('table'));
      const out = [];
      for (const a of bs) for (const b of bs) {
        if (a === b) continue; const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
        if (Math.abs(ra.right - rb.left) <= 1 && Math.abs(ra.top - rb.top) <= 2 && Math.abs(ra.height - rb.height) <= 2 && ra.height > 16)
          out.push({ x: ra.right, y: ra.top, h: ra.height, text: (a.textContent + '|' + b.textContent).slice(0, 40) });
      }
      return out;
    });
    const png = PNG.sync.read(await page.screenshot());
    const lum = (x, y) => { const i = (png.width * Math.round(y * 2) + Math.round(x * 2)) * 4; return 0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2]; };
    // The overlap shows where each control draws its own edge (a top highlight,
    // a ring): scan the rows at the top and bottom edges, in device pixels, for
    // a mark at the join that differs from the same edge a few pixels away.
    const px = (dx, dy) => { const i = (png.width * dy + dx) * 4; return 0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2]; };
    const seams = pairs.map((p) => {
      const jx = Math.round(p.x * 2), top = Math.round(p.y * 2), bottom = Math.round((p.y + p.h) * 2);
      let worst = 0;
      for (const dy of [top - 2, top - 1, top, top + 1, top + 2, bottom - 3, bottom - 2, bottom - 1, bottom, bottom + 1]) {
        const join = [jx - 2, jx - 1, jx, jx + 1].map((x) => px(x, dy));
        const away = [px(jx - 10, dy), px(jx + 10, dy)];
        worst = Math.max(worst, Math.max(...join) - Math.max(...away), Math.min(...away) - Math.min(...join));
      }
      return { ...p, contrast: +worst.toFixed(1) };
    });
    if (process.env.DEBUG) console.error(JSON.stringify(seams));
    await shot(page, 'pills'); await page.close();
    if (process.env.DEBUG) for (const p of pairs) { const y = p.y + p.h / 2; console.error(p.text, p.x.toFixed(1), Array.from({ length: 41 }, (_, k) => lum(p.x - 20 + k, y).toFixed(0)).join(' ') + ' | vertical@x-1: ' + Array.from({ length: 9 }, (_, k) => lum(p.x - 1, p.y + k * p.h / 8).toFixed(0)).join(' ')); }
    return { joinedPairs: seams.length, contrasts: seams.map((s) => s.contrast), seams: seams.filter((s) => s.contrast > SEAM).map((s) => `${s.text} (${s.contrast})`), flag: seams.some((s) => s.contrast > SEAM) };
  },
  // Surfaces inside surfaces in an opened event.
  async nesting(browser) {
    const page = await open(browser);
    // The table's hover layer takes the pointer; open the row the keyboard way.
    await page.evaluate(() => document.querySelector('tbody button[aria-expanded="false"]')?.focus());
    await page.keyboard.press('Enter'); await page.waitForTimeout(700);
    const r = await page.evaluate(() => {
      const opened = document.querySelector('tbody [aria-expanded="true"]')?.closest('tr');
      const detail = opened?.nextElementSibling; if (!detail) return { error: 'no detail row' };
      const bg = (el) => { const c = getComputedStyle(el).backgroundColor; return c === 'rgba(0, 0, 0, 0)' || c === 'transparent' ? null : c; };
      let deepest = 0; const disclosures = detail.querySelectorAll('details, [aria-expanded]').length;
      const walk = (el, depth, last) => { const c = bg(el); const d = c && c !== last ? depth + 1 : depth; deepest = Math.max(deepest, d); for (const k of el.children) walk(k, d, c || last); };
      walk(detail, 0, null);
      return { surfaceLayers: deepest, disclosures };
    });
    await shot(page, 'detail'); await page.close();
    return { ...r, flag: (r.surfaceLayers ?? 0) > 2 || (r.disclosures ?? 0) > 0 };
  },
};
(async () => {
  const browser = await launch();
  const only = process.env.PROBES ? process.env.PROBES.split(',') : Object.keys(probes);
  const results = {};
  try { for (const name of only) { try { results[name] = await probes[name](browser); } catch (e) { results[name] = { error: e.message.split('\n')[0].slice(0, 120) }; } } }
  finally { await browser.close(); }
  fs.writeFileSync(path.join(dir, `${label}-probes.json`), JSON.stringify(results, null, 1));
  for (const [k, v] of Object.entries(results)) console.log(`${label} ${k}: ${v.error ? 'ERROR ' + v.error : (v.flag ? 'FLAG ' : 'ok   ') + JSON.stringify(Object.fromEntries(Object.entries(v).filter(([kk]) => kk !== 'flag')))}`);
})();
