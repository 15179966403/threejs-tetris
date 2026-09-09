import { defineConfig } from 'vite';
import { resolve } from 'node:path';

/**
 * 微信小游戏构建配置：
 * 小游戏运行时不支持原生 ES Module，入口必须是单文件 game.js，
 * 因此用 vite lib 模式（IIFE）把 three + 游戏代码打成一个包，
 * 目标 ES2018 兼容小游戏 JavaScriptCore。
 *
 * 产物输出到 minigame/（不清空目录，保留 game.json 等手写文件）。
 */
export default defineConfig({
  appType: 'custom',
  build: {
    outDir: 'minigame',
    emptyOutDir: false,
    target: 'es2018',
    minify: 'esbuild',
    lib: {
      entry: resolve(__dirname, 'src/minigame/main.js'),
      name: 'Tetris3D',
      formats: ['iife'],
      fileName: () => 'game.js',
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
});
