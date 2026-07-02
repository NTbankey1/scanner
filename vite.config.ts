import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';

export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        background: 'src/infrastructure/background/service-worker.ts',
        'content-script': 'src/infrastructure/content-script/index.ts',
        offscreen: 'src/infrastructure/offscreen/index.ts',
      },
    },
  },
});
