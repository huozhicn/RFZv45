import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import { execSync } from 'child_process'

const GIT_HASH = (() => {
  try { return execSync('git rev-parse --short HEAD', { cwd: __dirname }).toString().trim() }
  catch { return 'unknown' }
})()

export default defineConfig({
  base: '/v45/',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  define: {
    __COMMIT_HASH__: JSON.stringify(GIT_HASH),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
})
