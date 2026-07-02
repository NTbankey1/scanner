#!/usr/bin/env node

import { execSync } from 'child_process';
import { writeFileSync, mkdirSync, copyFileSync, existsSync, readdirSync, rmSync, readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(new URL('.', import.meta.url).pathname, '..');
const DIST = resolve(ROOT, 'dist');

// Clean dist
if (existsSync(DIST)) {
  for (const f of readdirSync(DIST)) {
    rmSync(resolve(DIST, f), { recursive: true, force: true });
  }
}

// Step 1: Vite builds service worker + UI (may also build content-script, we'll overwrite)
console.log('[build] Building service worker & UI with Vite...');
execSync('npx vite build', { cwd: ROOT, stdio: 'inherit' });

// Step 2: esbuild content-script as self-contained IIFE (overwrites Vite's version)
console.log('[build] Building content-script as self-contained IIFE...');
execSync(
  `npx esbuild src/infrastructure/content-script/index.ts ` +
  `--bundle --format=iife --global-name=ContentScript ` +
  `--outfile=dist/content-script.js --external:chrome`,
  { cwd: ROOT, stdio: 'inherit' }
);

// Step 3: Generate HTML pages (fix .ts → .js)
const PAGES = [
  { name: 'popup', src: 'src/presentation/popup/index.html' },
  { name: 'sidepanel', src: 'src/presentation/sidepanel/index.html' },
  { name: 'options', src: 'src/presentation/options/index.html' },
];

for (const page of PAGES) {
  const srcPath = resolve(ROOT, page.src);
  if (!existsSync(srcPath)) continue;
  let html = readFileSync(srcPath, 'utf-8');
  html = html.replace(/\.ts"/g, '.js"').replace(/\.ts'/g, ".js'");
  writeFileSync(resolve(DIST, `${page.name}.html`), html);
}

// Step 4: Copy icons
const iconsSrc = resolve(ROOT, 'icons');
if (existsSync(iconsSrc)) {
  mkdirSync(resolve(DIST, 'icons'), { recursive: true });
  for (const f of readdirSync(iconsSrc)) {
    copyFileSync(resolve(iconsSrc, f), resolve(DIST, 'icons', f));
  }
}

// Step 5: Write manifest
const manifest = {
  manifest_version: 3,
  name: 'Deep Site Scanner',
  version: '0.1.0',
  description: 'Professional deep site scanner',
  permissions: [
    'storage', 'scripting', 'tabs', 'webNavigation', 'downloads',
    'offscreen', 'alarms', 'contextMenus', 'sidePanel', 'notifications', 'unlimitedStorage',
  ],
  optional_host_permissions: ['<all_urls>'],
  background: {
    service_worker: 'service-worker.js',
    type: 'module',
  },
  action: {
    default_popup: 'popup.html',
    default_title: 'Deep Site Scanner',
  },
  options_page: 'options.html',
  side_panel: { default_path: 'sidepanel.html' },
  content_scripts: [{
    matches: ['<all_urls>'],
    js: ['content-script.js'],
    run_at: 'document_idle',
    all_frames: true,
  }],
  content_security_policy: {
    extension_pages: "script-src 'self'; object-src 'none';",
  },
  icons: { '16': 'icons/icon16.png', '48': 'icons/icon48.png', '128': 'icons/icon128.png' },
};

writeFileSync(resolve(DIST, 'manifest.json'), JSON.stringify(manifest, null, 2));

// Final verification
const files = readdirSync(DIST).filter(f => !f.startsWith('.')).sort();
console.log(`[build] Files: ${files.join(', ')}`);

const cs = readFileSync(resolve(DIST, 'content-script.js'), 'utf-8');
if (/import\s|require\s*\(/.test(cs)) {
  console.error('[build] ERROR: content-script still has imports!');
  process.exit(1);
}
console.log('[build] content-script.js: self-contained ✓');
console.log('[build] Done! Load dist/ in chrome://extensions');
