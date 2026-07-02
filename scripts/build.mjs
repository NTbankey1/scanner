#!/usr/bin/env node

import { execSync } from 'child_process';
import { writeFileSync, mkdirSync, copyFileSync, existsSync, readdirSync, rmSync, readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(new URL('.', import.meta.url).pathname, '..');
const DIST = resolve(ROOT, 'dist');

if (existsSync(DIST)) {
  for (const f of readdirSync(DIST)) {
    rmSync(resolve(DIST, f), { recursive: true, force: true });
  }
}

// Step 1: JS build
console.log('[build] Building JS bundles...');
execSync('npx vite build', { cwd: ROOT, stdio: 'inherit' });

// Step 2: Copy HTML pages (with .ts → .js fix)
const PAGES = [
  { name: 'popup', src: 'src/presentation/popup/index.html' },
  { name: 'sidepanel', src: 'src/presentation/sidepanel/index.html' },
  { name: 'options', src: 'src/presentation/options/index.html' },
];

for (const page of PAGES) {
  const srcPath = resolve(ROOT, page.src);
  if (!existsSync(srcPath)) continue;
  let html = readFileSync(srcPath, 'utf-8');
  // Fix script references: .ts → .js for module scripts
  html = html.replace(/\.ts"/g, '.js"').replace(/\.ts'/g, ".js'");
  writeFileSync(resolve(DIST, `${page.name}.html`), html);
}

// Step 3: Copy icons
const iconsSrc = resolve(ROOT, 'icons');
if (existsSync(iconsSrc)) {
  mkdirSync(resolve(DIST, 'icons'), { recursive: true });
  for (const f of readdirSync(iconsSrc)) {
    copyFileSync(resolve(iconsSrc, f), resolve(DIST, 'icons', f));
  }
}

// Step 4: Write manifest
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

console.log('[build] Complete! Load dist/ in chrome://extensions');
console.log(`[build] dist/ contents: ${readdirSync(DIST).join(', ')}`);
