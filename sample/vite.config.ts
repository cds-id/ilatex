import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        accents: resolve(__dirname, 'accents.html'),
        renderDemo: resolve(__dirname, 'render-demo.html'),
      },
    },
  },
});
