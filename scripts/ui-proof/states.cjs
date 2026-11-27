// [SECTION=audit] node states.cjs <built dir> <out dir> [query for the "filtered" state]
// Captures one page in a fixed, generic set of states, the same at every revision,
// so nothing in the capture points at a known defect:
//   default, each toolbar popup open (up to 7), first event opened, scrolled,
//   one filter applied (query), first row hovered, narrow (900px).
// Each state gets a PNG at device scale 1 (what a model sees) and an inventory:
// visible controls and text with ids, boxes and type, in document order.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { pub, PNG, launch } = require('./lib.cjs');
const [built, out, filterQuery = ''] = process.argv.slice(2).map((a, i) => (i < 2 ? path.resolve(a) : a));
fs.mkdirSync(out, { recursive: true });

async function open(browser, { query = '', width = 1550, height = 1034 } = {}) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  await page.route('http://ia.local/**', (route) => {
    const u = new URL(route.request().url());
    if (u.pathname.startsWith('/admin')) return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="en" class="dark" style="--font-work-sans:'Work Sans'"><head><meta charset="utf-8"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Work+Sans:wght@300..700&display=block"><link rel="stylesheet" href="/page.css"></head><body class="font-sans"><div id="root"></div></body></html>` });
    if (u.pathname === '/page.css' || u.pathname === '/page.js') return route.fulfill({ path: path.join(built, u.pathname) });
    const f = path.join(pub, u.pathname === '/_next/image' ? u.searchParams.get('url') : u.pathname);
    return fs.existsSync(f) && fs.statSync(f).isFile() ? route.fulfill({ path: f }) : route.fulfill({ status: 404 });
  });
  await page.goto(`http://ia.local/admin/${process.env.SECTION || 'audit'}` + query);
  await page.evaluate(() => document.fonts.load('400 14px "Work Sans"'));
  await page.addScriptTag({ path: path.join(built, 'page.js') });
  await page.locator('tbody tr td').first().waitFor({ timeout: 15000 });
  await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(400);
  await page.mouse.move(0, 0);
  return page;
}

// Visible controls and text leaves inside the viewport, with ids the reviewer can cite.
const inventory = (page) => page.evaluate(() => {
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; };
  const hex = (c) => { const m = c.match(/[\d.]+/g); if (!m) return c; const [r, g, b, a = 1] = m.map(Number); return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('') + (a < 1 ? `/${a.toFixed(2)}` : ''); };
  const control = 'h1,h2,h3,h4,[role=heading],button,a[href],input,select,textarea,[role=button],[role=tab],[role=switch],[role=checkbox],[role=menuitem],[role=menuitemcheckbox],[role=menuitemradio],[role=option],[role=combobox],summary';
  // The app's own navigation repeats on every state and stays visible in the screenshot.
  const shell = (el) => !!el.closest('nav, aside, [data-sidebar], [role=navigation]');
  const rows = []; const seen = new Set();
  const add = (el, kind, text) => {
    const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    const st = [el.getAttribute('aria-expanded') === 'true' ? 'open' : '', el.getAttribute('aria-checked') === 'true' || el.checked ? 'on' : '', el.getAttribute('aria-selected') === 'true' || el.getAttribute('aria-current') ? 'current' : '', el.disabled || el.getAttribute('aria-disabled') === 'true' ? 'disabled' : '', el.scrollWidth > el.clientWidth + 1 && cs.overflowX !== 'visible' ? 'cut' : ''].filter(Boolean).join(',');
    rows.push([kind, text.replace(/\s+/g, ' ').trim().slice(0, 80), st, `${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)}x${Math.round(r.height)}`, `${Math.round(parseFloat(cs.fontSize))}px/${cs.fontWeight} ${hex(cs.color)}`]);
  };
  for (const el of document.querySelectorAll(control)) {
    if (!vis(el) || shell(el)) continue; seen.add(el);
    add(el, el.getAttribute('role') || el.tagName.toLowerCase(), el.getAttribute('aria-label') || el.innerText || el.getAttribute('placeholder') || el.value || '');
  }
  // Text that isn't inside a control already listed: row cells, labels, captions.
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const owners = new Set();
  for (let n; (n = tw.nextNode());) {
    if (!n.textContent.trim()) continue; const el = n.parentElement;
    if (!el || el.closest('script,style,noscript,svg') || shell(el) || [...seen].some((c) => c.contains(el)) || owners.has(el) || !vis(el)) continue;
    owners.add(el);
  }
  for (const el of owners) add(el, 'text', [...el.childNodes].filter((c) => c.nodeType === 3).map((c) => c.textContent).join(' '));
  rows.sort((a, b) => { const [ax, ay] = a[3].split(',').map(Number), [bx, by] = b[3].split(',').map(Number); return ay - by || ax - bx; });
  const max = 220; const kept = rows.slice(0, max);
  return kept.map((r, i) => [`e${i + 1}`, ...r].join('\t')).join('\n') + (rows.length > max ? `\n# ${rows.length - max} more elements below this point omitted` : '');
});

async function capture(page, name) {
  await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement !== document.body && !document.activeElement.matches('[aria-expanded="true"]') && document.activeElement.blur());
  const png = path.join(out, `${name}.png`);
  await page.screenshot({ path: png, animations: 'disabled', caret: 'hide' });
  fs.writeFileSync(path.join(out, `${name}.txt`), `# state ${name}, viewport ${page.viewportSize().width}x${page.viewportSize().height}\n# id\tkind\ttext\tstate\tx,y,size\ttype\n${await inventory(page)}\n`);
  return crypto.createHash('sha1').update(fs.readFileSync(png)).digest('hex');
}

(async () => {
  const browser = await launch();
  const log = []; const hashes = new Map();
  const keep = async (page, name) => { const h = await capture(page, name); if (hashes.has(h)) { fs.rmSync(path.join(out, `${name}.png`)); fs.rmSync(path.join(out, `${name}.txt`)); log.push(`${name}: same as ${hashes.get(h)}, dropped`); } else { hashes.set(h, name); log.push(`${name}: ok`); } };
  const step = async (name, fn, opts) => { let page; try { page = await open(browser, opts); const ok = await fn(page); if (ok === false) log.push(`${name}: not available`); else await keep(page, name); } catch (e) { log.push(`${name}: failed (${e.message.split('\n')[0].slice(0, 90)})`); } finally { await page?.close(); } };
  try {
    await step('default', async () => true);
    // Every popup trigger on the page outside the rows and the app's own navigation.
    const probe = await open(browser);
    const triggers = await probe.evaluate(() => {
      const root = document.querySelector('main') || document.body;
      return [...root.querySelectorAll('button[aria-haspopup], button[aria-expanded]')]
        .filter((b) => b.offsetParent && !b.closest('tbody, nav, aside, [data-sidebar], header:not(thead *)') && b.getAttribute('aria-expanded') !== 'true')
        .map((b) => (b.getAttribute('aria-label') || b.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 40));
    });
    await probe.close();
    const unique = [...new Set(triggers)].filter(Boolean).slice(0, 7);
    for (const [i, label] of unique.entries()) {
      log.push(`menu-${i + 1} is "${label}"`);
      await step(`menu-${i + 1}`, async (page) => {
        const b = page.locator('main button[aria-haspopup], main button[aria-expanded], main [role=combobox], button[aria-haspopup], button[aria-expanded]').filter({ hasText: label.split(':')[0] }).first();
        const byLabel = page.getByRole('button', { name: label, exact: true }).first();
        const target = (await byLabel.count()) ? byLabel : b;
        if (!(await target.count())) return false;
        await target.focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(500);
        if (!(await page.locator('[role=menu], [role=listbox], [role=dialog], [data-radix-popper-content-wrapper]').count())) { await target.click({ force: true }); await page.waitForTimeout(500); }
        return true;
      });
    }
    await step('opened', async (page) => {
      // An event's own disclosure, never a popover trigger inside the row (a person preview).
      const t = page.locator('tbody button[aria-expanded="false"]:not([aria-haspopup])').first();
      if (await t.count()) { await t.focus(); await page.keyboard.press('Enter'); }
      else {
        const cell = page.locator('tbody tr').filter({ has: page.locator('td:nth-child(3)') }).first().locator('td').first();
        if (!(await cell.count())) return false; await cell.click({ force: true });
      }
      await page.waitForTimeout(800); await page.evaluate(() => document.activeElement?.blur()); return true;
    });
    await step('scrolled', async (page) => {
      await page.evaluate(async () => { for (const e of document.querySelectorAll('*')) { const cs = getComputedStyle(e); if (/auto|scroll/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 4 && e.querySelector('table')) e.scrollTop = 700; } window.scrollTo(0, 700); await new Promise((r) => setTimeout(r, 400)); });
      return true;
    });
    if (filterQuery) await step('filtered', async () => true, { query: filterQuery });
    await step('row-hover', async (page) => {
      const box = await page.evaluate(() => { const tr = [...document.querySelectorAll('tbody tr')].find((r) => r.children.length > 2); if (!tr) return null; const b = tr.getBoundingClientRect(); return { x: b.left + b.width * 0.55, y: b.top + b.height / 2 }; });
      if (!box) return false; await page.mouse.move(box.x, box.y, { steps: 3 }); await page.waitForTimeout(400); return true;
    });
    await step('narrow', async () => true, { width: 900 });
  } finally { await browser.close(); }
  fs.writeFileSync(path.join(out, 'capture-log.txt'), log.join('\n') + '\n');
  console.log(path.basename(out), '|', log.join(' | '));
})();
