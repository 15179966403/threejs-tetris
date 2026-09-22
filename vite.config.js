import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    proxy: {
      '/laya-api': {
        target: 'http://127.0.0.1:8770',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/laya-api/, ''),
      },
    },
  },
});
