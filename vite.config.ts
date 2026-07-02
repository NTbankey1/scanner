import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        'service-worker': resolve(__dirname, 'src/infrastructure/background/service-worker.ts'),
        'content-script': resolve(__dirname, 'src/infrastructure/content-script/index.ts'),
        'popup': resolve(__dirname, 'src/presentation/popup/popup.ts'),
        'sidepanel': resolve(__dirname, 'src/presentation/sidepanel/sidepanel.ts'),
        'options': resolve(__dirname, 'src/presentation/options/options.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
      },
    },
  },
});
