// node build.cjs <source root> <out dir>: bundles the real admin page from any revision.
const path = require('path'), fs = require('fs');
const root = path.resolve(process.argv[2]), out = path.resolve(process.argv[3] || path.join(__dirname, 'out'));
const main = path.resolve(__dirname, '../..');
fs.mkdirSync(out, { recursive: true });
const s = (f) => path.join(__dirname, 'stubs', f);
const esbuild = require('esbuild');
const stubReal = { name: 'real', setup(b) { b.onResolve({ filter: /^REAL_CONVEX_REACT$/ }, () => ({ path: path.join(root, 'apps/web/src/lib/convex-react.ts') })); } };
// The harness's own files import packages (react, convex, next-themes); resolve
// them from the tree being built, so the bundle holds one copy of each.
const fromRoot = { name: 'from-root', setup(b) { b.onResolve({ filter: /^[@a-z]/ }, (args) => {
  if (!args.importer.startsWith(__dirname) || args.path === 'REAL_CONVEX_REACT') return;
  for (const base of [path.join(root, 'apps/web'), root]) { try { return { path: require.resolve(args.path, { paths: [base] }) }; } catch {} }
}); } };
// Newer revisions give each admin section its own page; older ones render
// every section from AdminPageContent. Build whichever this revision has.
const section = process.env.SECTION || 'audit';
const standalone = fs.existsSync(path.join(root, `apps/web/src/app/admin/${section}/page.tsx`));
const entry = path.join(__dirname, `entry.${path.basename(out)}.generated.tsx`);
fs.writeFileSync(entry, `import './data';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from 'next-themes';
import { NavigationLoadingProvider } from '@/components/layout/navigation-loading-provider';
import { AppFrame } from '@/components/layout/app-frame';
${standalone ? `import Page from '@/app/admin/${section}/page';` : `import { AdminPageContent as Page } from '@/app/admin/_components/admin-page-content';`}
history.replaceState(null, '', '/admin/${section}' + location.search);
createRoot(document.getElementById('root')!).render(
  <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} enableColorScheme={false}>
    <NavigationLoadingProvider><AppFrame defaultSidebarOpen><Page /></AppFrame></NavigationLoadingProvider>
  </ThemeProvider>,
);
`);
esbuild.build({ entryPoints: [entry], outfile: path.join(out, 'page.js'), bundle: true, absWorkingDir: root,
  tsconfig: path.join(root, 'apps/web/tsconfig.json'), jsx: 'automatic', nodePaths: [main + '/node_modules', main + '/apps/web/node_modules'],
  define: { 'process.env.NODE_ENV': '"production"', 'process.env': '{}' },
  alias: { '@/lib/convex-react': s('convex-react.tsx'), '@/lib/auth': s('auth.ts'), 'next/navigation': s('navigation.ts'), 'next/link': s('link.tsx'), 'next/image': s('image.tsx') },
  plugins: [stubReal, fromRoot], loader: { '.wasm': 'empty', '.css': 'empty', '.woff2': 'empty' }, logLimit: 8 })
  .then(() => {
    const { createRequire } = require('module'); const req = createRequire(main + '/apps/web/package.json');
    const postcss = req('postcss'), tw = req('@tailwindcss/postcss'); const from = path.join(root, 'apps/web/src/app/globals.css');
    return postcss([tw({ base: path.join(root, 'apps/web') })]).process(fs.readFileSync(from, 'utf8'), { from });
  }).then((r) => { const side = path.join(root, 'apps/web/src/components/ui/sidebar.css'); fs.writeFileSync(path.join(out, 'page.css'), r.css + (fs.existsSync(side) ? '\n' + fs.readFileSync(side, 'utf8') : '')); console.log('built', out); })
  .catch((e) => { console.error(e.message?.slice(0, 3000)); process.exit(1); });
