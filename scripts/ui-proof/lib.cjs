// Shared by the ui-proof scripts: repo paths, the headless browser, PNG.
const fs = require('fs'), path = require('path');
const repo = path.resolve(__dirname, '../..');
const pub = path.join(repo, 'apps/web/public');
const { chromium } = require('playwright-core');
const { PNG } = require('pngjs');
// Any installed Chromium works. UI_PROOF_BROWSER wins; otherwise the first one
// found, else Playwright's own (`bunx playwright-core install chromium`).
const executablePath = [
  process.env.UI_PROOF_BROWSER,
  '/Applications/Helium.app/Contents/MacOS/Helium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/chromium', '/usr/bin/google-chrome',
].find((p) => p && fs.existsSync(p));
const launch = () => chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
module.exports = { repo, pub, chromium, PNG, launch };
