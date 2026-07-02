import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  modulePreload: false,
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        'service-worker': resolve(__dirname, 'src/infrastructure/background/service-worker.ts'),
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
