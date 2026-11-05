import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';
export default defineConfig({
  plugins: [vue()],
  resolve: {alias: {'@': fileURLToPath(new URL('./src', import.meta.url))}, extensions: ['.mjs', '.js', '.json', '.vue']},
  server: {port: 5173, proxy: {'/v1': 'http://127.0.0.1:8889', '/ping': 'http://127.0.0.1:8889'}},
  css: {preprocessorOptions: {scss: {silenceDeprecations: ['import', 'global-builtin', 'color-functions', 'if-function']}}},
});
